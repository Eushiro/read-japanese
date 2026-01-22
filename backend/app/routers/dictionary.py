"""Dictionary lookup endpoint - multi-language support with local dictionaries."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal
import httpx

router = APIRouter()


class DictionaryEntry(BaseModel):
    word: str
    reading: str
    meanings: list[str]
    partOfSpeech: str | None = None


class DictionaryResponse(BaseModel):
    entries: list[DictionaryEntry]


# Singleton instances for dictionaries
_jamdict_instance = None
_wordnet_initialized = False
_japanese_word_index: list[tuple[str, str, list[str], str | None, int]] | None = None  # (reading, word, meanings, pos, priority)
_english_word_index: list[tuple[str, list[str], str | None]] | None = None  # (word, meanings, pos)
_french_word_index: list[tuple[str, list[str], str | None]] | None = None  # (word, meanings, pos)


def convert_romaji_to_hiragana(text: str) -> str:
    """Convert romaji to hiragana using wanakana-python library."""
    try:
        import wanakana
        if wanakana.is_romaji(text):
            return wanakana.to_hiragana(text)
        return text
    except Exception as e:
        print(f"Romaji conversion error: {e}")
        return text


def is_romaji(text: str) -> bool:
    """Check if text appears to be romaji using wanakana-python."""
    try:
        import wanakana
        return wanakana.is_romaji(text)
    except Exception:
        # Fallback: check if ASCII letters only
        return all(c.isascii() and (c.isalpha() or c in "'-") for c in text) and len(text) > 0


def get_jamdict():
    """Get or create jamdict instance for Japanese (lazy loading)."""
    global _jamdict_instance
    if _jamdict_instance is None:
        try:
            from jamdict import Jamdict
            _jamdict_instance = Jamdict()
        except Exception as e:
            print(f"Failed to initialize jamdict: {e}")
            return None
    return _jamdict_instance


def init_wordnet():
    """Initialize WordNet for English lookups."""
    global _wordnet_initialized
    if not _wordnet_initialized:
        try:
            import wn
            # Download English WordNet if not present
            if not wn.lexicons():
                wn.download('ewn:2020')
            _wordnet_initialized = True
        except Exception as e:
            print(f"Failed to initialize WordNet: {e}")
            return False
    return _wordnet_initialized


def build_japanese_index() -> list[tuple[str, str, list[str], str | None, int]]:
    """Build in-memory index of Japanese words for fast prefix search.

    Returns list of (reading, word, meanings, pos, priority_score) tuples.
    Lower priority_score = more common word.
    """
    global _japanese_word_index
    if _japanese_word_index is not None:
        return _japanese_word_index

    jmd = get_jamdict()
    if jmd is None:
        return []

    print("Building Japanese word index (one-time operation)...")
    import time
    from collections import defaultdict
    start = time.time()

    db = jmd.jmdict

    try:
        # Load all data at once (much faster than individual lookups)
        all_kana = list(db.Kana.select())
        all_kanji = list(db.Kanji.select())
        all_senses = list(db.Sense.select())
        all_glosses = list(db.SenseGloss.select())
        all_knp = list(db.KNP.select())  # Kana priorities
        all_kjp = list(db.KJP.select())  # Kanji priorities

        # Build lookup dictionaries
        kana_by_id = defaultdict(list)
        for k in all_kana:
            kana_by_id[k.idseq].append(k)

        kanji_by_id = defaultdict(list)
        for k in all_kanji:
            kanji_by_id[k.idseq].append(k.text)

        # Gloss lookup by sense ID
        gloss_by_sid = defaultdict(list)
        for g in all_glosses:
            if g.lang == 'eng' or not g.lang:  # English glosses
                gloss_by_sid[g.sid].append(g.text)

        # Sense lookup by entry idseq
        sense_by_idseq = defaultdict(list)
        for s in all_senses:
            sense_by_idseq[s.idseq].append(s)

        # Priority lookup by kana ID
        # Priority scoring: ichi1=1, news1=2, nf01=3, nf02=4, ..., spec1=50, no priority=100
        priority_by_kid = {}
        for knp in all_knp:
            tag = knp.text
            score = 100
            if tag == 'ichi1':
                score = 1
            elif tag == 'news1':
                score = 2
            elif tag == 'ichi2':
                score = 10
            elif tag == 'news2':
                score = 11
            elif tag.startswith('nf'):
                try:
                    score = 2 + int(tag[2:])
                except ValueError:
                    score = 50
            elif tag in ('spec1', 'gai1'):
                score = 50
            elif tag in ('spec2', 'gai2'):
                score = 60

            if knp.kid not in priority_by_kid or score < priority_by_kid[knp.kid]:
                priority_by_kid[knp.kid] = score

        # Build the index
        index: list[tuple[str, str, list[str], str | None, int]] = []
        seen = set()

        for idseq, kana_list in kana_by_id.items():
            if not kana_list:
                continue

            # Get first kana reading
            first_kana = kana_list[0]
            reading = first_kana.text

            # Get word (kanji if available, else kana)
            kanji_list = kanji_by_id.get(idseq, [])
            word = kanji_list[0] if kanji_list else reading

            key = (word, reading)
            if key in seen:
                continue
            seen.add(key)

            # Get meanings from senses
            meanings = []
            senses = sense_by_idseq.get(idseq, [])
            for sense in senses[:3]:
                glosses = gloss_by_sid.get(sense.ID, [])
                if glosses:
                    meanings.append(", ".join(glosses[:3]))

            if not meanings:
                continue

            # Get priority score (lower = more common)
            priority = priority_by_kid.get(first_kana.ID, 100)

            index.append((reading, word, meanings, None, priority))

        # Sort by reading (primary) for binary search, priority preserved per-entry
        index.sort(key=lambda x: x[0])
        _japanese_word_index = index
        print(f"Japanese word index built: {len(index)} entries in {time.time() - start:.1f}s")

    except Exception as e:
        print(f"Failed to build Japanese index: {e}")
        import traceback
        traceback.print_exc()
        _japanese_word_index = []

    return _japanese_word_index


def search_japanese(query: str, limit: int) -> list[DictionaryEntry]:
    """Search Japanese dictionary using in-memory index. Supports romaji input.

    Results are sorted by word frequency (most common words first).
    """
    import bisect

    # Convert romaji to hiragana if needed
    search_query = query
    if is_romaji(query):
        search_query = convert_romaji_to_hiragana(query)

    index = build_japanese_index()
    if not index:
        return []

    matches: list[tuple[int, str, str, list[str], str | None]] = []  # (priority, reading, word, meanings, pos)
    seen_words = set()

    # Binary search for prefix matches on reading
    left = bisect.bisect_left(index, (search_query,))

    for i in range(left, min(left + limit * 10, len(index))):
        reading, word, meanings, pos, priority = index[i]

        # Stop if we've passed the prefix
        if not reading.startswith(search_query):
            break

        if word in seen_words:
            continue
        seen_words.add(word)

        matches.append((priority, reading, word, meanings, pos))

    # Also search by kanji/word if query might contain kanji
    if not search_query.isascii():
        for reading, word, meanings, pos, priority in index:
            if word.startswith(query) and word not in seen_words:
                seen_words.add(word)
                matches.append((priority, reading, word, meanings, pos))
                if len(matches) >= limit * 10:
                    break

    # Sort by priority (lower = more common) and take top results
    matches.sort(key=lambda x: x[0])

    entries = []
    for priority, reading, word, meanings, pos in matches[:limit]:
        entries.append(DictionaryEntry(
            word=word,
            reading=reading,
            meanings=meanings,
            partOfSpeech=pos,
        ))

    return entries


def build_english_index() -> list[tuple[str, list[str], str | None]]:
    """Build in-memory index of English words for fast prefix search."""
    global _english_word_index
    if _english_word_index is not None:
        return _english_word_index

    if not init_wordnet():
        return []

    print("Building English word index (one-time operation)...")
    import time
    start = time.time()

    try:
        import wn

        index: list[tuple[str, list[str], str | None]] = []
        seen = set()
        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}

        for word in wn.words():
            lemma = word.lemma()
            lemma_lower = lemma.lower()

            if lemma_lower in seen:
                continue
            # Skip multi-word entries for autocomplete
            if ' ' in lemma:
                continue
            seen.add(lemma_lower)

            synsets = word.synsets()
            if not synsets:
                continue

            meanings = []
            pos_tags = set()

            for synset in synsets[:3]:
                definition = synset.definition()
                if definition:
                    meanings.append(definition)
                pos_tags.add(synset.pos)

            if not meanings:
                continue

            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p)
            index.append((lemma_lower, meanings[:3], pos if pos else None))

        # Sort alphabetically for binary search
        index.sort(key=lambda x: x[0])
        _english_word_index = index
        print(f"English word index built: {len(index)} entries in {time.time() - start:.1f}s")

    except Exception as e:
        print(f"Failed to build English index: {e}")
        _english_word_index = []

    return _english_word_index


def search_english(query: str, limit: int) -> list[DictionaryEntry]:
    """Search English dictionary using in-memory index."""
    import bisect

    index = build_english_index()
    if not index:
        return []

    query_lower = query.lower()
    entries = []

    # Binary search for prefix matches
    left = bisect.bisect_left(index, (query_lower,))

    for i in range(left, min(left + limit * 2, len(index))):
        word, meanings, pos = index[i]

        if not word.startswith(query_lower):
            break

        entries.append(DictionaryEntry(
            word=word,
            reading="",
            meanings=meanings,
            partOfSpeech=pos,
        ))

        if len(entries) >= limit:
            break

    return entries


def build_french_index() -> list[tuple[str, list[str], str | None]]:
    """Build in-memory index of French words for fast prefix search."""
    global _french_word_index
    if _french_word_index is not None:
        return _french_word_index

    print("Building French word index (one-time operation)...")
    import time
    start = time.time()

    try:
        import wn

        # Ensure French lexicon is loaded
        if not wn.lexicons(lang='fr'):
            try:
                wn.download('omw-fr:1.4')
            except Exception:
                _french_word_index = []
                return []

        # Get English WordNet for definitions
        try:
            en_wordnet = wn.Wordnet(lang='en', lexicon='ewn:2020')
        except Exception:
            en_wordnet = None

        index: list[tuple[str, list[str], str | None]] = []
        seen = set()
        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}

        for word in wn.words(lang='fr'):
            lemma = word.lemma()
            lemma_lower = lemma.lower()

            if lemma_lower in seen:
                continue
            # Skip multi-word entries for autocomplete
            if ' ' in lemma:
                continue
            seen.add(lemma_lower)

            synsets = word.synsets()
            if not synsets:
                continue

            meanings = []
            pos_tags = set()

            for synset in synsets[:3]:
                # French OMW doesn't have definitions - get from English via ILI
                definition = synset.definition()
                if not definition and en_wordnet and synset.ili:
                    en_synsets = list(en_wordnet.synsets(ili=synset.ili))
                    if en_synsets:
                        definition = en_synsets[0].definition()

                if definition:
                    meanings.append(definition)
                pos_tags.add(synset.pos)

            if not meanings:
                continue

            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p)
            index.append((lemma_lower, meanings[:3], pos if pos else None))

        # Sort alphabetically for binary search
        index.sort(key=lambda x: x[0])
        _french_word_index = index
        print(f"French word index built: {len(index)} entries in {time.time() - start:.1f}s")

    except Exception as e:
        print(f"Failed to build French index: {e}")
        _french_word_index = []

    return _french_word_index


def search_french(query: str, limit: int) -> list[DictionaryEntry]:
    """Search French dictionary using in-memory index."""
    import bisect

    index = build_french_index()
    if not index:
        return []

    query_lower = query.lower()
    entries = []

    # Binary search for prefix matches
    left = bisect.bisect_left(index, (query_lower,))

    for i in range(left, min(left + limit * 2, len(index))):
        word, meanings, pos = index[i]

        if not word.startswith(query_lower):
            break

        entries.append(DictionaryEntry(
            word=word,
            reading="",
            meanings=meanings,
            partOfSpeech=pos,
        ))

        if len(entries) >= limit:
            break

    return entries


@router.get("/dictionary/{word}", response_model=DictionaryResponse)
async def lookup_word(word: str):
    """Look up a Japanese word using Jisho API (legacy endpoint)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://jisho.org/api/v1/search/words",
                params={"keyword": word},
            )
            response.raise_for_status()
            data = response.json()

        entries = []
        for item in data.get("data", [])[:3]:
            japanese = item.get("japanese", [{}])[0]
            word_text = japanese.get("word", japanese.get("reading", ""))
            reading = japanese.get("reading", word_text)

            senses = item.get("senses", [])
            meanings = []
            parts_of_speech = []

            for sense in senses[:3]:
                english_defs = sense.get("english_definitions", [])
                if english_defs:
                    meanings.append(", ".join(english_defs[:3]))
                pos = sense.get("parts_of_speech", [])
                if pos:
                    parts_of_speech.extend(pos)

            parts_of_speech = list(dict.fromkeys(parts_of_speech))[:2]

            if meanings:
                entries.append(DictionaryEntry(
                    word=word_text,
                    reading=reading,
                    meanings=meanings,
                    partOfSpeech=", ".join(parts_of_speech) if parts_of_speech else None,
                ))

        return DictionaryResponse(entries=entries)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Dictionary lookup timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Dictionary lookup failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/dictionary/search/{query}", response_model=DictionaryResponse)
async def search_dictionary(
    query: str,
    language: Literal["japanese", "english", "french"] = Query(default="japanese"),
    limit: int = Query(default=10, le=50),
):
    """Search dictionary by language. Uses local dictionaries where possible."""
    try:
        if language == "japanese":
            entries = search_japanese(query, limit)
        elif language == "english":
            entries = search_english(query, limit)
        elif language == "french":
            entries = search_french(query, limit)
        else:
            entries = []

        return DictionaryResponse(entries=entries)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary search failed: {str(e)}")

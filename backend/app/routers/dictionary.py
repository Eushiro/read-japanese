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


def search_japanese(query: str, limit: int) -> list[DictionaryEntry]:
    """Search Japanese dictionary using jamdict. Supports romaji input."""
    jmd = get_jamdict()
    if jmd is None:
        return []

    entries = []
    seen_words = set()

    # Convert romaji to hiragana if input appears to be romaji
    search_query = query
    if is_romaji(query):
        search_query = convert_romaji_to_hiragana(query)

    try:
        results = jmd.lookup(f'{search_query}%', strict_lookup=False)

        for entry in results.entries[:limit * 2]:
            # Use kanji_forms and kana_forms (jamdict API)
            if entry.kanji_forms:
                word = str(entry.kanji_forms[0])
            elif entry.kana_forms:
                word = str(entry.kana_forms[0])
            else:
                continue

            if word in seen_words:
                continue
            seen_words.add(word)

            reading = str(entry.kana_forms[0]) if entry.kana_forms else ""

            meanings = []
            for sense in entry.senses[:3]:
                gloss_texts = [g.text for g in sense.gloss if hasattr(g, 'text') and g.text]
                if gloss_texts:
                    meanings.append(", ".join(gloss_texts[:3]))

            pos = None
            if entry.senses and entry.senses[0].pos:
                pos = ", ".join(str(p) for p in entry.senses[0].pos[:2])

            if meanings:
                entries.append(DictionaryEntry(
                    word=word,
                    reading=reading,
                    meanings=meanings,
                    partOfSpeech=pos,
                ))

            if len(entries) >= limit:
                break
    except Exception as e:
        print(f"Japanese search error: {e}")
        import traceback
        traceback.print_exc()

    return entries


def search_english(query: str, limit: int) -> list[DictionaryEntry]:
    """Search English dictionary using WordNet."""
    if not init_wordnet():
        return []

    try:
        import wn

        entries = []
        seen_words = set()
        query_lower = query.lower()

        # First, try exact match
        exact_matches = list(wn.words(query_lower))

        # Then collect prefix matches, prioritizing single words
        all_matches = []
        for word in wn.words():
            lemma = word.lemma()
            if lemma.lower().startswith(query_lower) and word not in exact_matches:
                # Prioritize single words (no spaces)
                has_space = ' ' in lemma
                all_matches.append((has_space, lemma, word))

        # Sort: exact matches first, then single words, then multi-word
        all_matches.sort(key=lambda x: (x[0], x[1]))

        # Combine exact matches + sorted prefix matches
        words_to_process = exact_matches + [m[2] for m in all_matches]

        for word in words_to_process[:limit * 3]:
            lemma = word.lemma()
            if lemma in seen_words:
                continue
            seen_words.add(lemma)

            synsets = word.synsets()
            if not synsets:
                continue

            meanings = []
            pos_tags = set()

            for synset in synsets[:3]:
                definition = synset.definition()
                if definition:
                    meanings.append(definition)
                pos_tags.add(synset.pos)  # pos is a property, not a method

            pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p)

            if meanings:
                entries.append(DictionaryEntry(
                    word=lemma,
                    reading="",
                    meanings=meanings[:3],
                    partOfSpeech=pos if pos else None,
                ))

            if len(entries) >= limit:
                break

    except Exception as e:
        print(f"English search error: {e}")
        import traceback
        traceback.print_exc()

    return entries


def search_french(query: str, limit: int) -> list[DictionaryEntry]:
    """Search French dictionary using WordNet (Open Multilingual Wordnet - French)."""
    try:
        import wn

        # Ensure French lexicon is loaded
        if not wn.lexicons(lang='fr'):
            try:
                wn.download('omw-fr:1.4')
            except Exception:
                return []

        # Get English WordNet for definitions (French OMW links to English via ILI)
        try:
            en_wordnet = wn.Wordnet(lang='en', lexicon='ewn:2020')
        except Exception:
            en_wordnet = None

        entries = []
        seen_words = set()
        query_lower = query.lower()

        # First, try exact match
        exact_matches = list(wn.words(query_lower, lang='fr'))

        # Then collect prefix matches
        all_matches = []
        for word in wn.words(lang='fr'):
            lemma = word.lemma()
            if lemma.lower().startswith(query_lower) and word not in exact_matches:
                has_space = ' ' in lemma
                all_matches.append((has_space, lemma, word))

        all_matches.sort(key=lambda x: (x[0], x[1]))
        words_to_process = exact_matches + [m[2] for m in all_matches]

        for word in words_to_process[:limit * 3]:
            lemma = word.lemma()
            if lemma in seen_words:
                continue
            seen_words.add(lemma)

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

            pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p)

            if meanings:
                entries.append(DictionaryEntry(
                    word=lemma,
                    reading="",
                    meanings=meanings[:3],
                    partOfSpeech=pos if pos else None,
                ))

            if len(entries) >= limit:
                break

    except Exception as e:
        print(f"French search error: {e}")
        import traceback
        traceback.print_exc()

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

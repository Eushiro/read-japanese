"""Dictionary lookup endpoint - multi-language support with local dictionaries.

Uses in-memory cache of top 15k words per language for fast autocomplete.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal
import sqlite3
from pathlib import Path

router = APIRouter()

# In-memory word cache for fast autocomplete (15k words per language)
CACHE_SIZE = 15000
_english_cache: list[dict] | None = None
_french_cache: list[dict] | None = None


class DictionaryEntry(BaseModel):
    word: str
    reading: str
    meanings: list[str]
    partOfSpeech: str | None = None


class DictionaryResponse(BaseModel):
    entries: list[DictionaryEntry]


# Singleton instance for jamdict (lazy loaded)
_jamdict_instance = None


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


def convert_romaji_to_hiragana(text: str) -> str:
    """Convert romaji to hiragana using wanakana-python library."""
    try:
        import wanakana
        if wanakana.is_romaji(text):
            return wanakana.to_hiragana(text)
        return text
    except Exception:
        return text


def is_romaji(text: str) -> bool:
    """Check if text appears to be romaji."""
    try:
        import wanakana
        return wanakana.is_romaji(text)
    except Exception:
        return all(c.isascii() and (c.isalpha() or c in "'-") for c in text) and len(text) > 0


def get_wn_db_path() -> Path | None:
    """Get the path to the wn SQLite database."""
    try:
        bundled = Path(__file__).parent.parent / "data" / "wn.db"
        if bundled.exists():
            return bundled
        wn_data = Path.home() / ".wn_data" / "wn.db"
        if wn_data.exists():
            return wn_data
    except Exception:
        pass
    return None


def load_english_cache() -> list[dict]:
    """Load top 15k English words into memory."""
    global _english_cache
    if _english_cache is not None:
        return _english_cache

    db_path = get_wn_db_path()
    if not db_path:
        _english_cache = []
        return _english_cache

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Get top words by frequency, with definitions
        cursor.execute("""
            SELECT f.form,
                   GROUP_CONCAT(d.definition, '|||'),
                   GROUP_CONCAT(e.pos, ','),
                   COALESCE(wf.frequency, 0) as freq
            FROM forms f
            JOIN entries e ON f.entry_rowid = e.rowid
            JOIN senses s ON s.entry_rowid = e.rowid
            JOIN definitions d ON d.synset_rowid = s.synset_rowid
            JOIN lexicons l ON f.lexicon_rowid = l.rowid
            LEFT JOIN word_frequencies wf ON LOWER(f.form) = wf.word AND wf.lang = 'en'
            WHERE l.language = 'en'
              AND f.form NOT LIKE '% %'
              AND LENGTH(f.form) > 1
            GROUP BY f.form
            ORDER BY freq DESC, LENGTH(f.form)
            LIMIT ?
        """, (CACHE_SIZE,))

        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
        _english_cache = []

        for row in cursor.fetchall():
            word, definitions_str, pos_str, _ = row
            if not definitions_str:
                continue

            meanings = definitions_str.split('|||')[:2]
            pos_tags = set(pos_str.split(',')) if pos_str else set()
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p and p in pos_map)

            _english_cache.append({
                'word': word,
                'word_lower': word.lower(),
                'meanings': meanings,
                'pos': pos if pos else None,
            })

        conn.close()
        print(f"Loaded {len(_english_cache)} English words into cache")
        return _english_cache

    except Exception as e:
        print(f"Failed to load English cache: {e}")
        _english_cache = []
        return _english_cache


def load_french_cache() -> list[dict]:
    """Load top 15k French words into memory."""
    global _french_cache
    if _french_cache is not None:
        return _french_cache

    db_path = get_wn_db_path()
    if not db_path:
        _french_cache = []
        return _french_cache

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Get top French words by frequency, with English definitions via ILI
        cursor.execute("""
            SELECT f.form,
                   GROUP_CONCAT(en_d.definition, '|||'),
                   GROUP_CONCAT(e.pos, ','),
                   COALESCE(wf.frequency, 0) as freq
            FROM forms f
            JOIN entries e ON f.entry_rowid = e.rowid
            JOIN senses s ON s.entry_rowid = e.rowid
            JOIN synsets syn ON s.synset_rowid = syn.rowid
            JOIN lexicons l ON f.lexicon_rowid = l.rowid
            LEFT JOIN ilis i ON syn.ili_rowid = i.rowid
            LEFT JOIN synsets en_syn ON en_syn.ili_rowid = i.rowid
            LEFT JOIN lexicons en_l ON en_syn.lexicon_rowid = en_l.rowid AND en_l.language = 'en'
            LEFT JOIN definitions en_d ON en_d.synset_rowid = en_syn.rowid
            LEFT JOIN word_frequencies wf ON LOWER(f.form) = wf.word AND wf.lang = 'fr'
            WHERE l.language = 'fr'
              AND f.form NOT LIKE '% %'
              AND LENGTH(f.form) > 1
            GROUP BY f.form
            HAVING GROUP_CONCAT(en_d.definition, '|||') IS NOT NULL
            ORDER BY freq DESC, LENGTH(f.form)
            LIMIT ?
        """, (CACHE_SIZE,))

        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
        _french_cache = []

        for row in cursor.fetchall():
            word, definitions_str, pos_str, _ = row
            if not definitions_str:
                continue

            meanings = [m for m in definitions_str.split('|||')[:2] if m]
            if not meanings:
                continue

            pos_tags = set(pos_str.split(',')) if pos_str else set()
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p and p in pos_map)

            _french_cache.append({
                'word': word,
                'word_lower': word.lower(),
                'meanings': meanings,
                'pos': pos if pos else None,
            })

        conn.close()
        print(f"Loaded {len(_french_cache)} French words into cache")
        return _french_cache

    except Exception as e:
        print(f"Failed to load French cache: {e}")
        _french_cache = []
        return _french_cache


def search_english_memory(query: str, limit: int) -> list[DictionaryEntry]:
    """Search English dictionary using in-memory cache."""
    cache = load_english_cache()
    query_lower = query.lower()

    results = []
    for item in cache:
        if item['word_lower'].startswith(query_lower):
            results.append(DictionaryEntry(
                word=item['word'],
                reading="",
                meanings=item['meanings'],
                partOfSpeech=item['pos'],
            ))
            if len(results) >= limit:
                break

    return results


def search_french_memory(query: str, limit: int) -> list[DictionaryEntry]:
    """Search French dictionary using in-memory cache."""
    cache = load_french_cache()
    query_lower = query.lower()

    results = []
    for item in cache:
        if item['word_lower'].startswith(query_lower):
            results.append(DictionaryEntry(
                word=item['word'],
                reading="",
                meanings=item['meanings'],
                partOfSpeech=item['pos'],
            ))
            if len(results) >= limit:
                break

    return results


def lookup_japanese_exact(word: str) -> list[DictionaryEntry]:
    """Look up a Japanese word using jamdict (exact match)."""
    jmd = get_jamdict()
    if jmd is None:
        return []

    try:
        result = jmd.lookup(word)
        entries = []

        for entry in result.entries[:3]:
            word_text = ""
            reading = ""

            if entry.kanji_forms:
                word_text = entry.kanji_forms[0].text
            if entry.kana_forms:
                reading = entry.kana_forms[0].text
                if not word_text:
                    word_text = reading

            meanings = []
            parts_of_speech = set()

            for sense in entry.senses[:3]:
                if sense.gloss:
                    gloss_texts = [g.text for g in sense.gloss if g.text]
                    if gloss_texts:
                        meanings.append(", ".join(gloss_texts[:3]))
                if sense.pos:
                    parts_of_speech.update(sense.pos)

            if meanings:
                entries.append(DictionaryEntry(
                    word=word_text,
                    reading=reading,
                    meanings=meanings,
                    partOfSpeech=", ".join(list(parts_of_speech)[:2]) if parts_of_speech else None,
                ))

        return entries

    except Exception as e:
        print(f"Japanese lookup error: {e}")
        return []


def search_japanese(query: str, limit: int) -> list[DictionaryEntry]:
    """Search Japanese dictionary using jamdict's efficient lookup."""
    jmd = get_jamdict()
    if jmd is None:
        return []

    # Convert romaji to hiragana if needed
    search_query = query
    if is_romaji(query):
        search_query = convert_romaji_to_hiragana(query)

    try:
        # Use jamdict's lookup with wildcards for prefix search
        result = jmd.lookup(f"{search_query}%")

        entries = []
        seen = set()

        for entry in result.entries:
            if len(entries) >= limit:
                break

            word_text = ""
            reading = ""

            if entry.kanji_forms:
                word_text = entry.kanji_forms[0].text
            if entry.kana_forms:
                reading = entry.kana_forms[0].text
                if not word_text:
                    word_text = reading

            # Skip duplicates
            if word_text in seen:
                continue
            seen.add(word_text)

            meanings = []
            parts_of_speech = set()

            for sense in entry.senses[:2]:
                if sense.gloss:
                    gloss_texts = [g.text for g in sense.gloss if g.text]
                    if gloss_texts:
                        meanings.append(", ".join(gloss_texts[:2]))
                if sense.pos:
                    parts_of_speech.update(sense.pos)

            if meanings:
                entries.append(DictionaryEntry(
                    word=word_text,
                    reading=reading,
                    meanings=meanings,
                    partOfSpeech=", ".join(list(parts_of_speech)[:2]) if parts_of_speech else None,
                ))

        return entries

    except Exception as e:
        print(f"Japanese search error: {e}")
        return []


def lookup_english_exact(word: str) -> list[DictionaryEntry]:
    """Look up English word (exact match)."""
    cache = load_english_cache()
    word_lower = word.lower()

    for item in cache:
        if item['word_lower'] == word_lower:
            return [DictionaryEntry(
                word=item['word'],
                reading="",
                meanings=item['meanings'],
                partOfSpeech=item['pos'],
            )]

    return []


def lookup_french_exact(word: str) -> list[DictionaryEntry]:
    """Look up French word (exact match)."""
    cache = load_french_cache()
    word_lower = word.lower()

    for item in cache:
        if item['word_lower'] == word_lower:
            return [DictionaryEntry(
                word=item['word'],
                reading="",
                meanings=item['meanings'],
                partOfSpeech=item['pos'],
            )]

    return []


@router.get("/dictionary/{word}", response_model=DictionaryResponse)
async def lookup_word(
    word: str,
    language: Literal["japanese", "english", "french"] = Query(default="japanese"),
):
    """Look up a word using local dictionaries (exact match)."""
    try:
        if language == "japanese":
            entries = lookup_japanese_exact(word)
        elif language == "english":
            entries = lookup_english_exact(word)
        elif language == "french":
            entries = lookup_french_exact(word)
        else:
            entries = []

        return DictionaryResponse(entries=entries)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary lookup failed: {str(e)}")


@router.get("/dictionary/search/{query}", response_model=DictionaryResponse)
async def search_dictionary(
    query: str,
    language: Literal["japanese", "english", "french"] = Query(default="japanese"),
    limit: int = Query(default=10, le=50),
):
    """Search dictionary by language. Uses in-memory cache for fast autocomplete."""
    try:
        if language == "japanese":
            entries = search_japanese(query, limit)
        elif language == "english":
            entries = search_english_memory(query, limit)
        elif language == "french":
            entries = search_french_memory(query, limit)
        else:
            entries = []

        return DictionaryResponse(entries=entries)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary search failed: {str(e)}")


# Preload caches on module import (optional - can be triggered on first request instead)
def preload_caches():
    """Preload dictionary caches for faster first requests."""
    try:
        load_english_cache()
        load_french_cache()
    except Exception as e:
        print(f"Failed to preload caches: {e}")

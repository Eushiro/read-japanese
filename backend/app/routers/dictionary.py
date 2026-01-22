"""Dictionary lookup endpoint - multi-language support with local dictionaries.

Memory-optimized with efficient SQLite queries for fast prefix search.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal
import sqlite3
from pathlib import Path

router = APIRouter()


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


def get_wn_db_path() -> Path | None:
    """Get the path to the wn SQLite database.

    Checks for bundled database first (with pre-computed frequencies),
    then falls back to user's wn_data directory.
    """
    try:
        # Check for bundled database first (includes frequency data)
        bundled = Path(__file__).parent.parent / "data" / "wn.db"
        if bundled.exists():
            return bundled

        # Fall back to user's wn_data
        wn_data = Path.home() / ".wn_data" / "wn.db"
        if wn_data.exists():
            return wn_data
    except Exception:
        pass
    return None


def ensure_wn_data():
    """Ensure WordNet data is available.

    If using bundled database, no download needed.
    Only downloads if using user's wn_data directory and it's empty.
    """
    # Check if we're using bundled database (already has all data)
    bundled = Path(__file__).parent.parent / "data" / "wn.db"
    if bundled.exists():
        return  # Bundled database has everything

    # Only download if no database exists
    try:
        import wn
        if not wn.lexicons():
            wn.download('ewn:2020')
        if not wn.lexicons(lang='fr'):
            try:
                wn.download('omw-fr:1.4')
            except Exception:
                pass
    except Exception as e:
        print(f"Failed to ensure wn data: {e}")


def search_english_sqlite(query: str, limit: int) -> list[DictionaryEntry]:
    """Search English dictionary using direct SQLite query with frequency sorting."""
    ensure_wn_data()
    db_path = get_wn_db_path()
    if not db_path:
        return []

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        query_lower = query.lower()

        # Query with LEFT JOIN to word_frequencies for sorting by frequency
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
            WHERE f.form LIKE ?
              AND l.language = 'en'
              AND f.form NOT LIKE '% %'
            GROUP BY f.form
            ORDER BY freq DESC, LENGTH(f.form)
            LIMIT ?
        """, (f"{query_lower}%", limit))

        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
        entries = []

        for row in cursor.fetchall():
            word, definitions_str, pos_str, _ = row
            if not definitions_str:
                continue

            meanings = definitions_str.split('|||')[:2]
            pos_tags = set(pos_str.split(',')) if pos_str else set()
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p and p in pos_map)

            entries.append(DictionaryEntry(
                word=word,
                reading="",
                meanings=meanings,
                partOfSpeech=pos if pos else None,
            ))

        conn.close()
        return entries

    except Exception as e:
        print(f"English SQLite search error: {e}")
        return []


def search_french_sqlite(query: str, limit: int) -> list[DictionaryEntry]:
    """Search French dictionary using direct SQLite query with frequency sorting."""
    ensure_wn_data()
    db_path = get_wn_db_path()
    if not db_path:
        return []

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        query_lower = query.lower()

        # For French, get definitions from English via ILI, sort by frequency
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
            WHERE f.form LIKE ?
              AND l.language = 'fr'
              AND f.form NOT LIKE '% %'
            GROUP BY f.form
            ORDER BY freq DESC, LENGTH(f.form)
            LIMIT ?
        """, (f"{query_lower}%", limit))

        pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
        entries = []

        for row in cursor.fetchall():
            word, definitions_str, pos_str, _ = row
            if not definitions_str:
                continue

            meanings = [m for m in definitions_str.split('|||')[:2] if m]
            if not meanings:
                continue

            pos_tags = set(pos_str.split(',')) if pos_str else set()
            pos = ", ".join(pos_map.get(p, p) for p in pos_tags if p and p in pos_map)

            entries.append(DictionaryEntry(
                word=word,
                reading="",
                meanings=meanings,
                partOfSpeech=pos if pos else None,
            ))

        conn.close()
        return entries

    except Exception as e:
        print(f"French SQLite search error: {e}")
        return []


def lookup_english_exact(word: str) -> list[DictionaryEntry]:
    """Look up English word (exact match)."""
    entries = search_english_sqlite(word, 5)
    return [e for e in entries if e.word.lower() == word.lower()][:1]


def lookup_french_exact(word: str) -> list[DictionaryEntry]:
    """Look up French word (exact match)."""
    entries = search_french_sqlite(word, 5)
    return [e for e in entries if e.word.lower() == word.lower()][:1]


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
    """Search dictionary by language. Uses local dictionaries with efficient SQLite queries."""
    try:
        if language == "japanese":
            entries = search_japanese(query, limit)
        elif language == "english":
            entries = search_english_sqlite(query, limit)
        elif language == "french":
            entries = search_french_sqlite(query, limit)
        else:
            entries = []

        return DictionaryResponse(entries=entries)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary search failed: {str(e)}")

#!/usr/bin/env python3
"""Export dictionary data to JSON files for client-side search.

This exports the top 10-15k words per language as compact JSON files
that can be loaded in the browser for instant autocomplete.
"""

import json
import sqlite3
from pathlib import Path
import sys

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent.parent / "web" / "public" / "dictionaries"
CACHE_SIZE = 20000  # Words per language


def get_wn_db_path() -> Path | None:
    """Get the path to the wn SQLite database."""
    bundled = Path(__file__).parent.parent / "app" / "data" / "wn.db"
    if bundled.exists():
        return bundled
    wn_data = Path.home() / ".wn_data" / "wn.db"
    if wn_data.exists():
        return wn_data
    return None


def export_english():
    """Export top English words."""
    db_path = get_wn_db_path()
    if not db_path:
        print("WordNet database not found!")
        return

    print(f"Loading English from {db_path}...")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

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

    pos_map = {'n': 'n', 'v': 'v', 'a': 'adj', 's': 'adj', 'r': 'adv'}
    words = []

    for row in cursor.fetchall():
        word, definitions_str, pos_str, _ = row
        if not definitions_str:
            continue

        # Take first 2 meanings, truncate to save space
        meanings = [m[:100] for m in definitions_str.split('|||')[:2] if m]
        if not meanings:
            continue

        pos_tags = set(pos_str.split(',')) if pos_str else set()
        pos = next((pos_map.get(p) for p in pos_tags if p in pos_map), None)

        # Compact format: [word, meanings_array, pos_or_null]
        entry = [word, meanings]
        if pos:
            entry.append(pos)
        words.append(entry)

    conn.close()

    # Save as compact JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "en.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = output_file.stat().st_size / 1024
    print(f"Exported {len(words)} English words to {output_file} ({size_kb:.1f} KB)")


def export_french():
    """Export top French words with English definitions."""
    db_path = get_wn_db_path()
    if not db_path:
        print("WordNet database not found!")
        return

    print(f"Loading French from {db_path}...")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

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

    pos_map = {'n': 'n', 'v': 'v', 'a': 'adj', 's': 'adj', 'r': 'adv'}
    words = []

    for row in cursor.fetchall():
        word, definitions_str, pos_str, _ = row
        if not definitions_str:
            continue

        meanings = [m[:100] for m in definitions_str.split('|||')[:2] if m]
        if not meanings:
            continue

        pos_tags = set(pos_str.split(',')) if pos_str else set()
        pos = next((pos_map.get(p) for p in pos_tags if p in pos_map), None)

        entry = [word, meanings]
        if pos:
            entry.append(pos)
        words.append(entry)

    conn.close()

    output_file = OUTPUT_DIR / "fr.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = output_file.stat().st_size / 1024
    print(f"Exported {len(words)} French words to {output_file} ({size_kb:.1f} KB)")


def export_japanese():
    """Export Japanese words from jamdict using efficient direct database access."""
    try:
        from jamdict import Jamdict
        import sqlite3 as jamdict_sqlite
    except ImportError:
        print("jamdict not installed, skipping Japanese export")
        return

    print("Loading Japanese from jamdict database...")
    jmd = Jamdict()

    # Access jamdict's internal database directly for efficiency
    # This is much faster than doing prefix searches
    db_path = None
    try:
        # Find jamdict database path - check multiple locations
        import jamdict
        from pathlib import Path

        possible_paths = [
            Path(jamdict.__file__).parent / "data" / "jamdict.db",
            Path.home() / ".jamdict" / "data" / "jamdict.db",
            # jamdict_data package installs here
            Path(jamdict.__file__).parent.parent / "jamdict_data" / "jamdict.db",
        ]

        # Also try to find jamdict_data package directly
        try:
            import jamdict_data
            possible_paths.insert(0, Path(jamdict_data.__file__).parent / "jamdict.db")
        except ImportError:
            pass

        for p in possible_paths:
            if p.exists():
                db_path = p
                break

        if not db_path:
            print(f"Searched paths: {possible_paths}")
    except Exception as e:
        print(f"Could not find jamdict database: {e}")

    if not db_path:
        print("jamdict database not found, using search method (slower)...")
        export_japanese_search_method()
        return

    try:
        conn = jamdict_sqlite.connect(str(db_path))
        cursor = conn.cursor()

        # Get entries with kanji and kana forms, prioritizing common words
        # JMdict uses priority markers: ichi1 (top 10k), news1 (newspaper common), nfXX (frequency rank)
        # KJP = Kanji Priority, KNP = Kana Priority
        cursor.execute("""
            SELECT DISTINCT
                k.text as kanji,
                r.text as reading,
                GROUP_CONCAT(DISTINCT g.text, '|||') as glosses,
                MAX(CASE
                    WHEN COALESCE(kp.text, knp.text) = 'ichi1' THEN 100
                    WHEN COALESCE(kp.text, knp.text) = 'news1' THEN 90
                    WHEN COALESCE(kp.text, knp.text) LIKE 'nf%' THEN 80 - CAST(SUBSTR(COALESCE(kp.text, knp.text), 3) AS INTEGER)
                    WHEN COALESCE(kp.text, knp.text) = 'ichi2' THEN 50
                    WHEN COALESCE(kp.text, knp.text) = 'news2' THEN 40
                    ELSE 0
                END) as priority
            FROM Entry e
            LEFT JOIN Kanji k ON k.entry_id = e.id
            LEFT JOIN Kana r ON r.entry_id = e.id
            LEFT JOIN KJP kp ON kp.kid = k.ID
            LEFT JOIN KNP knp ON knp.kid = r.ID
            JOIN Sense s ON s.entry_id = e.id
            JOIN SenseGloss g ON g.sense_id = s.id AND g.lang = 'eng'
            WHERE (k.text IS NOT NULL OR r.text IS NOT NULL)
            GROUP BY COALESCE(k.text, r.text), r.text
            ORDER BY priority DESC, LENGTH(COALESCE(k.text, r.text))
            LIMIT ?
        """, (CACHE_SIZE,))

        words = []
        seen = set()

        for row in cursor.fetchall():
            kanji, reading, glosses_str = row
            word_text = kanji or reading or ""
            reading_text = reading or ""

            if not word_text or word_text in seen:
                continue
            seen.add(word_text)

            if not glosses_str:
                continue

            meanings = [m[:80] for m in glosses_str.split('|||')[:2] if m]
            if not meanings:
                continue

            words.append([word_text, reading_text, meanings])

        conn.close()

        output_file = OUTPUT_DIR / "ja.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, separators=(',', ':'))

        size_kb = output_file.stat().st_size / 1024
        print(f"Exported {len(words)} Japanese words to {output_file} ({size_kb:.1f} KB)")

    except Exception as e:
        print(f"Database export failed: {e}")
        print("Falling back to search method...")
        export_japanese_search_method()


def export_japanese_search_method():
    """Fallback: Export Japanese using jamdict search (slower)."""
    try:
        from jamdict import Jamdict
    except ImportError:
        print("jamdict not installed")
        return

    print("Using jamdict search method (this may take a while)...")
    jmd = Jamdict()

    words = []
    seen = set()

    # Use all hiragana as search prefixes
    hiragana = list("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん")

    for char in hiragana:
        if len(words) >= 5000:  # Limit to 5k for speed
            break

        try:
            result = jmd.lookup(f"{char}%")
            for entry in result.entries[:200]:
                if len(words) >= 5000:
                    break

                word_text = ""
                reading = ""

                if entry.kanji_forms:
                    word_text = entry.kanji_forms[0].text
                if entry.kana_forms:
                    reading = entry.kana_forms[0].text
                    if not word_text:
                        word_text = reading

                if not word_text or word_text in seen:
                    continue
                seen.add(word_text)

                meanings = []
                for sense in entry.senses[:2]:
                    if sense.gloss:
                        gloss_texts = [g.text for g in sense.gloss if g.text][:2]
                        if gloss_texts:
                            meanings.append(", ".join(gloss_texts)[:80])

                if meanings:
                    words.append([word_text, reading, meanings])

        except Exception as e:
            print(f"Error searching {char}: {e}")
            continue

    output_file = OUTPUT_DIR / "ja.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = output_file.stat().st_size / 1024
    print(f"Exported {len(words)} Japanese words to {output_file} ({size_kb:.1f} KB)")


def main():
    print("Exporting dictionaries for client-side search...")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    export_english()
    print()
    export_french()
    print()
    export_japanese()
    print()
    print("Done!")


if __name__ == "__main__":
    main()

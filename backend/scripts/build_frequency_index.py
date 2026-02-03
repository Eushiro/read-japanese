#!/usr/bin/env python3
"""
One-time script to add word frequency data to the WordNet SQLite database.

Run this locally (not on the server) to pre-compute frequencies:
    python scripts/build_frequency_index.py

This adds a 'word_frequencies' table to ~/.wn_data/wn.db with frequency scores.
The table can then be JOINed at query time for frequency-sorted results.
"""

import sqlite3
from pathlib import Path


def get_wn_db_path() -> Path:
    """Get the path to the wn SQLite database."""
    return Path.home() / ".wn_data" / "wn.db"


def ensure_wn_data():
    """Ensure WordNet data is downloaded."""
    import wn

    if not wn.lexicons():
        print("Downloading English WordNet...")
        wn.download("ewn:2020")
    if not wn.lexicons(lang="fr"):
        print("Downloading French WordNet...")
        try:
            wn.download("omw-fr:1.4")
        except Exception as e:
            print(f"Failed to download French: {e}")


def build_frequency_table():
    """Build frequency table in the wn database."""
    from wordfreq import word_frequency

    db_path = get_wn_db_path()

    if not db_path.exists():
        print(f"Error: wn database not found at {db_path}")
        return

    print(f"Opening database: {db_path}")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Create frequency table
    print("Creating word_frequencies table...")
    cursor.execute("DROP TABLE IF EXISTS word_frequencies")
    cursor.execute("""
        CREATE TABLE word_frequencies (
            word TEXT PRIMARY KEY,
            lang TEXT,
            frequency REAL
        )
    """)
    cursor.execute("CREATE INDEX idx_freq_word_lang ON word_frequencies(word, lang)")
    cursor.execute("CREATE INDEX idx_freq_frequency ON word_frequencies(frequency DESC)")

    # Get all unique English words from forms table
    print("Fetching English words...")
    cursor.execute("""
        SELECT DISTINCT f.form
        FROM forms f
        JOIN lexicons l ON f.lexicon_rowid = l.rowid
        WHERE l.language = 'en'
          AND f.form NOT LIKE '% %'
    """)
    en_words = [row[0] for row in cursor.fetchall()]
    print(f"Found {len(en_words)} English words")

    # Get frequencies for English words
    print("Computing English frequencies...")
    en_freqs = []
    for i, word in enumerate(en_words):
        freq = word_frequency(word.lower(), "en")
        if freq > 0:
            en_freqs.append((word.lower(), "en", freq))
        if (i + 1) % 10000 == 0:
            print(f"  Processed {i + 1}/{len(en_words)} English words...")

    print(f"Inserting {len(en_freqs)} English frequencies...")
    cursor.executemany(
        "INSERT OR REPLACE INTO word_frequencies (word, lang, frequency) VALUES (?, ?, ?)", en_freqs
    )

    # Get all unique French words
    print("Fetching French words...")
    cursor.execute("""
        SELECT DISTINCT f.form
        FROM forms f
        JOIN lexicons l ON f.lexicon_rowid = l.rowid
        WHERE l.language = 'fr'
          AND f.form NOT LIKE '% %'
    """)
    fr_words = [row[0] for row in cursor.fetchall()]
    print(f"Found {len(fr_words)} French words")

    # Get frequencies for French words
    print("Computing French frequencies...")
    fr_freqs = []
    for i, word in enumerate(fr_words):
        freq = word_frequency(word.lower(), "fr")
        if freq > 0:
            fr_freqs.append((word.lower(), "fr", freq))
        if (i + 1) % 10000 == 0:
            print(f"  Processed {i + 1}/{len(fr_words)} French words...")

    print(f"Inserting {len(fr_freqs)} French frequencies...")
    cursor.executemany(
        "INSERT OR REPLACE INTO word_frequencies (word, lang, frequency) VALUES (?, ?, ?)", fr_freqs
    )

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM word_frequencies WHERE lang = 'en'")
    en_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM word_frequencies WHERE lang = 'fr'")
    fr_count = cursor.fetchone()[0]

    print(f"\nDone! Added frequencies for {en_count} English and {fr_count} French words.")

    # Show some examples
    print("\nTop 10 most frequent English words:")
    cursor.execute("""
        SELECT word, frequency FROM word_frequencies
        WHERE lang = 'en' ORDER BY frequency DESC LIMIT 10
    """)
    for word, freq in cursor.fetchall():
        print(f"  {word}: {freq:.6f}")

    conn.close()
    print(f"\nDatabase updated: {db_path}")


if __name__ == "__main__":
    build_frequency_table()

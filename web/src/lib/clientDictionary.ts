/**
 * Client-side dictionary search for instant autocomplete.
 *
 * Loads dictionary JSON files once and searches in memory.
 * Much faster than server round-trips.
 */

import * as wanakana from "wanakana";

export interface DictionaryEntry {
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string;
}

type Language = "japanese" | "english" | "french";

// Cache for loaded dictionaries
const cache: Record<Language, DictionaryEntry[] | null> = {
  japanese: null,
  english: null,
  french: null,
};

// Loading promises to prevent duplicate fetches
const loadingPromises: Record<Language, Promise<DictionaryEntry[]> | null> = {
  japanese: null,
  english: null,
  french: null,
};

/**
 * Parse compact JSON format into DictionaryEntry objects
 *
 * English/French format: [word, [meanings], pos?]
 * Japanese format: [word, reading, [meanings]]
 */
function parseEntries(data: unknown[], language: Language): DictionaryEntry[] {
  if (language === "japanese") {
    // Japanese: [word, reading, [meanings]]
    return data.map((item) => {
      const arr = item as [string, string, string[]];
      return {
        word: arr[0],
        reading: arr[1] || "",
        meanings: arr[2] || [],
      };
    });
  } else {
    // English/French: [word, [meanings], pos?]
    return data.map((item) => {
      const arr = item as [string, string[], string?];
      return {
        word: arr[0],
        reading: "",
        meanings: arr[1] || [],
        partOfSpeech: arr[2],
      };
    });
  }
}

/**
 * Load dictionary for a language (lazy, cached)
 */
export async function loadDictionary(language: Language): Promise<DictionaryEntry[]> {
  // Return cached if available
  if (cache[language]) {
    return cache[language]!;
  }

  // Return existing promise if already loading
  if (loadingPromises[language]) {
    return loadingPromises[language]!;
  }

  // Start loading
  const langCode = language === "japanese" ? "ja" : language === "english" ? "en" : "fr";

  loadingPromises[language] = fetch(`/dictionaries/${langCode}.json`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${language} dictionary: ${res.status}`);
      }
      return res.json();
    })
    .then((data: unknown[]) => {
      const entries = parseEntries(data, language);
      cache[language] = entries;
      console.log(`Loaded ${entries.length} ${language} words`);
      return entries;
    })
    .catch((err) => {
      console.error(`Failed to load ${language} dictionary:`, err);
      cache[language] = [];
      return [];
    })
    .finally(() => {
      loadingPromises[language] = null;
    });

  return loadingPromises[language]!;
}

/**
 * Preload dictionary (call when modal opens)
 */
export function preloadDictionary(language: Language): void {
  loadDictionary(language).catch(() => {
    // Ignore errors during preload
  });
}

/**
 * Convert romaji to hiragana for Japanese search
 * Returns array of search terms to try (original + conversions)
 */
function getJapaneseSearchTerms(query: string): string[] {
  const terms = [query.toLowerCase()];

  // If input looks like romaji, convert to hiragana and katakana
  if (wanakana.isRomaji(query)) {
    const hiragana = wanakana.toHiragana(query);
    const katakana = wanakana.toKatakana(query);
    if (hiragana !== query) terms.push(hiragana);
    if (katakana !== query && katakana !== hiragana) terms.push(katakana);
  }
  // If input is mixed or already kana, also try conversions
  else if (wanakana.isMixed(query) || wanakana.isKana(query)) {
    const hiragana = wanakana.toHiragana(query);
    const katakana = wanakana.toKatakana(query);
    if (hiragana !== query) terms.push(hiragana);
    if (katakana !== query && katakana !== hiragana) terms.push(katakana);
  }

  return terms;
}

/**
 * Search dictionary for prefix matches
 * Falls back to API for Japanese if local results are insufficient
 */
export async function searchClientDictionary(
  query: string,
  language: Language,
  limit: number = 10
): Promise<DictionaryEntry[]> {
  if (!query.trim()) return [];

  const entries = await loadDictionary(language);

  // For Japanese, get multiple search terms (romaji -> hiragana/katakana)
  const searchTerms = language === "japanese"
    ? getJapaneseSearchTerms(query)
    : [query.toLowerCase()];

  const results: DictionaryEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    // Match word or reading (for Japanese)
    const wordLower = entry.word.toLowerCase();
    const readingLower = entry.reading?.toLowerCase() || "";

    // Check if any search term matches
    const matches = searchTerms.some(term =>
      wordLower.startsWith(term) || readingLower.startsWith(term)
    );

    if (matches && !seen.has(entry.word)) {
      results.push(entry);
      seen.add(entry.word);
      if (results.length >= limit) break;
    }
  }

  // For Japanese, if we have few results, try API fallback
  // This provides better coverage while local dictionary is small
  if (language === "japanese" && results.length < 3 && query.length >= 1) {
    try {
      // Use hiragana conversion for API if romaji was entered
      const apiQuery = wanakana.isRomaji(query) ? wanakana.toHiragana(query) : query;
      const apiResults = await fetchFromAPI(apiQuery, language, limit);
      // Merge results, avoiding duplicates
      for (const entry of apiResults) {
        if (!seen.has(entry.word)) {
          results.push(entry);
          seen.add(entry.word);
        }
        if (results.length >= limit) break;
      }
    } catch (err) {
      // API fallback failed, use local results only
      console.debug("API fallback failed:", err);
    }
  }

  return results;
}

/**
 * Fallback to API for languages with limited local data
 */
async function fetchFromAPI(
  query: string,
  language: Language,
  limit: number
): Promise<DictionaryEntry[]> {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://read-japanese.onrender.com";
  const response = await fetch(
    `${API_BASE}/api/dictionary/search/${encodeURIComponent(query)}?language=${language}&limit=${limit}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.entries || []) as DictionaryEntry[];
}

/**
 * Check if dictionary is loaded for a language
 */
export function isDictionaryLoaded(language: Language): boolean {
  return cache[language] !== null;
}

/**
 * Get dictionary loading status
 */
export function isDictionaryLoading(language: Language): boolean {
  return loadingPromises[language] !== null;
}

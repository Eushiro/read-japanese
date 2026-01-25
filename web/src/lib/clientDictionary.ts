/**
 * Client-side dictionary search for instant autocomplete.
 *
 * Loads dictionary JSON files once and searches in memory.
 * Much faster than server round-trips.
 *
 * Dictionaries are served from R2 (VITE_R2_PUBLIC_URL) for cost optimization.
 */

import * as wanakana from "wanakana";

import type { ContentLanguage } from "@/lib/contentLanguages";

// R2 base URL from environment, falls back to local /dictionaries for development
const R2_BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";

export interface DictionaryEntry {
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string;
}

// Cache for loaded dictionaries
const cache: Record<ContentLanguage, DictionaryEntry[] | null> = {
  japanese: null,
  english: null,
  french: null,
};

// Loading promises to prevent duplicate fetches
const loadingPromises: Record<ContentLanguage, Promise<DictionaryEntry[]> | null> = {
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
function parseEntries(data: unknown[], language: ContentLanguage): DictionaryEntry[] {
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
export async function loadDictionary(language: ContentLanguage): Promise<DictionaryEntry[]> {
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
  const dictionaryUrl = R2_BASE_URL
    ? `${R2_BASE_URL}/dictionaries/${langCode}.json`
    : `/dictionaries/${langCode}.json`;

  loadingPromises[language] = fetch(dictionaryUrl)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${language} dictionary: ${res.status}`);
      }
      return res.json();
    })
    .then((data: unknown[]) => {
      const entries = parseEntries(data, language);
      cache[language] = entries;
      // Dictionary loaded successfully
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
export function preloadDictionary(language: ContentLanguage): void {
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
  language: ContentLanguage,
  limit: number = 10
): Promise<DictionaryEntry[]> {
  if (!query.trim()) return [];

  const entries = await loadDictionary(language);

  // For Japanese, get multiple search terms (romaji -> hiragana/katakana)
  const searchTerms =
    language === "japanese" ? getJapaneseSearchTerms(query) : [query.toLowerCase()];

  const results: DictionaryEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    // Match word or reading (for Japanese)
    const wordLower = entry.word.toLowerCase();
    const readingLower = entry.reading?.toLowerCase() || "";

    // Check if any search term matches
    const matches = searchTerms.some(
      (term) => wordLower.startsWith(term) || readingLower.startsWith(term)
    );

    if (matches && !seen.has(entry.word)) {
      results.push(entry);
      seen.add(entry.word);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Check if dictionary is loaded for a language
 */
export function isDictionaryLoaded(language: ContentLanguage): boolean {
  return cache[language] !== null;
}

/**
 * Get dictionary loading status
 */
export function isDictionaryLoading(language: ContentLanguage): boolean {
  return loadingPromises[language] !== null;
}

/**
 * Client-side dictionary search for instant autocomplete.
 *
 * Loads dictionary JSON files once and searches in memory.
 * Much faster than server round-trips.
 *
 * Dictionaries are served from R2 (VITE_R2_PUBLIC_URL) for cost optimization.
 *
 * Dictionary naming convention:
 * - Language-pair dictionaries: `{contentLang}-{uiLang}.json` (e.g., `ja-en.json`)
 * - Fallback to legacy single-language: `{langCode}.json` (e.g., `ja.json`)
 */

import * as wanakana from "wanakana";

import type { ContentLanguage } from "@/lib/contentLanguages";
import type { UILanguage } from "@/lib/i18n/types";

// R2 base URL from environment, falls back to local /dictionaries for development
const R2_BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";

export interface DictionaryEntry {
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string;
}

// Cache key for language-pair dictionaries
type DictionaryCacheKey = `${ContentLanguage}-${UILanguage}`;

// Cache for loaded dictionaries (keyed by content-ui language pair)
const pairCache: Record<string, DictionaryEntry[] | null> = {};

// Loading promises to prevent duplicate fetches
const pairLoadingPromises: Record<string, Promise<DictionaryEntry[]> | null> = {};

// Legacy cache for single-language dictionaries (fallback)
const legacyCache: Record<ContentLanguage, DictionaryEntry[] | null> = {
  japanese: null,
  english: null,
  french: null,
};

const legacyLoadingPromises: Record<ContentLanguage, Promise<DictionaryEntry[]> | null> = {
  japanese: null,
  english: null,
  french: null,
};

/**
 * Convert content language to language code
 */
function contentLangToCode(language: ContentLanguage): string {
  return language === "japanese" ? "ja" : language === "english" ? "en" : "fr";
}

/**
 * Parse compact JSON format into DictionaryEntry objects
 *
 * English/French format: [word, [meanings], pos?]
 * Japanese format: [word, reading, [meanings]]
 */
function parseEntries(data: unknown[], contentLanguage: ContentLanguage): DictionaryEntry[] {
  if (contentLanguage === "japanese") {
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
 * Load language-pair dictionary (e.g., ja-en.json for Japanese words with English meanings)
 * Falls back to legacy single-language dictionary if pair dictionary doesn't exist.
 */
export async function loadDictionary(
  contentLanguage: ContentLanguage,
  uiLanguage: UILanguage
): Promise<DictionaryEntry[]> {
  const cacheKey: DictionaryCacheKey = `${contentLanguage}-${uiLanguage}`;

  // Return cached if available
  if (pairCache[cacheKey]) {
    return pairCache[cacheKey]!;
  }

  // Return existing promise if already loading
  if (pairLoadingPromises[cacheKey]) {
    return pairLoadingPromises[cacheKey]!;
  }

  const contentCode = contentLangToCode(contentLanguage);

  // Try language-pair dictionary first
  const pairUrl = R2_BASE_URL
    ? `${R2_BASE_URL}/dictionaries/${contentCode}-${uiLanguage}.json`
    : `/dictionaries/${contentCode}-${uiLanguage}.json`;

  pairLoadingPromises[cacheKey] = fetch(pairUrl)
    .then((res) => {
      if (!res.ok) {
        // Fall back to legacy single-language dictionary
        return loadLegacyDictionary(contentLanguage);
      }
      return res.json();
    })
    .then((data: unknown[] | DictionaryEntry[]) => {
      // If we got DictionaryEntry[] from legacy fallback, use directly
      const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (firstItem && typeof firstItem === "object" && "word" in firstItem) {
        pairCache[cacheKey] = data as DictionaryEntry[];
        return data as DictionaryEntry[];
      }
      // Parse compact format
      const entries = parseEntries(data as unknown[], contentLanguage);
      pairCache[cacheKey] = entries;
      return entries;
    })
    .catch((err) => {
      console.error(`Failed to load ${cacheKey} dictionary:`, err);
      // Try legacy fallback
      return loadLegacyDictionary(contentLanguage);
    })
    .finally(() => {
      pairLoadingPromises[cacheKey] = null;
    });

  return pairLoadingPromises[cacheKey]!;
}

/**
 * Load legacy single-language dictionary (fallback)
 */
async function loadLegacyDictionary(language: ContentLanguage): Promise<DictionaryEntry[]> {
  // Return cached if available
  if (legacyCache[language]) {
    return legacyCache[language]!;
  }

  // Return existing promise if already loading
  if (legacyLoadingPromises[language]) {
    return legacyLoadingPromises[language]!;
  }

  const langCode = contentLangToCode(language);
  const dictionaryUrl = R2_BASE_URL
    ? `${R2_BASE_URL}/dictionaries/${langCode}.json`
    : `/dictionaries/${langCode}.json`;

  legacyLoadingPromises[language] = fetch(dictionaryUrl)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ${language} dictionary: ${res.status}`);
      }
      return res.json();
    })
    .then((data: unknown[]) => {
      const entries = parseEntries(data, language);
      legacyCache[language] = entries;
      return entries;
    })
    .catch((err) => {
      console.error(`Failed to load ${language} dictionary:`, err);
      legacyCache[language] = [];
      return [];
    })
    .finally(() => {
      legacyLoadingPromises[language] = null;
    });

  return legacyLoadingPromises[language]!;
}

/**
 * Preload dictionary (call when modal opens)
 */
export function preloadDictionary(
  contentLanguage: ContentLanguage,
  uiLanguage: UILanguage = "en"
): void {
  loadDictionary(contentLanguage, uiLanguage).catch(() => {
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
 * Uses language-pair dictionary to show meanings in user's UI language.
 */
export async function searchClientDictionary(
  query: string,
  contentLanguage: ContentLanguage,
  uiLanguage: UILanguage,
  limit: number
): Promise<DictionaryEntry[]> {
  if (!query.trim()) return [];

  const entries = await loadDictionary(contentLanguage, uiLanguage);

  // For Japanese, get multiple search terms (romaji -> hiragana/katakana)
  const searchTerms =
    contentLanguage === "japanese" ? getJapaneseSearchTerms(query) : [query.toLowerCase()];

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
 * Check if dictionary is loaded for a language pair
 */
export function isDictionaryLoaded(
  contentLanguage: ContentLanguage,
  uiLanguage: UILanguage = "en"
): boolean {
  const cacheKey: DictionaryCacheKey = `${contentLanguage}-${uiLanguage}`;
  return pairCache[cacheKey] !== null || legacyCache[contentLanguage] !== null;
}

/**
 * Get dictionary loading status
 */
export function isDictionaryLoading(
  contentLanguage: ContentLanguage,
  uiLanguage: UILanguage = "en"
): boolean {
  const cacheKey: DictionaryCacheKey = `${contentLanguage}-${uiLanguage}`;
  return pairLoadingPromises[cacheKey] !== null || legacyLoadingPromises[contentLanguage] !== null;
}

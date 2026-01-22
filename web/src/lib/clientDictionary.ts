/**
 * Client-side dictionary search for instant autocomplete.
 *
 * Loads dictionary JSON files once and searches in memory.
 * Much faster than server round-trips.
 */

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
  const queryLower = query.toLowerCase();

  const results: DictionaryEntry[] = [];

  for (const entry of entries) {
    // Match word or reading (for Japanese)
    const wordLower = entry.word.toLowerCase();
    const readingLower = entry.reading?.toLowerCase() || "";

    if (wordLower.startsWith(queryLower) || readingLower.startsWith(queryLower)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }

  // For Japanese, if we have few results, try API fallback
  // This provides better coverage while local dictionary is small
  if (language === "japanese" && results.length < 3 && query.length >= 1) {
    try {
      const apiResults = await fetchFromAPI(query, language, limit);
      // Merge results, avoiding duplicates
      const seen = new Set(results.map(r => r.word));
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

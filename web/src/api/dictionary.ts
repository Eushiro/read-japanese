import { apiClient } from "./client";

// Simplified dictionary entry for the popup
export interface DictionaryEntry {
  word: string;
  reading: string;
  meanings: string[];
  partOfSpeech?: string;
}

interface DictionaryResponse {
  entries: DictionaryEntry[];
}

// Look up a word using our backend proxy (avoids CORS issues)
export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  try {
    const response = await apiClient.get<DictionaryResponse>(
      `/api/dictionary/${encodeURIComponent(word)}`
    );

    if (!response.entries || response.entries.length === 0) {
      return null;
    }

    // Return the first (best) match
    return response.entries[0];
  } catch (error) {
    console.error("Dictionary lookup error:", error);
    return null;
  }
}

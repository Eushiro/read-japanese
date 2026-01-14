import type { JLPTLevel } from "./story";

// Vocabulary item saved by user
export interface VocabularyItem {
  _id: string; // Convex ID
  userId: string;
  word: string;
  reading: string;
  meaning: string;
  jlptLevel?: JLPTLevel | string;
  partOfSpeech?: string;
  sourceStoryId?: string;
  sourceStoryTitle?: string;
  createdAt: number;
}

// Word definition from Jisho API
export interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  tags: string[];
  info: string[];
}

export interface JishoJapanese {
  word?: string;
  reading: string;
}

export interface JishoData {
  slug: string;
  is_common: boolean;
  tags: string[];
  jlpt: string[];
  japanese: JishoJapanese[];
  senses: JishoSense[];
}

export interface JishoResponse {
  meta: { status: number };
  data: JishoData[];
}

// Simplified word definition for display
export interface WordDefinition {
  word: string;
  reading: string;
  meanings: string[];
  partsOfSpeech: string[];
  jlptLevel?: string;
  isCommon: boolean;
}

// Parse Jisho response to WordDefinition
export function parseJishoResponse(data: JishoData): WordDefinition {
  const japanese = data.japanese[0];
  const firstSense = data.senses[0];

  return {
    word: japanese?.word || japanese?.reading || "",
    reading: japanese?.reading || "",
    meanings: firstSense?.english_definitions.slice(0, 5) || [],
    partsOfSpeech: firstSense?.parts_of_speech || [],
    jlptLevel: data.jlpt[0]?.toUpperCase(),
    isCommon: data.is_common,
  };
}

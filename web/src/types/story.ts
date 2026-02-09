import type { ContentLanguage } from "@/lib/contentLanguages";

import type {
  CEFRLevel,
  JLPTLevel,
  ProficiencyLevel,
} from "../../convex/schema";

export type { CEFRLevel, JLPTLevel, ProficiencyLevel };

export const JLPT_LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

// Description keys are i18n keys - translate at render time with t(`common.levels.${descriptionKey}`)
export const JLPT_LEVEL_INFO: Record<
  JLPTLevel,
  {
    difficulty: number;
    descriptionKey: string;
    color: string;
  }
> = {
  N5: { difficulty: 1, descriptionKey: "beginner", color: "jlpt-n5" },
  N4: { difficulty: 2, descriptionKey: "elementary", color: "jlpt-n4" },
  N3: { difficulty: 3, descriptionKey: "intermediate", color: "jlpt-n3" },
  N2: { difficulty: 4, descriptionKey: "upperIntermediate", color: "jlpt-n2" },
  N1: { difficulty: 5, descriptionKey: "advanced", color: "jlpt-n1" },
};

export const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

// Description keys are i18n keys - translate at render time with t(`common.levels.${descriptionKey}`)
export const CEFR_LEVEL_INFO: Record<
  CEFRLevel,
  {
    difficulty: number;
    descriptionKey: string;
    color: string;
  }
> = {
  A1: { difficulty: 1, descriptionKey: "beginner", color: "cefr-a1" },
  A2: { difficulty: 2, descriptionKey: "elementary", color: "cefr-a2" },
  B1: { difficulty: 3, descriptionKey: "intermediate", color: "cefr-b1" },
  B2: { difficulty: 4, descriptionKey: "upperIntermediate", color: "cefr-b2" },
  C1: { difficulty: 5, descriptionKey: "advanced", color: "cefr-c1" },
  C2: { difficulty: 6, descriptionKey: "mastery", color: "cefr-c2" },
};

// Token part - either kanji with reading or plain kana
export interface TokenPart {
  text: string;
  reading?: string;
}

// Token represents a single word or punctuation
export interface Token {
  surface: string;
  parts?: TokenPart[];
  baseForm?: string;
  partOfSpeech?: string;
  isWord?: boolean;
  proficiencyLevel?: string;
}

// Word-level audio timing from Whisper alignment
export interface AudioWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

// Segment type
export type SegmentType = "paragraph" | "dialogue" | "heading";

// A segment of story content
export interface StorySegment {
  id: string;
  segmentType: SegmentType;
  tokens?: Token[];
  text?: string;
  audioStartTime?: number;
  audioEndTime?: number;
  audioWords?: AudioWord[];
}

// A chapter within a story
export interface Chapter {
  id: string;
  title: string;
  titleJapanese?: string;
  titleTokens?: Token[];
  titleEnglish?: string;
  segments: StorySegment[];
  content?: StorySegment[]; // Alias for segments (API compatibility)
  imageURL?: string;
  audioURL?: string;
}

// Story metadata
export interface StoryMetadata {
  title: string;
  titleJapanese?: string;
  titleTokens?: Token[];
  author: string;
  tokenizerSource?: string;
  level: ProficiencyLevel;
  wordCount: number;
  characterCount: number;
  genre: string;
  tags: string[];
  summary: string;
  summaryJapanese?: string;
  coverImageURL?: string;
  audioURL?: string;
  audioVoiceId?: string;
  audioVoiceName?: string;
  createdDate: string;
  isPremium: boolean;
}

// Main story model
export interface Story {
  id: string;
  metadata: StoryMetadata;
  content?: StorySegment[];
  chapters?: Chapter[];
  vocabulary?: string[];
  grammarPoints?: string[];
}

// Translation object for multi-language content (all languages required)
export interface Translations {
  en: string;
  ja: string;
  fr: string;
  zh: string;
}

// Story list item (summary for library view)
export interface StoryListItem {
  id: string;
  language: ContentLanguage;
  title: string;
  titleTranslations: Translations;
  level: ProficiencyLevel;
  wordCount: number;
  genre: string;
  summary: string;
  summaryTranslations: Translations;
  coverImageURL?: string;
  audioURL?: string;
  chapterCount: number;
  isPremium: boolean;
}

// Helper functions

export function getStorySegments(story: Story, chapterIndex?: number): StorySegment[] {
  if (story.chapters && story.chapters.length > 0) {
    if (chapterIndex !== undefined && chapterIndex < story.chapters.length) {
      const chapter = story.chapters[chapterIndex];
      return chapter.segments || chapter.content || [];
    }
    return story.chapters.flatMap((ch) => ch.segments || ch.content || []);
  }
  return story.content || [];
}

export function getSegmentText(segment: StorySegment): string {
  if (segment.tokens && segment.tokens.length > 0) {
    return segment.tokens.map((t) => t.surface).join("");
  }
  return segment.text || "";
}

export function getTokenReading(token: Token): string | undefined {
  if (!token.parts) return undefined;
  return token.parts.map((p) => p.reading || p.text).join("");
}

export function isTokenPunctuation(token: Token): boolean {
  return token.partOfSpeech === "punctuation" || token.partOfSpeech === "symbol";
}

export function tokenHasFurigana(token: Token): boolean {
  if (!token.parts) return false;
  return token.parts.some((p) => p.reading !== undefined);
}

export function estimateReadingTime(story: Story): number {
  const segments = getStorySegments(story);
  const totalChars = segments.reduce((sum, seg) => sum + getSegmentText(seg).length, 0);
  // Average reading speed: ~300 characters per minute for learners
  return Math.max(1, Math.floor(totalChars / 300));
}

/**
 * Convert test-specific levels (JLPT N5-N1, CEFR A1-C2) to unified 1-6 difficulty scale.
 * This allows comprehension questions to be shared across different test frameworks.
 *
 * Mapping:
 *   JLPT: N5=1, N4=2, N3=3, N2=4, N1=5
 *   CEFR: A1=1, A2=2, B1=3, B2=4, C1=5, C2=6
 */
export function testLevelToDifficultyLevel(testLevel: string): number {
  const mapping: Record<string, number> = {
    // JLPT (Japanese)
    N5: 1,
    N4: 2,
    N3: 3,
    N2: 4,
    N1: 5,
    // CEFR (English, French)
    A1: 1,
    A2: 2,
    B1: 3,
    B2: 4,
    C1: 5,
    C2: 6,
  };
  return mapping[testLevel] ?? 3; // default to intermediate if unknown
}

/**
 * Convert difficulty level (1-6) back to display label for a given language.
 */
export function difficultyLevelToTestLevel(difficulty: number, language: ContentLanguage): string {
  if (language === "japanese") {
    const jlpt = ["N5", "N4", "N3", "N2", "N1"];
    return jlpt[Math.min(Math.max(difficulty - 1, 0), 4)] ?? "N3";
  }
  const cefr = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return cefr[Math.min(Math.max(difficulty - 1, 0), 5)] ?? "B1";
}

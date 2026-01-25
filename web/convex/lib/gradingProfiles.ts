import type { ContentLanguage } from "../schema";

/**
 * Grading profiles define level-specific thresholds for sentence verification.
 * Moved from database table to constants for simplicity (this data rarely changes).
 */

export interface GradingProfile {
  language: ContentLanguage;
  level: string;
  grammarPassThreshold: number;
  usagePassThreshold: number;
  naturalnessPassThreshold: number;
  levelDescription: string;
  storyDifficultyMin?: string;
  storyDifficultyMax?: string;
}

// Japanese JLPT levels
const JAPANESE_PROFILES: Record<string, GradingProfile> = {
  N5: {
    language: "japanese",
    level: "N5",
    grammarPassThreshold: 60,
    usagePassThreshold: 50,
    naturalnessPassThreshold: 40,
    levelDescription: "Beginner - Basic phrases and simple sentences",
    storyDifficultyMin: "1",
    storyDifficultyMax: "2",
  },
  N4: {
    language: "japanese",
    level: "N4",
    grammarPassThreshold: 65,
    usagePassThreshold: 55,
    naturalnessPassThreshold: 45,
    levelDescription: "Elementary - Basic everyday conversations",
    storyDifficultyMin: "2",
    storyDifficultyMax: "3",
  },
  N3: {
    language: "japanese",
    level: "N3",
    grammarPassThreshold: 70,
    usagePassThreshold: 60,
    naturalnessPassThreshold: 50,
    levelDescription: "Intermediate - Everyday situations and topics",
    storyDifficultyMin: "3",
    storyDifficultyMax: "4",
  },
  N2: {
    language: "japanese",
    level: "N2",
    grammarPassThreshold: 75,
    usagePassThreshold: 65,
    naturalnessPassThreshold: 55,
    levelDescription: "Upper Intermediate - Complex topics and nuance",
    storyDifficultyMin: "4",
    storyDifficultyMax: "5",
  },
  N1: {
    language: "japanese",
    level: "N1",
    grammarPassThreshold: 80,
    usagePassThreshold: 70,
    naturalnessPassThreshold: 60,
    levelDescription: "Advanced - Native-level comprehension",
    storyDifficultyMin: "5",
    storyDifficultyMax: "6",
  },
};

// English CEFR levels
const ENGLISH_PROFILES: Record<string, GradingProfile> = {
  A1: {
    language: "english",
    level: "A1",
    grammarPassThreshold: 60,
    usagePassThreshold: 50,
    naturalnessPassThreshold: 40,
    levelDescription: "Beginner - Basic phrases and greetings",
    storyDifficultyMin: "1",
    storyDifficultyMax: "1",
  },
  A2: {
    language: "english",
    level: "A2",
    grammarPassThreshold: 65,
    usagePassThreshold: 55,
    naturalnessPassThreshold: 45,
    levelDescription: "Elementary - Simple everyday expressions",
    storyDifficultyMin: "1",
    storyDifficultyMax: "2",
  },
  B1: {
    language: "english",
    level: "B1",
    grammarPassThreshold: 70,
    usagePassThreshold: 60,
    naturalnessPassThreshold: 50,
    levelDescription: "Intermediate - Main points on familiar matters",
    storyDifficultyMin: "2",
    storyDifficultyMax: "3",
  },
  B2: {
    language: "english",
    level: "B2",
    grammarPassThreshold: 75,
    usagePassThreshold: 65,
    naturalnessPassThreshold: 55,
    levelDescription: "Upper Intermediate - Complex texts and discussions",
    storyDifficultyMin: "3",
    storyDifficultyMax: "4",
  },
  C1: {
    language: "english",
    level: "C1",
    grammarPassThreshold: 80,
    usagePassThreshold: 70,
    naturalnessPassThreshold: 60,
    levelDescription: "Advanced - Demanding texts and implicit meaning",
    storyDifficultyMin: "4",
    storyDifficultyMax: "5",
  },
  C2: {
    language: "english",
    level: "C2",
    grammarPassThreshold: 85,
    usagePassThreshold: 75,
    naturalnessPassThreshold: 65,
    levelDescription: "Proficient - Near-native fluency",
    storyDifficultyMin: "5",
    storyDifficultyMax: "6",
  },
};

// French CEFR levels
const FRENCH_PROFILES: Record<string, GradingProfile> = {
  A1: {
    language: "french",
    level: "A1",
    grammarPassThreshold: 60,
    usagePassThreshold: 50,
    naturalnessPassThreshold: 40,
    levelDescription: "Débutant - Phrases de base et salutations",
    storyDifficultyMin: "1",
    storyDifficultyMax: "1",
  },
  A2: {
    language: "french",
    level: "A2",
    grammarPassThreshold: 65,
    usagePassThreshold: 55,
    naturalnessPassThreshold: 45,
    levelDescription: "Élémentaire - Expressions quotidiennes simples",
    storyDifficultyMin: "1",
    storyDifficultyMax: "2",
  },
  B1: {
    language: "french",
    level: "B1",
    grammarPassThreshold: 70,
    usagePassThreshold: 60,
    naturalnessPassThreshold: 50,
    levelDescription: "Intermédiaire - Points essentiels sur des sujets familiers",
    storyDifficultyMin: "2",
    storyDifficultyMax: "3",
  },
  B2: {
    language: "french",
    level: "B2",
    grammarPassThreshold: 75,
    usagePassThreshold: 65,
    naturalnessPassThreshold: 55,
    levelDescription: "Intermédiaire supérieur - Textes complexes et discussions",
    storyDifficultyMin: "3",
    storyDifficultyMax: "4",
  },
  C1: {
    language: "french",
    level: "C1",
    grammarPassThreshold: 80,
    usagePassThreshold: 70,
    naturalnessPassThreshold: 60,
    levelDescription: "Avancé - Textes exigeants et sens implicite",
    storyDifficultyMin: "4",
    storyDifficultyMax: "5",
  },
  C2: {
    language: "french",
    level: "C2",
    grammarPassThreshold: 85,
    usagePassThreshold: 75,
    naturalnessPassThreshold: 65,
    levelDescription: "Maîtrise - Aisance quasi-native",
    storyDifficultyMin: "5",
    storyDifficultyMax: "6",
  },
};

// Combined lookup
export const GRADING_PROFILES: Record<ContentLanguage, Record<string, GradingProfile>> = {
  japanese: JAPANESE_PROFILES,
  english: ENGLISH_PROFILES,
  french: FRENCH_PROFILES,
};

/**
 * Get grading profile for a language and level
 * @returns GradingProfile or null if not found
 */
export function getGradingProfile(language: ContentLanguage, level: string): GradingProfile | null {
  return GRADING_PROFILES[language]?.[level] ?? null;
}

/**
 * Get all levels for a language
 */
export function getLevelsForLanguage(language: ContentLanguage): string[] {
  return Object.keys(GRADING_PROFILES[language] ?? {});
}

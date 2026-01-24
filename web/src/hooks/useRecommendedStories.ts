import { useMemo, useState } from "react";

import type { CEFRLevel, JLPTLevel, ProficiencyLevel, StoryListItem } from "@/types/story";

// Simple seeded PRNG for stable-but-varied shuffling
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Shuffle array with seeded random for reproducibility
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const random = seededRandom(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type Language = "japanese" | "english" | "french";

// Exam types from Convex schema
type ExamType =
  | "jlpt_n5"
  | "jlpt_n4"
  | "jlpt_n3"
  | "jlpt_n2"
  | "jlpt_n1"
  | "toefl"
  | "sat"
  | "gre"
  | "delf_a1"
  | "delf_a2"
  | "delf_b1"
  | "delf_b2"
  | "dalf_c1"
  | "dalf_c2"
  | "tcf";

// User profile structure from Convex
interface UserProfile {
  languages?: Language[];
  targetExams?: ExamType[];
  primaryLanguage?: Language;
  proficiencyLevels?: {
    japanese?: { level: string; assessedAt: number };
    english?: { level: string; assessedAt: number };
    french?: { level: string; assessedAt: number };
  };
}

// JLPT levels ordered by difficulty
const JLPT_ORDER: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
// CEFR levels ordered by difficulty
const CEFR_ORDER: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

// Map exam types to proficiency levels
function examToLevel(exam: ExamType): ProficiencyLevel | null {
  // Japanese JLPT exams
  if (exam.startsWith("jlpt_")) {
    const level = exam.replace("jlpt_", "").toUpperCase();
    if (JLPT_ORDER.includes(level as JLPTLevel)) {
      return level as JLPTLevel;
    }
  }
  // French DELF/DALF exams
  if (exam.startsWith("delf_") || exam.startsWith("dalf_")) {
    const level = exam.replace(/^(delf_|dalf_)/, "").toUpperCase();
    if (CEFR_ORDER.includes(level as CEFRLevel)) {
      return level as CEFRLevel;
    }
  }
  // English exams (TOEFL, SAT, GRE) don't map to CEFR directly
  // TCF doesn't have a specific level
  return null;
}

// Get adjacent levels (±1) for a given level
function getAdjacentLevels(level: ProficiencyLevel): ProficiencyLevel[] {
  const isJLPT = JLPT_ORDER.includes(level as JLPTLevel);
  const order = isJLPT ? JLPT_ORDER : CEFR_ORDER;
  const index = order.indexOf(level as JLPTLevel & CEFRLevel);

  if (index === -1) return [level];

  const levels: ProficiencyLevel[] = [level];
  // Add one level easier (if exists)
  if (index > 0) {
    levels.push(order[index - 1] as ProficiencyLevel);
  }
  // Add one level harder (if exists)
  if (index < order.length - 1) {
    levels.push(order[index + 1] as ProficiencyLevel);
  }

  return levels;
}

// Get level system for a language
function getLevelSystem(language: Language): "jlpt" | "cefr" {
  return language === "japanese" ? "jlpt" : "cefr";
}

// Filter stories by level system
function filterByLanguage(stories: StoryListItem[], language: Language): StoryListItem[] {
  const levelSystem = getLevelSystem(language);
  const validLevels = levelSystem === "jlpt" ? JLPT_ORDER : CEFR_ORDER;
  return stories.filter((s) => validLevels.includes(s.level as JLPTLevel & CEFRLevel));
}

export interface RecommendedStoriesResult {
  stories: StoryListItem[];
  reason: string;
  userLevel: ProficiencyLevel | null;
}

export function useRecommendedStories(
  allStories: StoryListItem[] | undefined,
  userProfile: UserProfile | null | undefined,
  language: Language,
  maxStories: number = 4
): RecommendedStoriesResult {
  // Generate a stable random seed once per component instance
  // This ensures consistent shuffling during renders but variety across mounts
  // Using useState lazy initializer for React compiler purity compliance
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));

  return useMemo(() => {
    if (!allStories || allStories.length === 0) {
      return { stories: [], reason: "", userLevel: null };
    }

    // Filter stories to match the language's level system
    const languageStories = filterByLanguage(allStories, language);

    if (languageStories.length === 0) {
      return { stories: [], reason: "No stories available for this language", userLevel: null };
    }

    // Create a seed based on stable inputs plus the instance seed
    const baseSeed = seed + languageStories.length;

    // Priority 1: Check placement test result
    const placementLevel = userProfile?.proficiencyLevels?.[language]?.level as
      | ProficiencyLevel
      | undefined;
    if (placementLevel) {
      const targetLevels = getAdjacentLevels(placementLevel);
      const filtered = languageStories.filter((s) => targetLevels.includes(s.level));

      if (filtered.length > 0) {
        // Shuffle with seeded random and take maxStories
        const shuffled = shuffleWithSeed(filtered, baseSeed);
        return {
          stories: shuffled.slice(0, maxStories),
          reason: `Based on your ${placementLevel} level`,
          userLevel: placementLevel,
        };
      }
    }

    // Priority 2: Infer level from target exams
    if (userProfile?.targetExams && userProfile.targetExams.length > 0) {
      // Find exams relevant to this language
      const relevantExams = userProfile.targetExams.filter((exam) => {
        if (language === "japanese") return exam.startsWith("jlpt_");
        if (language === "french") return exam.startsWith("delf_") || exam.startsWith("dalf_");
        if (language === "english") return ["toefl", "sat", "gre"].includes(exam);
        return false;
      });

      // Try to extract a level from the first relevant exam
      for (const exam of relevantExams) {
        const inferredLevel = examToLevel(exam);
        if (inferredLevel) {
          const targetLevels = getAdjacentLevels(inferredLevel);
          const filtered = languageStories.filter((s) => targetLevels.includes(s.level));

          if (filtered.length > 0) {
            const shuffled = shuffleWithSeed(filtered, baseSeed);
            const examName = exam.replace(/_/g, " ").toUpperCase();
            return {
              stories: shuffled.slice(0, maxStories),
              reason: `Based on your ${examName} goal`,
              userLevel: inferredLevel,
            };
          }
        }
      }
    }

    // Priority 3: Random selection (fallback)
    const shuffled = shuffleWithSeed(languageStories, baseSeed);
    return {
      stories: shuffled.slice(0, maxStories),
      reason: "Popular picks",
      userLevel: null,
    };
  }, [allStories, userProfile, language, maxStories, seed]);
}

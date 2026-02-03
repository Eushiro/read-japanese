import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { ContentLanguage } from "@/lib/contentLanguages";
import type { CEFRLevel, JLPTLevel, ProficiencyLevel, StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

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

// User profile structure from Convex
// Note: targetExams is string[] to accommodate both ExamType and broader string values
interface UserProfile {
  languages?: ContentLanguage[];
  targetExams?: string[];
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
function examToLevel(exam: string): ProficiencyLevel | null {
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
function getLevelSystem(language: ContentLanguage): "jlpt" | "cefr" {
  return language === "japanese" ? "jlpt" : "cefr";
}

// Filter stories by level system
function filterByLanguage(stories: StoryListItem[], language: ContentLanguage): StoryListItem[] {
  const levelSystem = getLevelSystem(language);
  const validLevels = levelSystem === "jlpt" ? JLPT_ORDER : CEFR_ORDER;
  return stories.filter((s) => validLevels.includes(s.level as JLPTLevel & CEFRLevel));
}

export interface RecommendedStoriesResult {
  stories: StoryListItem[];
  reason: string;
  userLevel: ProficiencyLevel | null;
  isAdaptive: boolean;
}

/**
 * Hook for getting recommended stories based on learner model
 *
 * Uses the following priority order:
 * 1. Learner model's recommended difficulty (most accurate, uses IRT ability estimate with i+1)
 * 2. Placement test result from user profile
 * 3. Target exam level inference
 * 4. Random fallback
 */
export function useRecommendedStories(
  allStories: StoryListItem[] | undefined,
  userProfile: UserProfile | null | undefined,
  language: ContentLanguage,
  maxStories: number = 4,
  userId?: string
): RecommendedStoriesResult {
  // Generate a stable random seed once per component instance
  // This ensures consistent shuffling during renders but variety across mounts
  // Using useState lazy initializer for React compiler purity compliance
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));

  // Fetch learner model's recommended difficulty if userId is provided
  const recommendedDifficulty = useQuery(
    api.learnerModel.getRecommendedDifficulty,
    userId ? { userId, language } : "skip"
  );

  return useMemo(() => {
    if (!allStories || allStories.length === 0) {
      return { stories: [], reason: "", userLevel: null, isAdaptive: false };
    }

    // Filter stories to match the language's level system
    const languageStories = filterByLanguage(allStories, language);

    if (languageStories.length === 0) {
      return {
        stories: [],
        reason: "No stories available for this language",
        userLevel: null,
        isAdaptive: false,
      };
    }

    // Create a seed based on stable inputs plus the instance seed
    const baseSeed = seed + languageStories.length;

    // Priority 1: Use learner model's recommended difficulty (most accurate)
    // This uses IRT ability estimate with i+1 principle
    if (recommendedDifficulty?.hasProfile && recommendedDifficulty.acceptableLevels.length > 0) {
      const acceptableLevels = recommendedDifficulty.acceptableLevels as ProficiencyLevel[];
      const filtered = languageStories.filter((s) => acceptableLevels.includes(s.level));

      if (filtered.length > 0) {
        const shuffled = shuffleWithSeed(filtered, baseSeed);
        return {
          stories: shuffled.slice(0, maxStories),
          reason: `Matched to your ${recommendedDifficulty.targetLevel} level`,
          userLevel: recommendedDifficulty.targetLevel as ProficiencyLevel,
          isAdaptive: true,
        };
      }
    }

    // Priority 2: Check placement test result from user profile
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
          isAdaptive: false,
        };
      }
    }

    // Priority 3: Infer level from target exams
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
              isAdaptive: false,
            };
          }
        }
      }
    }

    // Priority 4: Random selection (fallback)
    const shuffled = shuffleWithSeed(languageStories, baseSeed);
    return {
      stories: shuffled.slice(0, maxStories),
      reason: "Popular picks",
      userLevel: null,
      isAdaptive: false,
    };
  }, [allStories, userProfile, language, maxStories, seed, recommendedDifficulty]);
}

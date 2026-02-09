// Shared level constants for JLPT and CEFR levels

/** Standard Error threshold below which we consider the learner model "calibrated". */
export const CALIBRATION_SE_THRESHOLD = 0.5;

import type { ContentLanguage } from "@/lib/contentLanguages";

import type { DifficultyLevel } from "../../convex/schema";

export type LevelVariant =
  | "n5"
  | "n4"
  | "n3"
  | "n2"
  | "n1"
  | "a1"
  | "a2"
  | "b1"
  | "b2"
  | "c1"
  | "c2";

export const levelVariantMap: Record<string, LevelVariant> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
  A1: "a1",
  A2: "a2",
  B1: "b1",
  B2: "b2",
  C1: "c1",
  C2: "c2",
};

export function getLevelVariant(level: string | undefined): LevelVariant | undefined {
  if (!level) return undefined;
  return levelVariantMap[level];
}

/**
 * Map a DifficultyLevel to a human-readable exam label (e.g. "N3", "B1").
 */
const JAPANESE_LEVEL_MAP: Record<DifficultyLevel, string> = {
  level_1: "N5",
  level_2: "N4",
  level_3: "N3",
  level_4: "N2",
  level_5: "N1",
  level_6: "N1",
};

const CEFR_LEVEL_MAP: Record<DifficultyLevel, string> = {
  level_1: "A1",
  level_2: "A2",
  level_3: "B1",
  level_4: "B2",
  level_5: "C1",
  level_6: "C2",
};

export function difficultyToExamLabel(
  difficulty: DifficultyLevel,
  language: ContentLanguage
): string {
  if (language === "japanese") {
    return JAPANESE_LEVEL_MAP[difficulty];
  }
  return CEFR_LEVEL_MAP[difficulty];
}

/**
 * Ability thresholds for each level band.
 * Each entry: [lowerBound, upperBound, label]
 */
const JAPANESE_BANDS: [number, number, string][] = [
  [-3, -2, "N5"],
  [-2, -1, "N4"],
  [-1, 0.5, "N3"],
  [0.5, 1.5, "N2"],
  [1.5, 3, "N1"],
];

const CEFR_BANDS: [number, number, string][] = [
  [-3, -2, "A1"],
  [-2, -1, "A2"],
  [-1, 0, "B1"],
  [0, 1, "B2"],
  [1, 2, "C1"],
  [2, 3, "C2"],
];

/**
 * Convert an IRT ability estimate to level progress info.
 * Returns current level, next level (null if at max), and percent through the current band.
 */
export function abilityToProgress(
  ability: number,
  language: ContentLanguage
): { currentLevel: string; nextLevel: string | null; progressPercent: number } {
  const bands = language === "japanese" ? JAPANESE_BANDS : CEFR_BANDS;

  for (let i = 0; i < bands.length; i++) {
    const [lower, upper, label] = bands[i];
    if (ability < upper || i === bands.length - 1) {
      const clamped = Math.max(lower, Math.min(upper, ability));
      const progressPercent = Math.round(((clamped - lower) / (upper - lower)) * 100);
      const nextLevel = i < bands.length - 1 ? bands[i + 1][2] : null;
      return { currentLevel: label, nextLevel, progressPercent };
    }
  }

  // Fallback (shouldn't reach here)
  const last = bands[bands.length - 1];
  return { currentLevel: last[2], nextLevel: null, progressPercent: 100 };
}

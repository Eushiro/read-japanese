/**
 * Critical test: FSRS (Free Spaced Repetition Scheduler) algorithm
 * These are pure math functions - if broken, flashcard scheduling fails
 *
 * Note: These functions are duplicated from convex/flashcards.ts for testing
 * since Convex functions can't be imported directly in browser tests.
 */

import { describe, expect, it } from "bun:test";

// FSRS Constants (must match convex/flashcards.ts)
const FSRS_PARAMS = {
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29,
    2.61,
  ],
  requestRetention: 0.9,
  maximumInterval: 36500,
};

const RATING_MULTIPLIERS = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
} as const;

type Rating = keyof typeof RATING_MULTIPLIERS;

// FSRS Functions (must match convex/flashcards.ts)
function calculateInitialDifficulty(rating: Rating): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];
  return w[4] - Math.exp(w[5] * (g - 1)) + 1;
}

function calculateInitialStability(rating: Rating): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];
  return w[g];
}

function calculateNextInterval(stability: number, requestRetention: number): number {
  return Math.min(
    Math.round(stability * 9 * (1 / requestRetention - 1)),
    FSRS_PARAMS.maximumInterval
  );
}

function calculateNextStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: Rating
): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];

  if (g === 0) {
    // Again - memory lapse
    return (
      w[11] *
      Math.pow(difficulty, -w[12]) *
      (Math.pow(stability + 1, w[13]) - 1) *
      Math.exp(w[14] * (1 - retrievability))
    );
  }

  // Good or better
  const hardPenalty = g === 1 ? w[15] : 1;
  const easyBonus = g === 3 ? w[16] : 1;

  return (
    stability *
    (1 +
      Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp(w[10] * (1 - retrievability)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

describe("FSRS Algorithm", () => {
  describe("calculateInitialDifficulty", () => {
    it("returns higher difficulty for 'again' rating", () => {
      const againDiff = calculateInitialDifficulty("again");
      const easyDiff = calculateInitialDifficulty("easy");
      expect(againDiff).toBeGreaterThan(easyDiff);
    });

    it("returns finite values for all ratings", () => {
      // Note: Raw difficulty can be negative for "easy" - gets clamped in actual usage
      const ratings: Rating[] = ["again", "hard", "good", "easy"];
      for (const rating of ratings) {
        const diff = calculateInitialDifficulty(rating);
        expect(Number.isFinite(diff)).toBe(true);
      }
    });

    it("again rating produces highest initial difficulty", () => {
      const againDiff = calculateInitialDifficulty("again");
      const hardDiff = calculateInitialDifficulty("hard");
      const goodDiff = calculateInitialDifficulty("good");
      const easyDiff = calculateInitialDifficulty("easy");

      expect(againDiff).toBeGreaterThan(hardDiff);
      expect(hardDiff).toBeGreaterThan(goodDiff);
      expect(goodDiff).toBeGreaterThan(easyDiff);
    });

    it("produces consistent results (no randomness)", () => {
      const diff1 = calculateInitialDifficulty("good");
      const diff2 = calculateInitialDifficulty("good");
      expect(diff1).toBe(diff2);
    });
  });

  describe("calculateInitialStability", () => {
    it("returns increasing stability for better ratings", () => {
      const againStab = calculateInitialStability("again");
      const hardStab = calculateInitialStability("hard");
      const goodStab = calculateInitialStability("good");
      const easyStab = calculateInitialStability("easy");

      expect(hardStab).toBeGreaterThan(againStab);
      expect(goodStab).toBeGreaterThan(hardStab);
      expect(easyStab).toBeGreaterThan(goodStab);
    });

    it("returns positive values for all ratings", () => {
      const ratings: Rating[] = ["again", "hard", "good", "easy"];
      for (const rating of ratings) {
        const stab = calculateInitialStability(rating);
        expect(stab).toBeGreaterThan(0);
        expect(Number.isFinite(stab)).toBe(true);
      }
    });
  });

  describe("calculateNextInterval", () => {
    it("returns positive interval", () => {
      const interval = calculateNextInterval(1, 0.9);
      expect(interval).toBeGreaterThan(0);
    });

    it("respects maximum interval", () => {
      const interval = calculateNextInterval(100000, 0.9);
      expect(interval).toBeLessThanOrEqual(FSRS_PARAMS.maximumInterval);
    });

    it("higher stability produces longer intervals", () => {
      const lowStabInterval = calculateNextInterval(1, 0.9);
      const highStabInterval = calculateNextInterval(10, 0.9);
      expect(highStabInterval).toBeGreaterThan(lowStabInterval);
    });

    it("returns integer (rounded) values", () => {
      const interval = calculateNextInterval(2.5, 0.9);
      expect(Number.isInteger(interval)).toBe(true);
    });
  });

  describe("calculateNextStability", () => {
    it("'again' rating decreases stability", () => {
      const currentStability = 10;
      const nextStability = calculateNextStability(5, currentStability, 0.9, "again");
      expect(nextStability).toBeLessThan(currentStability);
    });

    it("'easy' rating increases stability more than 'good'", () => {
      const currentStability = 5;
      const goodStability = calculateNextStability(5, currentStability, 0.9, "good");
      const easyStability = calculateNextStability(5, currentStability, 0.9, "easy");
      expect(easyStability).toBeGreaterThan(goodStability);
    });

    it("returns positive values", () => {
      const ratings: Rating[] = ["again", "hard", "good", "easy"];
      for (const rating of ratings) {
        const nextStab = calculateNextStability(5, 5, 0.9, rating);
        expect(nextStab).toBeGreaterThan(0);
        expect(Number.isFinite(nextStab)).toBe(true);
      }
    });
  });
});

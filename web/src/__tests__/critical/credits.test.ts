/**
 * Critical test: Credit system constants and calculations
 * If broken, users may get wrong credit limits or action costs
 *
 * Note: Constants are duplicated from convex/subscriptions.ts for testing
 * since Convex functions can't be imported directly in browser tests.
 */

import { describe, expect, it } from "bun:test";

// Credit constants (must match convex/subscriptions.ts)
const TIER_CREDITS = {
  free: 50,
  plus: 500,
  pro: 1500,
} as const;

const CREDIT_COSTS = {
  sentence: 1,
  feedback: 1,
  comprehension: 1,
  audio: 2,
  shadowing: 3,
  question: 1,
  image: 3,
  story: 2,
  placement: 2,
} as const;

type Tier = keyof typeof TIER_CREDITS;
type CreditAction = keyof typeof CREDIT_COSTS;

// Helper function to calculate remaining credits
function calculateRemainingCredits(
  tier: Tier,
  used: number
): { remaining: number; percentage: number; nearLimit: boolean } {
  const limit = TIER_CREDITS[tier];
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return {
    remaining,
    percentage,
    nearLimit: percentage >= 80,
  };
}

describe("Credit System", () => {
  describe("TIER_CREDITS constants", () => {
    it("has correct limits for each tier", () => {
      expect(TIER_CREDITS.free).toBe(50);
      expect(TIER_CREDITS.plus).toBe(500);
      expect(TIER_CREDITS.pro).toBe(1500);
    });

    it("tiers increase in value", () => {
      expect(TIER_CREDITS.plus).toBeGreaterThan(TIER_CREDITS.free);
      expect(TIER_CREDITS.pro).toBeGreaterThan(TIER_CREDITS.plus);
    });

    it("all tiers have positive credit limits", () => {
      const tiers: Tier[] = ["free", "plus", "pro"];
      for (const tier of tiers) {
        expect(TIER_CREDITS[tier]).toBeGreaterThan(0);
      }
    });
  });

  describe("CREDIT_COSTS constants", () => {
    it("all costs are positive integers", () => {
      const actions: CreditAction[] = [
        "sentence",
        "feedback",
        "comprehension",
        "audio",
        "shadowing",
        "question",
        "image",
        "story",
        "placement",
      ];
      for (const action of actions) {
        const cost = CREDIT_COSTS[action];
        expect(cost).toBeGreaterThan(0);
        expect(Number.isInteger(cost)).toBe(true);
      }
    });

    it("audio costs more than text actions", () => {
      expect(CREDIT_COSTS.audio).toBeGreaterThan(CREDIT_COSTS.sentence);
      expect(CREDIT_COSTS.audio).toBeGreaterThan(CREDIT_COSTS.feedback);
    });

    it("image is more expensive than text actions", () => {
      expect(CREDIT_COSTS.image).toBeGreaterThan(CREDIT_COSTS.sentence);
      expect(CREDIT_COSTS.image).toBeGreaterThan(CREDIT_COSTS.feedback);
      expect(CREDIT_COSTS.image).toBeGreaterThan(CREDIT_COSTS.question);
    });

    it("shadowing and image are the most expensive actions", () => {
      const cheaperActions: CreditAction[] = [
        "sentence",
        "feedback",
        "comprehension",
        "audio",
        "question",
        "story",
        "placement",
      ];
      for (const action of cheaperActions) {
        expect(CREDIT_COSTS.shadowing).toBeGreaterThanOrEqual(CREDIT_COSTS[action]);
        expect(CREDIT_COSTS.image).toBeGreaterThanOrEqual(CREDIT_COSTS[action]);
      }
    });
  });

  describe("calculateRemainingCredits", () => {
    it("calculates correctly for free tier", () => {
      const result = calculateRemainingCredits("free", 25);
      expect(result.remaining).toBe(25);
      expect(result.percentage).toBe(50);
      expect(result.nearLimit).toBe(false);
    });

    it("flags near limit at 80%", () => {
      const result = calculateRemainingCredits("free", 40);
      expect(result.percentage).toBe(80);
      expect(result.nearLimit).toBe(true);
    });

    it("remaining never goes negative", () => {
      const result = calculateRemainingCredits("free", 100);
      expect(result.remaining).toBe(0);
    });

    it("handles zero usage", () => {
      const result = calculateRemainingCredits("pro", 0);
      expect(result.remaining).toBe(1500);
      expect(result.percentage).toBe(0);
      expect(result.nearLimit).toBe(false);
    });

    it("calculates percentage correctly at various usage levels", () => {
      // 50% usage on plus
      const half = calculateRemainingCredits("plus", 250);
      expect(half.percentage).toBe(50);

      // 100% usage on free
      const full = calculateRemainingCredits("free", 50);
      expect(full.percentage).toBe(100);
      expect(full.remaining).toBe(0);
    });
  });

  describe("business logic validation", () => {
    it("pro tier provides more credits than plus", () => {
      expect(TIER_CREDITS.pro).toBeGreaterThan(TIER_CREDITS.plus);
    });
  });
});

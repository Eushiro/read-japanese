import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { languageValidator } from "./schema";
import type { Id } from "./_generated/dataModel";

// ============================================
// LEVEL DEFINITIONS
// ============================================

// Japanese JLPT levels mapped to ability scale (-3 to +3)
const JAPANESE_LEVELS = [
  { level: "N5", abilityMin: -3.0, abilityMax: -1.5, description: "Basic Japanese" },
  { level: "N4", abilityMin: -1.5, abilityMax: -0.5, description: "Elementary Japanese" },
  { level: "N3", abilityMin: -0.5, abilityMax: 0.5, description: "Intermediate Japanese" },
  { level: "N2", abilityMin: 0.5, abilityMax: 1.5, description: "Upper Intermediate Japanese" },
  { level: "N1", abilityMin: 1.5, abilityMax: 3.0, description: "Advanced Japanese" },
];

// CEFR levels for English/French
const CEFR_LEVELS = [
  { level: "A1", abilityMin: -3.0, abilityMax: -2.0, description: "Beginner" },
  { level: "A2", abilityMin: -2.0, abilityMax: -1.0, description: "Elementary" },
  { level: "B1", abilityMin: -1.0, abilityMax: 0.0, description: "Intermediate" },
  { level: "B2", abilityMin: 0.0, abilityMax: 1.0, description: "Upper Intermediate" },
  { level: "C1", abilityMin: 1.0, abilityMax: 2.0, description: "Advanced" },
  { level: "C2", abilityMin: 2.0, abilityMax: 3.0, description: "Proficient" },
];

function getLevelsForLanguage(language: string) {
  return language === "japanese" ? JAPANESE_LEVELS : CEFR_LEVELS;
}

function abilityToLevel(ability: number, language: string): string {
  const levels = getLevelsForLanguage(language);
  for (const level of levels) {
    if (ability >= level.abilityMin && ability < level.abilityMax) {
      return level.level;
    }
  }
  // Default to highest or lowest based on ability
  return ability >= 0 ? levels[levels.length - 1].level : levels[0].level;
}

function levelToAbility(level: string, language: string): number {
  const levels = getLevelsForLanguage(language);
  const found = levels.find(l => l.level === level);
  if (found) {
    return (found.abilityMin + found.abilityMax) / 2;
  }
  return 0; // Default to middle
}

// ============================================
// ITEM RESPONSE THEORY (IRT) FUNCTIONS
// ============================================

/**
 * 3-Parameter Logistic Model (3PL) probability of correct answer
 * P(θ) = c + (1-c) / (1 + e^(-a(θ-b)))
 * Where: θ = ability, a = discrimination (default 1), b = difficulty, c = guessing (0.25 for 4-choice)
 */
function probabilityCorrect(ability: number, difficulty: number, guessing = 0.25): number {
  const discrimination = 1.0;
  const exponent = -discrimination * (ability - difficulty);
  return guessing + (1 - guessing) / (1 + Math.exp(exponent));
}

/**
 * Information function - how much information this item provides at given ability
 * Higher information = better discriminates at this ability level
 */
function itemInformation(ability: number, difficulty: number, guessing = 0.25): number {
  const p = probabilityCorrect(ability, difficulty, guessing);
  const q = 1 - p;
  const pPrime = p * (1 - p) / (1 - guessing); // Derivative approximation

  if (p === 0 || q === 0) return 0;
  return (pPrime * pPrime) / (p * q);
}

/**
 * Update ability estimate using Maximum Likelihood Estimation
 * Simplified Newton-Raphson method
 */
function updateAbilityEstimate(
  currentAbility: number,
  responses: Array<{ difficulty: number; correct: boolean }>,
  guessing = 0.25
): { ability: number; standardError: number } {
  let theta = currentAbility;

  // Newton-Raphson iterations
  for (let iteration = 0; iteration < 10; iteration++) {
    let numerator = 0;
    let denominator = 0;

    for (const response of responses) {
      const p = probabilityCorrect(theta, response.difficulty, guessing);
      const pStar = (p - guessing) / (1 - guessing);

      numerator += response.correct ? (1 - p) * pStar / p : -pStar;
      denominator += pStar * (1 - p);
    }

    if (Math.abs(denominator) < 0.001) break;

    const delta = numerator / denominator;
    theta += delta;

    // Clamp to reasonable range
    theta = Math.max(-3, Math.min(3, theta));

    if (Math.abs(delta) < 0.01) break;
  }

  // Calculate standard error (inverse square root of information)
  let totalInfo = 0;
  for (const response of responses) {
    totalInfo += itemInformation(theta, response.difficulty, guessing);
  }

  const standardError = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : 1.0;

  return { ability: theta, standardError };
}

/**
 * Select next question difficulty to maximize information
 * Uses Maximum Fisher Information criterion
 */
function selectNextDifficulty(currentAbility: number): number {
  // For 3PL model with guessing = 0.25, optimal difficulty is slightly above ability
  // Adding small random variation to avoid pattern
  const optimalDifficulty = currentAbility + 0.3 + (Math.random() * 0.4 - 0.2);
  return Math.max(-3, Math.min(3, optimalDifficulty));
}

// ============================================
// QUERIES
// ============================================

/**
 * Get user's current or most recent placement test for a language
 */
export const getForUser = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("placementTests")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .order("desc")
      .first();
  },
});

/**
 * Get placement test by ID
 */
export const get = query({
  args: {
    id: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get user's proficiency level for a language
 */
export const getUserLevel = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user?.proficiencyLevels) return null;

    const langKey = args.language as keyof typeof user.proficiencyLevels;
    return user.proficiencyLevels[langKey] ?? null;
  },
});

/**
 * Get grading profile for a level
 */
export const getGradingProfile = query({
  args: {
    language: languageValidator,
    level: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gradingProfiles")
      .withIndex("by_language_and_level", (q) =>
        q.eq("language", args.language).eq("level", args.level)
      )
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Start a new placement test
 */
export const create = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Check for existing in-progress test
    const existing = await ctx.db
      .query("placementTests")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .first();

    if (existing) {
      return existing._id;
    }

    // Start at middle ability (0.0)
    const id = await ctx.db.insert("placementTests", {
      userId: args.userId,
      language: args.language,
      status: "in_progress",
      questions: [],
      currentAbilityEstimate: 0.0,
      abilityStandardError: 1.5, // High initial uncertainty
      questionsAnswered: 0,
      correctAnswers: 0,
      startedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Add a question to the test (called after AI generates it)
 */
export const addQuestion = mutation({
  args: {
    testId: v.id("placementTests"),
    question: v.object({
      questionId: v.string(),
      level: v.string(),
      type: v.union(
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening")
      ),
      question: v.string(),
      questionTranslation: v.optional(v.string()),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      difficulty: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.status !== "in_progress") {
      throw new Error("Test not found or not in progress");
    }

    const questions = [...test.questions, args.question];

    await ctx.db.patch(args.testId, { questions });
  },
});

/**
 * Submit an answer and update ability estimate
 */
export const submitAnswer = mutation({
  args: {
    testId: v.id("placementTests"),
    questionIndex: v.number(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.status !== "in_progress") {
      throw new Error("Test not found or not in progress");
    }

    if (args.questionIndex < 0 || args.questionIndex >= test.questions.length) {
      throw new Error("Invalid question index");
    }

    const questions = [...test.questions];
    const question = questions[args.questionIndex];

    if (question.userAnswer !== undefined) {
      throw new Error("Question already answered");
    }

    const isCorrect = args.answer === question.correctAnswer;

    questions[args.questionIndex] = {
      ...question,
      userAnswer: args.answer,
      isCorrect,
      answeredAt: Date.now(),
    };

    // Build response history for IRT estimation
    const responses = questions
      .filter((q) => q.userAnswer !== undefined && q.isCorrect !== undefined)
      .map((q) => ({
        difficulty: q.difficulty,
        correct: q.isCorrect!,
      }));

    // Update ability estimate
    const { ability, standardError } = updateAbilityEstimate(
      test.currentAbilityEstimate,
      responses
    );

    await ctx.db.patch(args.testId, {
      questions,
      currentAbilityEstimate: ability,
      abilityStandardError: standardError,
      questionsAnswered: test.questionsAnswered + 1,
      correctAnswers: test.correctAnswers + (isCorrect ? 1 : 0),
    });

    return {
      isCorrect,
      newAbilityEstimate: ability,
      standardError,
      questionsAnswered: test.questionsAnswered + 1,
    };
  },
});

/**
 * Complete the test and determine final level
 */
export const complete = mutation({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.status !== "in_progress") {
      throw new Error("Test not found or not in progress");
    }

    // Calculate section scores
    const sectionScores: Record<string, { correct: number; total: number }> = {};
    for (const q of test.questions) {
      if (q.userAnswer !== undefined) {
        if (!sectionScores[q.type]) {
          sectionScores[q.type] = { correct: 0, total: 0 };
        }
        sectionScores[q.type].total++;
        if (q.isCorrect) {
          sectionScores[q.type].correct++;
        }
      }
    }

    const scoresBySection: Record<string, number> = {};
    for (const [type, scores] of Object.entries(sectionScores)) {
      scoresBySection[type] = Math.round((scores.correct / scores.total) * 100);
    }

    // Determine final level from ability estimate
    const determinedLevel = abilityToLevel(test.currentAbilityEstimate, test.language);

    // Calculate confidence (inverse of standard error, scaled to 0-100)
    const confidence = Math.min(100, Math.round((1 / test.abilityStandardError) * 50));

    await ctx.db.patch(args.testId, {
      status: "completed",
      determinedLevel,
      confidence,
      scoresBySection,
      completedAt: Date.now(),
    });

    // Update user's proficiency level
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", test.userId))
      .first();

    if (user) {
      const proficiencyLevels = user.proficiencyLevels ?? {};
      const langKey = test.language as "japanese" | "english" | "french";

      const updatedLevels = {
        ...proficiencyLevels,
        [langKey]: {
          level: determinedLevel,
          assessedAt: Date.now(),
          testId: args.testId,
        },
      };

      await ctx.db.patch(user._id, {
        proficiencyLevels: updatedLevels,
        updatedAt: Date.now(),
      });
    }

    return {
      determinedLevel,
      confidence,
      scoresBySection,
      abilityEstimate: test.currentAbilityEstimate,
    };
  },
});

/**
 * Abandon a test in progress
 */
export const abandon = mutation({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.status !== "in_progress") {
      throw new Error("Test not found or not in progress");
    }

    await ctx.db.patch(args.testId, {
      status: "abandoned",
    });
  },
});

// ============================================
// INTERNAL MUTATIONS (for AI actions)
// ============================================

export const addQuestionFromAI = internalMutation({
  args: {
    testId: v.id("placementTests"),
    question: v.object({
      questionId: v.string(),
      level: v.string(),
      type: v.union(
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening")
      ),
      question: v.string(),
      questionTranslation: v.optional(v.string()),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      difficulty: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.status !== "in_progress") {
      throw new Error("Test not found or not in progress");
    }

    const questions = [...test.questions, args.question];

    await ctx.db.patch(args.testId, { questions });

    return questions.length - 1; // Return the index of the new question
  },
});

// ============================================
// HELPER EXPORTS (for AI actions)
// ============================================

export const _helpers = {
  selectNextDifficulty,
  abilityToLevel,
  levelToAbility,
  getLevelsForLanguage,
};

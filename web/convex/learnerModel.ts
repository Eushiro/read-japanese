import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import { getYesterdayString } from "./lib/helpers";
import { type ContentLanguage, languageValidator, questionSourceTypeValidator } from "./schema";

// ============================================
// TYPES
// ============================================

type SkillScores = {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateReadinessLevel(
  skills: SkillScores,
  vocabCoverage: { known: number; totalWords: number }
): "not_ready" | "almost_ready" | "ready" | "confident" {
  const avgSkill = (skills.vocabulary + skills.grammar + skills.reading + skills.listening) / 4;
  const vocabPercent =
    vocabCoverage.totalWords > 0 ? (vocabCoverage.known / vocabCoverage.totalWords) * 100 : 0;

  if (avgSkill >= 90 && vocabPercent >= 90) return "confident";
  if (avgSkill >= 80 && vocabPercent >= 80) return "ready";
  if (avgSkill >= 60 && vocabPercent >= 60) return "almost_ready";
  return "not_ready";
}

function updateSkillScore(currentScore: number, newScore: number, sampleSize: number): number {
  // Weighted average: give more weight to existing score as sample size increases
  const existingWeight = Math.min(0.8, sampleSize / 100);
  const newWeight = 1 - existingWeight;
  return Math.round(currentScore * existingWeight + newScore * newWeight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Convert IRT ability estimate (-3 to +3) to proficiency level
 * Applies i+1 principle by adding a small buffer to target slightly above current level
 */
export function abilityToProficiency(
  abilityEstimate: number,
  language: ContentLanguage,
  applyI1: boolean = true
): string {
  // Apply i+1 targeting (+0.3 ability boost)
  const targetAbility = applyI1 ? abilityEstimate + 0.3 : abilityEstimate;

  if (language === "japanese") {
    // JLPT scale: N5 (easiest) to N1 (hardest)
    // Map ability to levels: -3 to 3 → N5 to N1
    if (targetAbility <= -2) return "N5";
    if (targetAbility <= -1) return "N4";
    if (targetAbility <= 0.5) return "N3";
    if (targetAbility <= 1.5) return "N2";
    return "N1";
  } else {
    // CEFR scale: A1 (easiest) to C2 (hardest)
    // Map ability to levels: -3 to 3 → A1 to C2
    if (targetAbility <= -2) return "A1";
    if (targetAbility <= -1) return "A2";
    if (targetAbility <= 0) return "B1";
    if (targetAbility <= 1) return "B2";
    if (targetAbility <= 2) return "C1";
    return "C2";
  }
}

/**
 * Get levels within a buffer range of the target level
 * Returns an array of levels that are within +/- buffer of the target
 */
export function getLevelsInRange(
  targetLevel: string,
  language: ContentLanguage,
  buffer: number = 1
): string[] {
  const levels =
    language === "japanese" ? ["N5", "N4", "N3", "N2", "N1"] : ["A1", "A2", "B1", "B2", "C1", "C2"];

  const targetIndex = levels.indexOf(targetLevel);
  if (targetIndex === -1) return levels;

  const minIndex = Math.max(0, targetIndex - buffer);
  const maxIndex = Math.min(levels.length - 1, targetIndex + buffer);

  return levels.slice(minIndex, maxIndex + 1);
}

function getDefaultProfile(userId: string, language: string) {
  const now = Date.now();
  return {
    userId,
    language: language as "japanese" | "english" | "french",
    abilityEstimate: 0,
    abilityConfidence: 1.0,
    abilityBySkill: {
      vocabulary: 0,
      grammar: 0,
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
    },
    skills: {
      vocabulary: 50,
      grammar: 50,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 50,
    },
    weakAreas: [],
    vocabCoverage: {
      targetLevel: "",
      totalWords: 0,
      known: 0,
      learning: 0,
      unknown: 0,
    },
    readiness: {
      level: "not_ready" as const,
      confidence: 0,
    },
    interestWeights: [],
    engagementStats: {
      avgDwellMs: 0,
      completionRate: 0,
      skipRate: 0,
      replayRate: 0,
      lastRating: undefined,
      engagementMean: 0,
      engagementVariance: 1,
    },
    difficultyCalibration: {
      targetAccuracy: 0.75,
      recentAccuracy: 0.75,
      lastAdjustAt: now,
    },
    totalStudyMinutes: 0,
    // NOTE: Streak data lives in `users` table, not here
    updatedAt: now,
  };
}

// ============================================
// QUERIES
// ============================================

// Get learner profile for a user and language
export const getProfile = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();
  },
});

// Get all profiles for a user (all languages)
export const getAllProfiles = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnerProfile")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get weak areas for a user
export const getWeakAreas = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) return [];

    // Sort by score (lowest first) and return limited results
    const sorted = [...profile.weakAreas].sort((a, b) => a.score - b.score);
    return sorted.slice(0, args.limit ?? 10);
  },
});

// Get readiness prediction for an exam type
export const getReadiness = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      return {
        level: "not_ready" as const,
        predictedScore: null,
        confidence: 0,
        skills: null,
        vocabCoverage: null,
      };
    }

    return {
      level: profile.readiness.level,
      predictedScore: profile.readiness.predictedScore,
      confidence: profile.readiness.confidence,
      skills: profile.skills,
      vocabCoverage: profile.vocabCoverage,
    };
  },
});

// Get recommended difficulty level for content selection
export const getRecommendedDifficulty = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    buffer: v.optional(v.number()), // Level buffer (default 1)
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    const abilityEstimate = profile?.abilityEstimate ?? 0;
    const language = args.language as ContentLanguage;
    const buffer = args.buffer ?? 1;

    // Get target level with i+1 applied
    const targetLevel = abilityToProficiency(abilityEstimate, language, true);

    // Get acceptable level range
    const acceptableLevels = getLevelsInRange(targetLevel, language, buffer);

    return {
      abilityEstimate,
      targetLevel,
      acceptableLevels,
      hasProfile: !!profile,
    };
  },
});

// Get daily progress history
export const getDailyProgress = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    days: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - args.days);
    const startDateStr = startDate.toISOString().split("T")[0];

    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_user_language_date", (q) =>
        q.eq("userId", args.userId).eq("language", args.language).gte("date", startDateStr)
      )
      .collect();

    return progress.sort((a, b) => a.date.localeCompare(b.date));
  },
});

// Get question history for a user
export const getQuestionHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    sourceType: v.optional(questionSourceTypeValidator),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("questionHistory")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("desc");

    const results = await query.take(args.limit ?? 50);

    if (args.sourceType) {
      return results.filter((q) => q.sourceType === args.sourceType);
    }

    return results;
  },
});

// Internal query for getting profile
export const getProfileInternal = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create or get learner profile
export const getOrCreateProfile = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (existing) return existing._id;

    const profile = getDefaultProfile(args.userId, args.language);
    return await ctx.db.insert("learnerProfile", profile);
  },
});

// Update profile after flashcard reviews
export const updateFromFlashcards = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    cardsReviewed: v.number(),
    cardsCorrect: v.number(),
    studyMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    // Calculate new vocabulary score
    const accuracy =
      args.cardsReviewed > 0
        ? (args.cardsCorrect / args.cardsReviewed) * 100
        : profile.skills.vocabulary;

    const newVocabScore = updateSkillScore(profile.skills.vocabulary, accuracy, args.cardsReviewed);

    const newSkills = { ...profile.skills, vocabulary: newVocabScore };
    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    // Update profile
    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      totalStudyMinutes: profile.totalStudyMinutes + (args.studyMinutes ?? 0),
      lastActivityAt: now,
      updatedAt: now,
    });

    // Update daily progress
    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      cardsReviewed: args.cardsReviewed,
      cardsCorrect: args.cardsCorrect,
      studyMinutes: args.studyMinutes ?? 0,
    });
  },
});

// Update profile after exam
export const updateFromExam = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    sectionScores: v.object({
      reading: v.optional(v.number()),
      listening: v.optional(v.number()),
      vocabulary: v.optional(v.number()),
      grammar: v.optional(v.number()),
      writing: v.optional(v.number()),
    }),
    weakTopics: v.optional(
      v.array(
        v.object({
          skill: v.string(),
          topic: v.string(),
          score: v.number(),
        })
      )
    ),
    questionsAnswered: v.number(),
    questionsCorrect: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    // Update skill scores from section scores
    const newSkills = { ...profile.skills };
    if (args.sectionScores.reading !== undefined) {
      newSkills.reading = updateSkillScore(profile.skills.reading, args.sectionScores.reading, 10);
    }
    if (args.sectionScores.listening !== undefined) {
      newSkills.listening = updateSkillScore(
        profile.skills.listening,
        args.sectionScores.listening,
        10
      );
    }
    if (args.sectionScores.vocabulary !== undefined) {
      newSkills.vocabulary = updateSkillScore(
        profile.skills.vocabulary,
        args.sectionScores.vocabulary,
        10
      );
    }
    if (args.sectionScores.grammar !== undefined) {
      newSkills.grammar = updateSkillScore(profile.skills.grammar, args.sectionScores.grammar, 10);
    }
    if (args.sectionScores.writing !== undefined) {
      newSkills.writing = updateSkillScore(profile.skills.writing, args.sectionScores.writing, 10);
    }

    // Update weak areas
    let newWeakAreas = [...profile.weakAreas];
    if (args.weakTopics) {
      for (const topic of args.weakTopics) {
        const existingIndex = newWeakAreas.findIndex(
          (w) => w.skill === topic.skill && w.topic === topic.topic
        );

        if (existingIndex >= 0) {
          // Update existing weak area
          newWeakAreas[existingIndex] = {
            ...newWeakAreas[existingIndex],
            score: updateSkillScore(newWeakAreas[existingIndex].score, topic.score, 5),
            lastTestedAt: now,
            questionCount: newWeakAreas[existingIndex].questionCount + 1,
          };
        } else if (topic.score < 70) {
          // Add new weak area if score is below threshold
          newWeakAreas.push({
            skill: topic.skill,
            topic: topic.topic,
            score: topic.score,
            lastTestedAt: now,
            questionCount: 1,
          });
        }
      }

      // Remove weak areas that are now strong (score > 80)
      newWeakAreas = newWeakAreas.filter((w) => w.score < 80);
    }

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    // Update profile
    await ctx.db.patch(profile._id, {
      skills: newSkills,
      weakAreas: newWeakAreas,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });

    // Update daily progress
    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      questionsAnswered: args.questionsAnswered,
      questionsCorrect: args.questionsCorrect,
    });
  },
});

// Update profile after comprehension quiz
export const updateFromComprehension = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    readingScore: v.optional(v.number()),
    listeningScore: v.optional(v.number()),
    questionsAnswered: v.number(),
    questionsCorrect: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const newSkills = { ...profile.skills };
    if (args.readingScore !== undefined) {
      newSkills.reading = updateSkillScore(profile.skills.reading, args.readingScore, 5);
    }
    if (args.listeningScore !== undefined) {
      newSkills.listening = updateSkillScore(profile.skills.listening, args.listeningScore, 5);
    }

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });

    // Update daily progress
    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      questionsAnswered: args.questionsAnswered,
      questionsCorrect: args.questionsCorrect,
      contentConsumed: 1,
    });
  },
});

// Update profile after adaptive content interaction
export const updateFromAdaptiveContent = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    contentId: v.string(),
    contentType: v.string(),
    difficultyEstimate: v.number(),
    skillsTested: v.array(
      v.object({
        skill: v.string(),
        weight: v.number(),
      })
    ),
    score: v.number(), // 0-100
    rating: v.optional(v.number()),
    dwellMs: v.optional(v.number()),
    replays: v.optional(v.number()),
    skips: v.optional(v.number()),
    topicTags: v.optional(v.array(v.string())),
    confidence: v.optional(v.number()),
    estimatedWordCount: v.optional(v.number()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const p = clamp(args.score / 100, 0, 1);
    // Use profile's abilityConfidence (SE) for learning rate:
    // High SE (uncertain) → k=0.15 (learn fast). Low SE (confident) → k=0.03 (fine-tune).
    const se = profile.abilityConfidence;
    const k = lerp(0.03, 0.15, se);

    const expected = 1 / (1 + Math.exp(-1.7 * (profile.abilityEstimate - args.difficultyEstimate)));
    const abilityEstimate = clamp(profile.abilityEstimate + k * (p - expected), -3, 3);

    // Update per-skill ability estimates
    const abilityBySkill = { ...(profile.abilityBySkill ?? {}) } as SkillScores;
    for (const skill of [
      "vocabulary",
      "grammar",
      "reading",
      "listening",
      "writing",
      "speaking",
    ] as const) {
      if (abilityBySkill[skill] === undefined) {
        abilityBySkill[skill] = profile.abilityEstimate;
      }
    }

    const skillWeightSum =
      args.skillsTested.reduce((sum, s) => sum + s.weight, 0) || args.skillsTested.length || 1;

    for (const { skill, weight } of args.skillsTested) {
      const normalizedWeight = weight / skillWeightSum;
      if (skill in abilityBySkill) {
        abilityBySkill[skill as keyof SkillScores] = clamp(
          abilityBySkill[skill as keyof SkillScores] + k * normalizedWeight * (p - expected),
          -3,
          3
        );
      }
    }

    // Skill EMA update (0-100)
    const sampleSize = Math.max(1, Math.round(profile.totalStudyMinutes / 5));
    const alpha = clamp(2 / (sampleSize + 2), 0.05, 0.25);
    const newSkills = { ...profile.skills };
    for (const { skill, weight } of args.skillsTested) {
      if (skill in newSkills) {
        const current = newSkills[skill as keyof SkillScores];
        const weightedDelta = alpha * (weight / skillWeightSum) * (args.score - current);
        newSkills[skill as keyof SkillScores] = Math.round(current + weightedDelta);
      }
    }

    // Recent accuracy EMA
    const calibration = profile.difficultyCalibration ?? {
      targetAccuracy: 0.75,
      recentAccuracy: 0.75,
      lastAdjustAt: now,
    };
    const recentAccuracy = calibration.recentAccuracy + 0.1 * (p - calibration.recentAccuracy);

    // Engagement normalization
    const dwellMs = args.dwellMs ?? 0;
    const replays = args.replays ?? 0;
    const skips = args.skips ?? 0;
    const rating = args.rating ?? 0;
    const estimatedWordCount = args.estimatedWordCount ?? 100;
    const expectedDwellMs = estimatedWordCount * 250;
    const dwellRatio = expectedDwellMs > 0 ? dwellMs / expectedDwellMs : 0;

    const engagementRaw = 1000 * dwellRatio + 2 * replays - 3 * skips + 500 * rating;

    const prevEngagement = profile.engagementStats ?? {
      avgDwellMs: 0,
      completionRate: 0,
      skipRate: 0,
      replayRate: 0,
      lastRating: undefined,
      engagementMean: 0,
      engagementVariance: 1,
    };

    const engagementEma = 0.1;
    const engagementMean =
      prevEngagement.engagementMean +
      engagementEma * (engagementRaw - prevEngagement.engagementMean);
    const engagementVariance =
      prevEngagement.engagementVariance +
      engagementEma * ((engagementRaw - engagementMean) ** 2 - prevEngagement.engagementVariance);
    const engagementStd = Math.sqrt(Math.max(engagementVariance, 1));
    const engagement = clamp((engagementRaw - engagementMean) / Math.max(engagementStd, 1), -3, 3);

    // Interest updates
    const interestWeightsMap = new Map(
      (profile.interestWeights ?? []).map((entry) => [entry.tag, entry])
    );
    const tags = args.topicTags ?? [];
    for (const tag of tags) {
      const current = interestWeightsMap.get(tag)?.weight ?? 0;
      const updated = clamp(current * 0.98 + 0.05 * engagement, -1, 1);
      interestWeightsMap.set(tag, { tag, weight: updated, updatedAt: now });
    }

    const interestWeights = Array.from(interestWeightsMap.values());

    const completionRate =
      args.completed === undefined
        ? prevEngagement.completionRate
        : prevEngagement.completionRate +
          engagementEma * ((args.completed ? 1 : 0) - prevEngagement.completionRate);

    const skipRate =
      prevEngagement.skipRate + engagementEma * ((skips > 0 ? 1 : 0) - prevEngagement.skipRate);
    const replayRate =
      prevEngagement.replayRate +
      engagementEma * ((replays > 0 ? 1 : 0) - prevEngagement.replayRate);
    const avgDwellMs =
      prevEngagement.avgDwellMs + engagementEma * (dwellMs - prevEngagement.avgDwellMs);

    const engagementStats = {
      avgDwellMs,
      completionRate,
      skipRate,
      replayRate,
      lastRating: args.rating ?? prevEngagement.lastRating,
      engagementMean,
      engagementVariance,
    };

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);
    const studyMinutes = dwellMs > 0 ? Math.max(1, Math.round(dwellMs / 60000)) : 0;

    // Decay SE (abilityConfidence) after each interaction
    // More questions → more confidence (lower SE). Floor at 0.15 (very confident).
    const numQuestions = args.skillsTested.length || 1;
    const newSE = Math.max(0.15, se * Math.pow(0.85, numQuestions));

    await ctx.db.patch(profile._id, {
      abilityEstimate,
      abilityConfidence: newSE,
      abilityBySkill,
      skills: newSkills,
      interestWeights,
      engagementStats,
      difficultyCalibration: {
        ...calibration,
        recentAccuracy,
        lastAdjustAt: now,
      },
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      totalStudyMinutes: profile.totalStudyMinutes + studyMinutes,
      lastActivityAt: now,
      updatedAt: now,
    });

    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      contentConsumed: 1,
      studyMinutes,
    });
  },
});

// Update profile after sentence practice
export const updateFromSentencePractice = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    grammarScore: v.number(),
    usageScore: v.number(),
    naturalnessScore: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    // Weighted average of the scores
    const writingScore =
      args.grammarScore * 0.4 + args.usageScore * 0.3 + args.naturalnessScore * 0.3;

    const newSkills = {
      ...profile.skills,
      grammar: updateSkillScore(profile.skills.grammar, args.grammarScore, 3),
      writing: updateSkillScore(profile.skills.writing, writingScore, 3),
    };

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

// Update profile after shadowing practice
export const updateFromShadowing = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    accuracyScore: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const newSkills = {
      ...profile.skills,
      speaking: updateSkillScore(profile.skills.speaking, args.accuracyScore, 3),
    };

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

// Update vocabulary coverage
export const updateVocabCoverage = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    targetLevel: v.string(),
    totalWords: v.number(),
    known: v.number(),
    learning: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create profile
    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const vocabCoverage = {
      targetLevel: args.targetLevel,
      totalWords: args.totalWords,
      known: args.known,
      learning: args.learning,
      unknown: args.totalWords - args.known - args.learning,
    };

    const newReadiness = calculateReadinessLevel(profile.skills, vocabCoverage);

    await ctx.db.patch(profile._id, {
      vocabCoverage,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      updatedAt: now,
    });
  },
});

// Record a question to history
export const recordQuestion = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    sourceType: questionSourceTypeValidator,
    sourceId: v.optional(v.string()),
    questionContent: v.object({
      questionText: v.string(),
      questionType: v.string(),
      options: v.optional(v.array(v.string())),
      correctAnswer: v.optional(v.string()),
      acceptableAnswers: v.optional(v.array(v.string())),
      rubric: v.optional(v.string()),
      passageText: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
    }),
    userAnswer: v.string(),
    responseTimeMs: v.optional(v.number()),
    skills: v.array(
      v.object({
        skill: v.string(),
        weight: v.number(),
      })
    ),
    topics: v.optional(v.array(v.string())),
    difficulty: v.optional(v.number()),
    grading: v.object({
      isCorrect: v.boolean(),
      score: v.optional(v.number()),
      modelUsed: v.optional(v.string()),
      feedback: v.optional(v.string()),
      detailedScores: v.optional(
        v.object({
          grammar: v.optional(v.number()),
          usage: v.optional(v.number()),
          naturalness: v.optional(v.number()),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("questionHistory", {
      userId: args.userId,
      language: args.language,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      questionContent: args.questionContent,
      userAnswer: args.userAnswer,
      responseTimeMs: args.responseTimeMs,
      skills: args.skills,
      topics: args.topics,
      difficulty: args.difficulty,
      grading: {
        ...args.grading,
        gradedAt: now,
      },
      answeredAt: now,
    });
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

// Internal helper for updating daily progress
async function updateDailyProgressInternal(
  ctx: MutationCtx,
  args: {
    userId: string;
    language: ContentLanguage;
    cardsReviewed?: number;
    cardsCorrect?: number;
    questionsAnswered?: number;
    questionsCorrect?: number;
    wordsLearned?: number;
    contentConsumed?: number;
    studyMinutes?: number;
  }
) {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];

  // Get existing progress for today
  const existing = await ctx.db
    .query("dailyProgress")
    .withIndex("by_user_language_date", (q) =>
      q.eq("userId", args.userId).eq("language", args.language).eq("date", today)
    )
    .first();

  if (existing) {
    // Update existing record
    await ctx.db.patch(existing._id, {
      cardsReviewed: existing.cardsReviewed + (args.cardsReviewed ?? 0),
      cardsCorrect: existing.cardsCorrect + (args.cardsCorrect ?? 0),
      questionsAnswered: existing.questionsAnswered + (args.questionsAnswered ?? 0),
      questionsCorrect: existing.questionsCorrect + (args.questionsCorrect ?? 0),
      wordsLearned: existing.wordsLearned + (args.wordsLearned ?? 0),
      contentConsumed: existing.contentConsumed + (args.contentConsumed ?? 0),
      studyMinutes: existing.studyMinutes + (args.studyMinutes ?? 0),
    });
  } else {
    // Create new record
    // Get current skill snapshot from learner profile
    const profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    const skills = profile?.skills ?? {
      vocabulary: 50,
      grammar: 50,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 50,
    };
    const skillSnapshot = {
      vocabulary: skills.vocabulary,
      grammar: skills.grammar,
      reading: skills.reading,
      listening: skills.listening,
      writing: skills.writing,
      speaking: skills.speaking,
    };

    await ctx.db.insert("dailyProgress", {
      userId: args.userId,
      date: today,
      language: args.language,
      studyMinutes: args.studyMinutes ?? 0,
      cardsReviewed: args.cardsReviewed ?? 0,
      cardsCorrect: args.cardsCorrect ?? 0,
      questionsAnswered: args.questionsAnswered ?? 0,
      questionsCorrect: args.questionsCorrect ?? 0,
      wordsLearned: args.wordsLearned ?? 0,
      contentConsumed: args.contentConsumed ?? 0,
      skillSnapshot,
      createdAt: now,
    });

    // Update streak on first activity of the day
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();
    if (user) {
      const yesterdayStr = getYesterdayString();
      const lastActivity = user.lastActivityDate;
      const currentStreak = user.currentStreak ?? 0;
      const longestStreak = user.longestStreak ?? 0;

      // Calculate new streak: continues if last activity was yesterday, otherwise resets to 1
      const newStreak = lastActivity === yesterdayStr ? currentStreak + 1 : 1;
      const newLongestStreak = Math.max(longestStreak, newStreak);

      await ctx.db.patch(user._id, {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: today,
        updatedAt: now,
      });
    }
  }
}

// Internal mutation for updating profile from other modules
export const updateProfileInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    skill: v.string(),
    score: v.number(),
    sampleSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const skillKey = args.skill as keyof SkillScores;
    if (skillKey in profile.skills) {
      const newSkills = {
        ...profile.skills,
        [skillKey]: updateSkillScore(profile.skills[skillKey], args.score, args.sampleSize ?? 1),
      };

      const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

      await ctx.db.patch(profile._id, {
        skills: newSkills,
        readiness: {
          ...profile.readiness,
          level: newReadiness,
        },
        lastActivityAt: now,
        updatedAt: now,
      });
    }
  },
});

// ============================================
// CONTENT PREFERENCES (reads from userPreferences table)
// ============================================

// Get content preferences for a user
export const getContentPreferences = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs?.content) {
      return null;
    }

    // Return in legacy format for backwards compatibility
    return {
      userId: prefs.userId,
      interests: prefs.content.interests ?? [],
      tonePreference: prefs.content.tonePreference,
      ageAppropriate: prefs.content.ageAppropriate,
      culturalFocus: prefs.content.culturalFocus,
      learningGoal: prefs.content.learningGoal,
      avoidTopics: prefs.content.avoidTopics,
      updatedAt: prefs.updatedAt,
    };
  },
});

// Update content preferences
export const updateContentPreferences = mutation({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    interests: v.optional(v.array(v.string())),
    tonePreference: v.optional(v.string()),
    ageAppropriate: v.optional(v.string()),
    culturalFocus: v.optional(v.array(v.string())),
    learningGoal: v.optional(v.string()),
    avoidTopics: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      const currentContent = existing.content ?? {};
      await ctx.db.patch(existing._id, {
        content: {
          interests: args.interests ?? currentContent.interests ?? [],
          tonePreference: args.tonePreference ?? currentContent.tonePreference,
          ageAppropriate: args.ageAppropriate ?? currentContent.ageAppropriate,
          culturalFocus: args.culturalFocus ?? currentContent.culturalFocus,
          learningGoal: args.learningGoal ?? currentContent.learningGoal,
          avoidTopics: args.avoidTopics ?? currentContent.avoidTopics,
        },
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new userPreferences with content
      return await ctx.db.insert("userPreferences", {
        userId: args.userId,
        display: { showFurigana: true, theme: "system", fontSize: "medium" },
        audio: { autoplay: false, highlightMode: "sentence", speed: 1.0 },
        srs: {
          dailyReviewGoal: 50,
          newCardsPerDay: 20,
          sentenceRefreshDays: 30,
          desiredRetention: 0.9,
          maximumInterval: 365,
          preset: "default",
        },
        content: {
          interests: args.interests ?? [],
          tonePreference: args.tonePreference,
          ageAppropriate: args.ageAppropriate,
          culturalFocus: args.culturalFocus,
          learningGoal: args.learningGoal,
          avoidTopics: args.avoidTopics,
        },
        notifications: { reviewReminderEnabled: false, reviewReminderTime: "09:00" },
        updatedAt: now,
      });
    }
  },
});

// ============================================
// FSRS SETTINGS (reads from userPreferences table)
// ============================================

// Get FSRS settings for a user
export const getFsrsSettings = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs) {
      // Return defaults
      return {
        userId: args.userId,
        desiredRetention: 0.9,
        dailyNewCards: 10,
        maximumInterval: 365,
        preset: "default",
      };
    }

    // Return in legacy format for backwards compatibility
    return {
      userId: prefs.userId,
      desiredRetention: prefs.srs.desiredRetention ?? 0.9,
      dailyNewCards: prefs.srs.newCardsPerDay ?? 10,
      maximumInterval: prefs.srs.maximumInterval ?? 365,
      customWeights: prefs.srs.customWeights,
      preset: prefs.srs.preset ?? "default",
      updatedAt: prefs.updatedAt,
    };
  },
});

// Update FSRS settings
export const updateFsrsSettings = mutation({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    desiredRetention: v.optional(v.number()),
    dailyNewCards: v.optional(v.number()),
    maximumInterval: v.optional(v.number()),
    customWeights: v.optional(v.array(v.number())),
    preset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        srs: {
          ...existing.srs,
          ...(args.desiredRetention !== undefined && { desiredRetention: args.desiredRetention }),
          ...(args.dailyNewCards !== undefined && { newCardsPerDay: args.dailyNewCards }),
          ...(args.maximumInterval !== undefined && { maximumInterval: args.maximumInterval }),
          ...(args.customWeights !== undefined && { customWeights: args.customWeights }),
          ...(args.preset !== undefined && { preset: args.preset }),
        },
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new userPreferences with FSRS settings
      return await ctx.db.insert("userPreferences", {
        userId: args.userId,
        display: { showFurigana: true, theme: "system", fontSize: "medium" },
        audio: { autoplay: false, highlightMode: "sentence", speed: 1.0 },
        srs: {
          dailyReviewGoal: 50,
          newCardsPerDay: args.dailyNewCards ?? 10,
          sentenceRefreshDays: 30,
          desiredRetention: args.desiredRetention ?? 0.9,
          maximumInterval: args.maximumInterval ?? 365,
          customWeights: args.customWeights,
          preset: args.preset ?? "default",
        },
        notifications: { reviewReminderEnabled: false, reviewReminderTime: "09:00" },
        updatedAt: now,
      });
    }
  },
});

// ============================================
// INTERNAL MUTATIONS FOR CROSS-MODULE CALLS
// ============================================

// Internal: Update profile after flashcard reviews
export const updateFromFlashcardsInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    cardsReviewed: v.number(),
    cardsCorrect: v.number(),
    studyMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const accuracy =
      args.cardsReviewed > 0
        ? (args.cardsCorrect / args.cardsReviewed) * 100
        : profile.skills.vocabulary;

    const newVocabScore = updateSkillScore(profile.skills.vocabulary, accuracy, args.cardsReviewed);

    const newSkills = { ...profile.skills, vocabulary: newVocabScore };
    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      totalStudyMinutes: profile.totalStudyMinutes + (args.studyMinutes ?? 0),
      lastActivityAt: now,
      updatedAt: now,
    });

    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      cardsReviewed: args.cardsReviewed,
      cardsCorrect: args.cardsCorrect,
      studyMinutes: args.studyMinutes ?? 0,
    });
  },
});

// Internal: Update profile after exam
export const updateFromExamInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    sectionScores: v.object({
      reading: v.optional(v.number()),
      listening: v.optional(v.number()),
      vocabulary: v.optional(v.number()),
      grammar: v.optional(v.number()),
      writing: v.optional(v.number()),
    }),
    weakTopics: v.optional(
      v.array(
        v.object({
          skill: v.string(),
          topic: v.string(),
          score: v.number(),
        })
      )
    ),
    questionsAnswered: v.number(),
    questionsCorrect: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const newSkills = { ...profile.skills };
    if (args.sectionScores.reading !== undefined) {
      newSkills.reading = updateSkillScore(profile.skills.reading, args.sectionScores.reading, 10);
    }
    if (args.sectionScores.listening !== undefined) {
      newSkills.listening = updateSkillScore(
        profile.skills.listening,
        args.sectionScores.listening,
        10
      );
    }
    if (args.sectionScores.vocabulary !== undefined) {
      newSkills.vocabulary = updateSkillScore(
        profile.skills.vocabulary,
        args.sectionScores.vocabulary,
        10
      );
    }
    if (args.sectionScores.grammar !== undefined) {
      newSkills.grammar = updateSkillScore(profile.skills.grammar, args.sectionScores.grammar, 10);
    }
    if (args.sectionScores.writing !== undefined) {
      newSkills.writing = updateSkillScore(profile.skills.writing, args.sectionScores.writing, 10);
    }

    let newWeakAreas = [...profile.weakAreas];
    if (args.weakTopics) {
      for (const topic of args.weakTopics) {
        const existingIndex = newWeakAreas.findIndex(
          (w) => w.skill === topic.skill && w.topic === topic.topic
        );

        if (existingIndex >= 0) {
          newWeakAreas[existingIndex] = {
            ...newWeakAreas[existingIndex],
            score: updateSkillScore(newWeakAreas[existingIndex].score, topic.score, 5),
            lastTestedAt: now,
            questionCount: newWeakAreas[existingIndex].questionCount + 1,
          };
        } else if (topic.score < 70) {
          newWeakAreas.push({
            skill: topic.skill,
            topic: topic.topic,
            score: topic.score,
            lastTestedAt: now,
            questionCount: 1,
          });
        }
      }
      newWeakAreas = newWeakAreas.filter((w) => w.score < 80);
    }

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      weakAreas: newWeakAreas,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });

    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      questionsAnswered: args.questionsAnswered,
      questionsCorrect: args.questionsCorrect,
    });
  },
});

// Internal: Update profile after comprehension quiz
export const updateFromComprehensionInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    readingScore: v.optional(v.number()),
    listeningScore: v.optional(v.number()),
    questionsAnswered: v.number(),
    questionsCorrect: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const newSkills = { ...profile.skills };
    if (args.readingScore !== undefined) {
      newSkills.reading = updateSkillScore(profile.skills.reading, args.readingScore, 5);
    }
    if (args.listeningScore !== undefined) {
      newSkills.listening = updateSkillScore(profile.skills.listening, args.listeningScore, 5);
    }

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });

    await updateDailyProgressInternal(ctx, {
      userId: args.userId,
      language: args.language,
      questionsAnswered: args.questionsAnswered,
      questionsCorrect: args.questionsCorrect,
      contentConsumed: 1,
    });
  },
});

// Internal: Update profile after sentence practice
export const updateFromSentencePracticeInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    grammarScore: v.number(),
    usageScore: v.number(),
    naturalnessScore: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const writingScore =
      args.grammarScore * 0.4 + args.usageScore * 0.3 + args.naturalnessScore * 0.3;

    const newSkills = {
      ...profile.skills,
      grammar: updateSkillScore(profile.skills.grammar, args.grammarScore, 3),
      writing: updateSkillScore(profile.skills.writing, writingScore, 3),
    };

    const newReadiness = calculateReadinessLevel(newSkills, profile.vocabCoverage);

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      readiness: {
        ...profile.readiness,
        level: newReadiness,
      },
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

// Internal: Update profile after shadowing practice
export const updateFromShadowingInternal = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    accuracyScore: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (!profile) {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      const id = await ctx.db.insert("learnerProfile", defaultProfile);
      profile = (await ctx.db.get(id))!;
    }

    const newSkills = {
      ...profile.skills,
      speaking: updateSkillScore(profile.skills.speaking, args.accuracyScore, 3),
    };

    await ctx.db.patch(profile._id, {
      skills: newSkills,
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

// ============================================
// ADMIN OVERRIDES
// ============================================

const PROFILE_PRESETS = {
  diagnostic: { abilityEstimate: 0, abilityConfidence: 1.0, skillScore: 50 },
  beginner: { abilityEstimate: -2.0, abilityConfidence: 0.3, skillScore: 30 },
  intermediate: { abilityEstimate: 0.0, abilityConfidence: 0.3, skillScore: 55 },
  advanced: { abilityEstimate: 2.0, abilityConfidence: 0.3, skillScore: 85 },
} as const;

export const overrideProfile = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    adminEmail: v.string(),
    preset: v.union(
      v.literal("diagnostic"),
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
  },
  handler: async (ctx, args) => {
    if (!isAdminEmail(args.adminEmail)) {
      throw new Error("Unauthorized: Only admin can override learner profiles");
    }

    const preset = PROFILE_PRESETS[args.preset];
    const now = Date.now();

    const skillValues = {
      vocabulary: preset.skillScore,
      grammar: preset.skillScore,
      reading: preset.skillScore,
      listening: preset.skillScore,
      writing: preset.skillScore,
      speaking: preset.skillScore,
    };

    const abilityBySkill = {
      vocabulary: preset.abilityEstimate,
      grammar: preset.abilityEstimate,
      reading: preset.abilityEstimate,
      listening: preset.abilityEstimate,
      writing: preset.abilityEstimate,
      speaking: preset.abilityEstimate,
    };

    // Get or create profile
    const existing = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        abilityEstimate: preset.abilityEstimate,
        abilityConfidence: preset.abilityConfidence,
        abilityBySkill,
        skills: skillValues,
        weakAreas: [],
        updatedAt: now,
      });
    } else {
      const defaultProfile = getDefaultProfile(args.userId, args.language);
      await ctx.db.insert("learnerProfile", {
        ...defaultProfile,
        abilityEstimate: preset.abilityEstimate,
        abilityConfidence: preset.abilityConfidence,
        abilityBySkill,
        skills: skillValues,
      });
    }

    // Sync proficiency level in users table
    const targetLevel = abilityToProficiency(
      preset.abilityEstimate,
      args.language as ContentLanguage,
      false
    );
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (user) {
      const langKey = args.language as "japanese" | "english" | "french";
      if (args.preset === "diagnostic") {
        // Clear proficiency level for diagnostic
        const updatedLevels = { ...user.proficiencyLevels };
        delete updatedLevels[langKey];
        await ctx.db.patch(user._id, {
          proficiencyLevels: updatedLevels,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(user._id, {
          proficiencyLevels: {
            ...user.proficiencyLevels,
            [langKey]: { level: targetLevel, updatedAt: now },
          },
          updatedAt: now,
        });
      }
    }

    // For diagnostic preset, also delete placement tests
    if (args.preset === "diagnostic") {
      const tests = await ctx.db
        .query("placementTests")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language)
        )
        .collect();

      for (const test of tests) {
        await ctx.db.delete(test._id);
      }
    }

    return { preset: args.preset, language: args.language };
  },
});

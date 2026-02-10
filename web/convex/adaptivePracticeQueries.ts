import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import { labelToIRT } from "./lib/difficultyEstimator";
import { TEST_MODE_MODELS } from "./lib/models";
import {
  type ActiveSessionStatus,
  adaptiveContentTypeValidator,
  difficultyLevelValidator,
  languageValidator,
} from "./schema";

const LISTENING_TYPES = new Set(["listening_mcq", "dictation"]);
const SPEAKING_TYPES = new Set(["shadow_record"]);

function countAudioQuestions(questions: Array<{ type: string }>) {
  let listeningCount = 0;
  let speakingCount = 0;
  for (const q of questions) {
    if (LISTENING_TYPES.has(q.type)) listeningCount += 1;
    if (SPEAKING_TYPES.has(q.type)) speakingCount += 1;
  }
  return { listeningCount, speakingCount };
}

// ============================================
// QUERIES
// ============================================

/**
 * Get user's recent practice sessions
 */
export const getRecentSessions = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const exposures = await ctx.db
      .query("contentExposure")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .order("desc")
      .take(limit);

    return exposures;
  },
});

/**
 * Get the list of models used in admin test mode.
 * Single source of truth: TEST_MODE_MODELS from convex/lib/models.ts
 */
export const getTestModeModels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!isAdminEmail(identity?.email)) return [];
    return TEST_MODE_MODELS.map((m) => ({ model: m.model, provider: m.provider }));
  },
});

// ============================================
// INTERNAL QUERIES/MUTATIONS (server-only)
// ============================================

export const getPracticeSessionInternal = internalQuery({
  args: {
    userId: v.string(),
    practiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();
    if (!session || session.userId !== args.userId) return null;
    return session;
  },
});

export const upsertPracticeSessionInternal = internalMutation({
  args: {
    userId: v.string(),
    practiceId: v.string(),
    language: languageValidator,
    isDiagnostic: v.boolean(),
    contentId: v.optional(v.string()),
    contentType: v.optional(adaptiveContentTypeValidator),
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.string(),
        targetSkill: v.string(),
        difficulty: v.optional(difficultyLevelValidator),
      })
    ),
    modelUsed: v.optional(v.string()),
    scorerModelUsed: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
    validationFailures: v.optional(v.number()),
    repairAttempts: v.optional(v.number()),
    generationLatencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();

    if (!existing) {
      const counts = countAudioQuestions(args.questions);
      await ctx.db.insert("practiceSessions", {
        userId: args.userId,
        practiceId: args.practiceId,
        language: args.language,
        isDiagnostic: args.isDiagnostic,
        contentId: args.contentId,
        contentType: args.contentType,
        questions: args.questions,
        listeningCount: counts.listeningCount,
        speakingCount: counts.speakingCount,
        modelUsed: args.modelUsed,
        scorerModelUsed: args.scorerModelUsed,
        qualityScore: args.qualityScore,
        validationFailures: args.validationFailures,
        repairAttempts: args.repairAttempts,
        generationLatencyMs: args.generationLatencyMs,
        createdAt: now,
        updatedAt: now,
      });
      return { ...counts, totalQuestions: args.questions.length };
    }

    if (existing.userId !== args.userId) {
      throw new Error("Unauthorized session update");
    }

    const questionIds = new Set(existing.questions.map((q) => q.questionId));
    const mergedQuestions = [...existing.questions];
    for (const q of args.questions) {
      if (!questionIds.has(q.questionId)) {
        mergedQuestions.push(q);
        questionIds.add(q.questionId);
      }
    }

    const counts = countAudioQuestions(mergedQuestions);

    await ctx.db.patch(existing._id, {
      language: args.language,
      isDiagnostic: args.isDiagnostic,
      contentId: args.contentId ?? existing.contentId,
      contentType: args.contentType ?? existing.contentType,
      questions: mergedQuestions,
      listeningCount: counts.listeningCount,
      speakingCount: counts.speakingCount,
      modelUsed: args.modelUsed ?? existing.modelUsed,
      scorerModelUsed: args.scorerModelUsed ?? existing.scorerModelUsed,
      qualityScore: args.qualityScore ?? existing.qualityScore,
      validationFailures: args.validationFailures ?? existing.validationFailures,
      repairAttempts: args.repairAttempts ?? existing.repairAttempts,
      generationLatencyMs: args.generationLatencyMs ?? existing.generationLatencyMs,
      updatedAt: now,
    });

    return { ...counts, totalQuestions: mergedQuestions.length };
  },
});

// ============================================
// ACTIVE SESSION SYSTEM (unified prefetch + session lifecycle)
// ============================================

/**
 * Atomically claim a session slot for a user+language.
 * Returns the new row's ID if a "prefetching" row was inserted, null if one already exists.
 * Checks for ANY existing row (including "active") — returns null if one exists.
 */
export const claimSessionSlot = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    // Clean up any failed rows before claiming a new slot
    for (const row of existing) {
      if (row.status === "failed") {
        await ctx.db.delete(row._id);
      }
    }

    const active = existing.find(
      (r) => r.status === "prefetching" || r.status === "ready" || r.status === "active"
    );
    if (active) return null; // Already have an active session

    const now = Date.now();
    const id = await ctx.db.insert("activePracticeSessions", {
      userId: args.userId,
      language: args.language,
      status: "prefetching",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Mark a prefetching session as "ready" with the generated practice set.
 */
export const markSessionReady = internalMutation({
  args: {
    sessionId: v.id("activePracticeSessions"),
    practiceSetJson: v.string(),
    practiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.sessionId);
    if (!row || row.status !== "prefetching") return;
    await ctx.db.patch(args.sessionId, {
      practiceSetJson: args.practiceSetJson,
      practiceId: args.practiceId,
      status: "ready",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Transition a "ready" session to "active". Initializes progressJson.
 * Returns the practiceSetJson, or null if no ready session exists.
 */
export const activateSession = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const ready = rows.find((r) => r.status === "ready");
    if (!ready) return null;

    const initialProgress = JSON.stringify({
      answers: [],
      questionQueue: [],
      phase: "questions",
      totalScore: 0,
      maxScore: 0,
      contentReadTime: 0,
    });

    await ctx.db.patch(ready._id, {
      status: "active",
      progressJson: initialProgress,
      updatedAt: Date.now(),
    });
    return ready.practiceSetJson ?? null;
  },
});

/**
 * Mark a session as "failed" with an error message.
 */
export const markSessionFailed = internalMutation({
  args: {
    sessionId: v.id("activePracticeSessions"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.sessionId);
    if (!row) return;
    await ctx.db.patch(args.sessionId, {
      status: "failed",
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Invalidate (delete) prefetching/ready/failed sessions for a user+language.
 * Does NOT delete "active" sessions.
 * Called when the learner model changes (session completion).
 */
export const invalidateSession = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    for (const row of rows) {
      if (row.status === "prefetching" || row.status === "ready" || row.status === "failed") {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/**
 * Get active session for a user+language (public query for frontend).
 */
export const getActiveSession = query({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) => q.eq("userId", userId).eq("language", args.language))
      .collect();

    // Return the first non-deleted row (any status)
    const session = rows.find(
      (r) =>
        r.status === "prefetching" ||
        r.status === "ready" ||
        r.status === "active" ||
        r.status === "failed"
    );
    if (!session) return null;
    return {
      _id: session._id,
      status: session.status as ActiveSessionStatus,
      practiceId: session.practiceId,
      practiceSetJson: session.practiceSetJson,
      progressJson: session.progressJson,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },
});

/**
 * Get active session for a user+language (internal query for backend use).
 */
export const getActiveSessionInternal = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const session = rows.find(
      (r) =>
        r.status === "prefetching" ||
        r.status === "ready" ||
        r.status === "active" ||
        r.status === "failed"
    );
    if (!session) return null;
    return session;
  },
});

/**
 * Cleanup stale sessions (called by cron).
 * - "prefetching" / "failed" older than 1h → delete
 * - "ready" older than 6h → delete (stale prefetch)
 * - "active" older than 24h → delete (abandoned session)
 */
export const cleanupStaleSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    let deleted = 0;

    // Delete stuck prefetching rows (older than 1 hour)
    const prefetchingRows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_status", (q) => q.eq("status", "prefetching"))
      .collect();
    for (const row of prefetchingRows) {
      if (row.createdAt < oneHourAgo) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    // Delete failed rows (older than 1 hour)
    const failedRows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();
    for (const row of failedRows) {
      if (row.createdAt < oneHourAgo) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    // Delete stale ready rows (older than 6 hours)
    const readyRows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .collect();
    for (const row of readyRows) {
      if (row.createdAt < sixHoursAgo) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    // Delete abandoned active rows (older than 24 hours)
    const activeRows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const row of activeRows) {
      if (row.updatedAt < twentyFourHoursAgo) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} stale active practice sessions`);
    }
  },
});

// ============================================
// SESSION PROGRESS FUNCTIONS
// ============================================

/**
 * Update session progress (called per-answer from frontend).
 */
export const updateSessionProgress = mutation({
  args: {
    sessionId: v.id("activePracticeSessions"),
    progressJson: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const row = await ctx.db.get(args.sessionId);
    if (!row || row.userId !== identity.subject) throw new Error("Unauthorized");
    if (row.status !== "active") return;

    await ctx.db.patch(args.sessionId, {
      progressJson: args.progressJson,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete the active session for a user+language (called on practice completion/restart).
 */
export const deleteActiveSession = mutation({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", identity.subject).eq("language", args.language)
      )
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});

/**
 * Clear all active sessions for a user (all languages). Admin button.
 */
export const clearAllActiveSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const rows = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});

/**
 * Create an active session directly (for fresh generation, no prefetch).
 * Sets status "active" with practiceSetJson + initial progressJson.
 */
export const createActiveSessionDirect = mutation({
  args: {
    language: languageValidator,
    practiceId: v.string(),
    practiceSetJson: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Delete any existing session for this user+language first
    const existing = await ctx.db
      .query("activePracticeSessions")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", identity.subject).eq("language", args.language)
      )
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    const initialProgress = JSON.stringify({
      answers: [],
      questionQueue: [],
      phase: "questions",
      totalScore: 0,
      maxScore: 0,
      contentReadTime: 0,
    });

    const id = await ctx.db.insert("activePracticeSessions", {
      userId: identity.subject,
      language: args.language,
      practiceId: args.practiceId,
      practiceSetJson: args.practiceSetJson,
      progressJson: initialProgress,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Record a single answer immediately — updates learner model per-question.
 * Called fire-and-forget on each answer so no data is lost if user closes mid-session.
 */
export const recordAnswer = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    practiceId: v.string(),
    contentType: v.optional(adaptiveContentTypeValidator),
    isDiagnostic: v.optional(v.boolean()),
    questionId: v.string(),
    questionText: v.string(),
    questionType: v.string(),
    targetSkill: v.string(),
    difficulty: v.optional(difficultyLevelValidator),
    difficultyNumeric: v.optional(v.number()),
    userAnswer: v.string(),
    selectedOption: v.optional(v.string()), // For MCQ: which option was picked (for distractor analysis)
    passageText: v.optional(v.string()),
    isCorrect: v.boolean(),
    earnedPoints: v.number(),
    maxPoints: v.number(),
    responseTimeMs: v.optional(v.number()),
    skipped: v.optional(v.boolean()),
    // Pool tracking: hash links answer to pool question for stat calibration
    questionHash: v.string(),
    abilityEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Don't record or update model for skipped questions
    if (args.skipped) return;

    // Idempotency: check if this answer was already recorded (e.g. session restored from sessionStorage)
    const recentHistory = await ctx.db
      .query("questionHistory")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    const alreadyRecorded = recentHistory.some(
      (h) => h.sourceId === args.practiceId && h.questionContent.questionText === args.questionText
    );
    if (alreadyRecorded) return;

    // 1. Save to questionHistory
    await ctx.db.insert("questionHistory", {
      userId: args.userId,
      language: args.language,
      sourceType: args.isDiagnostic ? "placement" : "comprehension",
      sourceId: args.practiceId,
      questionContent: {
        questionText: args.questionText,
        questionType: args.questionType,
        ...(args.passageText ? { passageText: args.passageText } : {}),
      },
      userAnswer: args.userAnswer,
      selectedOption: args.selectedOption,
      responseTimeMs: args.responseTimeMs,
      skills: [{ skill: args.targetSkill, weight: 1 }],
      difficulty: args.difficultyNumeric ?? labelToIRT(args.difficulty),
      grading: {
        isCorrect: args.isCorrect,
        score: args.maxPoints > 0 ? args.earnedPoints / args.maxPoints : 0,
        gradedAt: Date.now(),
      },
      answeredAt: Date.now(),
    });

    // 2. Update question pool stats (if the question exists in the pool)
    await ctx.runMutation(internal.questionPoolQueries.updateQuestionStats, {
      questionHash: args.questionHash,
      isCorrect: args.isCorrect,
      responseTimeMs: args.responseTimeMs,
      selectedOption: args.selectedOption,
      userAbilityEstimate: args.abilityEstimate,
      userId: args.userId,
      language: args.language,
    });

    // Learner model update is deferred to session end (submitPractice / flushLearnerModel)
    // to avoid N table patches per session that cascade re-evaluations.
  },
});

/**
 * Submit practice session — lightweight, just records session-level stats.
 * Individual answers are already recorded via recordAnswer.
 */
export const submitPractice = mutation({
  args: {
    userId: v.string(),
    practiceId: v.string(),
    contentId: v.optional(v.string()),
    contentType: v.optional(adaptiveContentTypeValidator),
    language: languageValidator,
    isDiagnostic: v.optional(v.boolean()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        earnedPoints: v.number(),
        responseTimeMs: v.optional(v.number()),
      })
    ),
    totalScore: v.number(),
    maxScore: v.number(),
    dwellMs: v.optional(v.number()),
    targetSkills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const percentScore = args.maxScore > 0 ? (args.totalScore / args.maxScore) * 100 : 0;

    // Log exposure (only for normal mode with content)
    if (!args.isDiagnostic && args.contentId && args.contentType) {
      await ctx.runMutation(api.contentEngineQueries.logExposure, {
        userId: args.userId,
        contentId: args.contentId,
        contentType: args.contentType,
        language: args.language,
        servedAt: Date.now() - (args.dwellMs ?? 0),
        completedAt: Date.now(),
        score: percentScore,
        source: "generated",
        dwellMs: args.dwellMs,
        skillsTested: args.targetSkills.map((skill) => ({
          skill,
          weight: 1 / args.targetSkills.length,
        })),
      });
    }

    // Batch learner model update at session end (one update per unique skill)
    await ctx.runMutation(internal.adaptivePracticeQueries.flushLearnerModel, {
      userId: args.userId,
      language: args.language,
      practiceId: args.practiceId,
      contentType: args.contentType ?? "dialogue",
      targetSkills: args.targetSkills,
      answers: args.answers,
    });

    return {
      totalScore: args.totalScore,
      maxScore: args.maxScore,
      percentScore,
      correctCount: args.answers.filter((a) => a.isCorrect).length,
      totalQuestions: args.answers.length,
    };
  },
});

/**
 * Batch learner model update — aggregates per-question scores by skill
 * and issues a single updateFromAdaptiveContent call per unique skill.
 * Called at session end from submitPractice.
 */
export const flushLearnerModel = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    practiceId: v.string(),
    contentType: v.string(),
    targetSkills: v.array(v.string()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        earnedPoints: v.number(),
        responseTimeMs: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.answers.length === 0) return;

    // Look up the practice session to get per-question skill + difficulty info
    const session = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();

    // Build a map of questionId → { targetSkill, difficulty }
    const questionMeta = new Map<string, { targetSkill: string; difficulty?: string }>();
    if (session?.questions) {
      for (const q of session.questions) {
        questionMeta.set(q.questionId, {
          targetSkill: q.targetSkill,
          difficulty: q.difficulty,
        });
      }
    }

    // Aggregate scores per skill
    const skillAgg = new Map<string, { totalScore: number; count: number; diffSum: number }>();
    for (const a of args.answers) {
      const meta = questionMeta.get(a.questionId);
      const skill = meta?.targetSkill ?? "vocabulary";
      const diffEstimate = labelToIRT(meta?.difficulty);
      const score = a.isCorrect ? 100 : 0;

      const existing = skillAgg.get(skill);
      if (existing) {
        existing.totalScore += score;
        existing.count += 1;
        existing.diffSum += diffEstimate;
      } else {
        skillAgg.set(skill, { totalScore: score, count: 1, diffSum: diffEstimate });
      }
    }

    // Issue one learner model update per unique skill
    for (const [skill, agg] of skillAgg) {
      const avgScore = agg.totalScore / agg.count;
      const avgDiff = agg.diffSum / agg.count;

      await ctx.runMutation(internal.learnerModel.updateFromAdaptiveContent, {
        userId: args.userId,
        language: args.language,
        contentId: args.practiceId,
        contentType: args.contentType,
        difficultyEstimate: avgDiff,
        skillsTested: [{ skill, weight: 1 }],
        score: avgScore,
      });
    }

    // Invalidate stale prefetching/ready/failed sessions (learner model just changed)
    await ctx.runMutation(internal.adaptivePracticeQueries.invalidateSession, {
      userId: args.userId,
      language: args.language,
    });

    // Schedule a new prefetch for the next session
    await ctx.scheduler.runAfter(0, internal.adaptivePractice.prefetchPractice, {
      userId: args.userId,
      language: args.language,
    });
  },
});

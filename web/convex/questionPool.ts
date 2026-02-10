"use node";

/**
 * Question Pool actions (Node.js runtime required for content hashing).
 *
 * - ingestQuestionsToPool: saves generated questions (fire-and-forget)
 * - searchQuestionPool: finds matching questions via index query + tag overlap scoring
 *
 * Queries and mutations live in questionPoolQueries.ts (non-Node runtime).
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  hashQuestionContent,
  type PoolQuestionDoc,
  scoreCandidate,
} from "./lib/questionPoolHelpers";
import {
  type DifficultyLevel,
  difficultyLevelValidator,
  languageValidator,
  optionTranslationMapValidator,
  practiceQuestionTypeValidator,
  skillTypeValidator,
  translationMapValidator,
} from "./schema";

// ============================================
// TYPES
// ============================================

// Standalone question types supported in Phase 1 (no audio)
const STANDALONE_TYPES = new Set([
  "mcq_vocabulary",
  "mcq_grammar",
  "fill_blank",
  "translation",
  "free_input",
  "mcq_comprehension",
]);

// ============================================
// INGEST QUESTIONS TO POOL
// ============================================

/**
 * Ingest generated questions into the shared pool.
 * Called fire-and-forget after question generation.
 * Deduplicates by hash and stores in batch (2 DB calls total instead of 2N).
 */
export const ingestQuestionsToPool = internalAction({
  args: {
    language: languageValidator,
    questions: v.array(
      v.object({
        questionType: practiceQuestionTypeValidator,
        targetSkill: skillTypeValidator,
        difficulty: difficultyLevelValidator,
        question: v.string(),
        passageText: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        acceptableAnswers: v.optional(v.array(v.string())),
        points: v.number(),
        grammarTags: v.optional(v.array(v.string())),
        vocabTags: v.optional(v.array(v.string())),
        topicTags: v.optional(v.array(v.string())),
        translations: v.optional(translationMapValidator),
        optionTranslations: v.optional(v.union(optionTranslationMapValidator, v.null())),
        showOptionsInTargetLanguage: v.optional(v.boolean()),
      })
    ),
    modelUsed: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Quality gate: only pool questions with qualityScore >= 80
    if (args.qualityScore !== undefined && args.qualityScore < 80) {
      console.log(`Skipping pool ingestion: quality score ${args.qualityScore} < 80`);
      return { ingested: 0, skipped: args.questions.length };
    }

    // 1. Filter standalone types and compute hashes locally (no DB calls)
    const standaloneQuestions = args.questions.filter((q) => STANDALONE_TYPES.has(q.questionType));
    const skippedNonStandalone = args.questions.length - standaloneQuestions.length;

    const questionsWithHashes = standaloneQuestions.map((q) => ({
      ...q,
      hash: hashQuestionContent({
        questionType: q.questionType,
        question: q.question,
        passageText: q.passageText,
        correctAnswer: q.correctAnswer,
        options: q.options,
      }),
    }));

    if (questionsWithHashes.length === 0) {
      return { ingested: 0, skipped: args.questions.length };
    }

    // 2. Batch dedup check — 1 query call
    const allHashes = questionsWithHashes.map((q) => q.hash);
    const existingHashes: string[] = await ctx.runQuery(
      internal.questionPoolQueries.getExistingHashes,
      { hashes: allHashes, language: args.language }
    );
    const existingSet = new Set(existingHashes);

    // 3. Filter to non-duplicates
    const newQuestions = questionsWithHashes.filter((q) => !existingSet.has(q.hash));

    if (newQuestions.length === 0) {
      const skipped = skippedNonStandalone + questionsWithHashes.length;
      console.log(`Question pool ingestion: 0 ingested, ${skipped} skipped for ${args.language}`);
      return { ingested: 0, skipped };
    }

    // 4. Batch insert — 1 mutation call
    await ctx.runMutation(internal.questionPoolQueries.insertPoolQuestions, {
      questions: newQuestions.map((q) => ({
        questionHash: q.hash,
        language: args.language,
        questionType: q.questionType,
        targetSkill: q.targetSkill,
        difficulty: q.difficulty,
        question: q.question,
        passageText: q.passageText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        acceptableAnswers: q.acceptableAnswers,
        points: q.points,
        grammarTags: q.grammarTags ?? [],
        vocabTags: q.vocabTags ?? [],
        topicTags: q.topicTags ?? [],
        modelUsed: args.modelUsed,
        qualityScore: args.qualityScore,
        translations: q.translations,
        optionTranslations: q.optionTranslations,
        showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
      })),
    });

    const ingested = newQuestions.length;
    const skipped = skippedNonStandalone + existingHashes.length;

    console.log(
      `Question pool ingestion: ${ingested} ingested, ${skipped} skipped for ${args.language}`
    );
    return { ingested, skipped };
  },
});

// ============================================
// SEARCH QUESTION POOL
// ============================================

/**
 * Search the question pool for matching questions.
 * Uses index-based query + tag overlap scoring for relevance,
 * IRT-optimal selection, and diversity enforcement.
 */
export const searchQuestionPool = internalAction({
  args: {
    userId: v.string(),
    language: languageValidator,
    difficulty: difficultyLevelValidator,
    targetCount: v.number(),
    abilityEstimate: v.optional(v.number()),
    weakAreas: v.optional(
      v.array(
        v.object({
          skill: v.string(),
          topic: v.string(),
          score: v.number(),
        })
      )
    ),
    interests: v.optional(v.array(v.string())),
    recentCorrectStreak: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    questions: Array<{
      questionHash: string;
      questionType: string;
      targetSkill: string;
      difficulty: string;
      question: string;
      passageText?: string;
      options?: string[];
      correctAnswer: string;
      acceptableAnswers?: string[];
      points: number;
      empiricalDifficulty?: number;
      discrimination?: number;
      translations?: Record<string, string>;
      optionTranslations?: Record<string, string[]> | null;
      showOptionsInTargetLanguage?: boolean;
    }>;
    poolSize: number;
  }> => {
    // Build target tag sets from learner's weakAreas and interests
    const targetGrammar = new Set<string>();
    const targetVocab = new Set<string>();
    const targetTopics = new Set<string>();

    if (args.weakAreas) {
      for (const wa of args.weakAreas) {
        if (wa.skill === "grammar") targetGrammar.add(wa.topic);
        else if (wa.skill === "vocabulary") targetVocab.add(wa.topic);
        else targetTopics.add(wa.topic);
      }
    }

    if (args.interests) {
      for (const interest of args.interests) {
        targetTopics.add(interest);
      }
    }

    // Fetch ~5x target count via index query
    const fetchLimit = Math.min(args.targetCount * 5, 256);

    // Build adjacent difficulties (target ± 1) to widen candidate pool.
    // The scoring function already penalizes difficulty mismatch via diffFit.
    const DIFFICULTY_ORDER: DifficultyLevel[] = [
      "level_1",
      "level_2",
      "level_3",
      "level_4",
      "level_5",
      "level_6",
    ];
    const targetIdx = DIFFICULTY_ORDER.indexOf(args.difficulty);
    const adjacentDifficulties: DifficultyLevel[] = [args.difficulty];
    if (targetIdx > 0) adjacentDifficulties.push(DIFFICULTY_ORDER[targetIdx - 1]);
    if (targetIdx < DIFFICULTY_ORDER.length - 1)
      adjacentDifficulties.push(DIFFICULTY_ORDER[targetIdx + 1]);

    // Run candidates+count and user-seen-hashes queries in parallel
    const [candidatesResult, seenHashes] = await Promise.all([
      ctx.runQuery(internal.questionPoolQueries.getPoolCandidatesWithCount, {
        language: args.language,
        difficulties: adjacentDifficulties,
        limit: fetchLimit,
      }) as Promise<{ candidates: PoolQuestionDoc[]; poolSize: number }>,
      ctx.runQuery(internal.questionPoolQueries.getUserSeenHashes, {
        userId: args.userId,
        language: args.language,
      }) as Promise<string[]>,
    ]);

    const { candidates: poolDocs, poolSize } = candidatesResult;

    if (poolDocs.length === 0) {
      return { questions: [], poolSize: 0 };
    }

    const seenSet = new Set(seenHashes);

    // Post-retrieval filtering and scoring
    const ability = args.abilityEstimate ?? 0;
    const candidates: Array<{ doc: PoolQuestionDoc; score: number }> = poolDocs
      .filter((doc) => doc.isStandalone)
      .filter((doc) => !seenSet.has(doc.questionHash))
      // Filter out questions without translations — don't serve them
      .filter((doc) => doc.translations !== undefined)
      .map((doc) => ({
        doc,
        score: scoreCandidate(doc, ability, targetGrammar, targetVocab, targetTopics),
      }))
      .sort((a, b) => b.score - a.score);

    // Enforce semantic diversity: different skills/types preferred
    const selected: Array<{ doc: PoolQuestionDoc; score: number }> = [];
    for (const candidate of candidates) {
      if (selected.length >= args.targetCount) break;

      const isDuplicate = selected.some(
        (s) =>
          s.doc.questionType === candidate.doc.questionType &&
          s.doc.targetSkill === candidate.doc.targetSkill
      );

      if (
        !isDuplicate ||
        candidates.length - selected.length <= args.targetCount - selected.length
      ) {
        selected.push(candidate);
      }
    }

    return {
      questions: selected.map((s) => ({
        questionHash: s.doc.questionHash,
        questionType: s.doc.questionType,
        targetSkill: s.doc.targetSkill,
        difficulty: s.doc.difficulty,
        question: s.doc.question,
        passageText: s.doc.passageText,
        options: s.doc.options,
        correctAnswer: s.doc.correctAnswer,
        acceptableAnswers: s.doc.acceptableAnswers,
        points: s.doc.points,
        empiricalDifficulty: s.doc.empiricalDifficulty,
        discrimination: s.doc.discrimination,
        translations: s.doc.translations,
        optionTranslations: s.doc.optionTranslations,
        showOptionsInTargetLanguage: s.doc.showOptionsInTargetLanguage,
      })),
      poolSize,
    };
  },
});

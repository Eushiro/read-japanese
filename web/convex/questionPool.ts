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
import { LABEL_TO_IRT } from "./lib/difficultyEstimator";
import { hashQuestionContent } from "./lib/questionPoolHelpers";
import {
  type DifficultyLevel,
  difficultyLevelValidator,
  languageValidator,
  optionTranslationMapValidator,
  type PracticeQuestionType,
  practiceQuestionTypeValidator,
  type SkillType,
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

/** Shape of a pool question document returned by getPoolCandidatesWithCount */
interface PoolQuestionDoc {
  _id: string;
  questionHash: string;
  questionType: PracticeQuestionType;
  targetSkill: SkillType;
  difficulty: DifficultyLevel;
  question: string;
  passageText?: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  points: number;
  totalResponses: number;
  correctResponses: number;
  empiricalDifficulty?: number;
  discrimination?: number;
  translations?: Record<string, string>;
  optionTranslations?: Record<string, string[]> | null;
  showOptionsInTargetLanguage?: boolean;
  grammarTags: string[];
  vocabTags: string[];
  topicTags: string[];
  isStandalone: boolean;
}

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
      { hashes: allHashes }
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
// TAG OVERLAP SCORING
// ============================================

/**
 * Compute weighted Jaccard tag overlap between a question and target tag sets.
 * Weights: grammar 40%, vocab 30%, topic 30%.
 * Returns 0-1 score.
 */
function computeTagOverlap(
  doc: { grammarTags: string[]; vocabTags: string[]; topicTags: string[] },
  targetGrammar: Set<string>,
  targetVocab: Set<string>,
  targetTopics: Set<string>
): number {
  const grammarOverlap = jaccard(new Set(doc.grammarTags), targetGrammar);
  const vocabOverlap = jaccard(new Set(doc.vocabTags), targetVocab);
  const topicOverlap = jaccard(new Set(doc.topicTags), targetTopics);

  return 0.4 * grammarOverlap + 0.3 * vocabOverlap + 0.3 * topicOverlap;
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B|, returns 0 if both sets are empty. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

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

    // Run candidates+count and user-seen-hashes queries in parallel
    const [candidatesResult, seenHashes] = await Promise.all([
      ctx.runQuery(internal.questionPoolQueries.getPoolCandidatesWithCount, {
        language: args.language,
        difficulty: args.difficulty,
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

/**
 * Score a candidate question for selection.
 * Weighted sum: IRT information (40%), difficulty fit (25%),
 * tag overlap relevance (20%), discrimination (15%).
 */
function scoreCandidate(
  doc: PoolQuestionDoc,
  ability: number,
  targetGrammar: Set<string>,
  targetVocab: Set<string>,
  targetTopics: Set<string>
): number {
  const isCalibrated = doc.totalResponses >= 20;
  const diffIRT = doc.empiricalDifficulty ?? LABEL_TO_IRT[doc.difficulty];
  const disc = doc.discrimination ?? 1.0;

  // IRT Fisher information: I(θ) = a² × P(θ) × (1 - P(θ))
  let irtScore = 0;
  if (isCalibrated) {
    const p = 1 / (1 + Math.exp(-disc * (ability - diffIRT)));
    const info = disc * disc * p * (1 - p);
    irtScore = Math.min(info, 1);
  }

  // Difficulty fit: how close is the question's difficulty to optimal?
  const diffGap = Math.abs(diffIRT - ability);
  const diffFit = Math.max(0, 1 - diffGap / 3);

  // Tag overlap relevance (replaces vector similarity)
  const relevance = computeTagOverlap(doc, targetGrammar, targetVocab, targetTopics);

  // Discrimination quality
  const discScore = isCalibrated ? Math.min(disc / 2, 1) : 0.5;

  // Exploration bonus for uncalibrated questions
  const explorationBonus = doc.totalResponses < 20 ? 0.15 : 0;

  if (isCalibrated) {
    return 0.4 * irtScore + 0.25 * diffFit + 0.2 * relevance + 0.15 * discScore;
  } else {
    return 0.35 * diffFit + 0.35 * relevance + 0.15 * discScore + explorationBonus;
  }
}

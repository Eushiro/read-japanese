"use node";

/**
 * Question Pool actions (Node.js runtime required for embedding generation).
 *
 * - ingestQuestionsToPool: saves generated questions with embeddings (fire-and-forget)
 * - searchQuestionPool: finds matching questions via vector search + post-filtering
 *
 * Queries and mutations live in questionPoolQueries.ts (non-Node runtime).
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { generateEmbedding } from "./ai/providers/openrouter";
import { LABEL_TO_IRT } from "./lib/difficultyEstimator";
import { EMBEDDING_MODELS } from "./lib/models";
import {
  buildEmbeddingText,
  buildQueryEmbeddingText,
  hashQuestionContent,
} from "./lib/questionPoolHelpers";
import {
  type DifficultyLevel,
  difficultyLevelValidator,
  languageValidator,
  type PracticeQuestionType,
  practiceQuestionTypeValidator,
  type SkillType,
  skillTypeValidator,
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

/** Shape of a pool question document returned by getQuestionsByIds */
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
}

// ============================================
// INGEST QUESTIONS TO POOL
// ============================================

/**
 * Ingest generated questions into the shared pool.
 * Called fire-and-forget after question generation.
 * Deduplicates by hash, generates embeddings, and stores.
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

    let ingested = 0;
    let skipped = 0;

    for (const q of args.questions) {
      // Skip non-standalone types (audio types) in Phase 1
      if (!STANDALONE_TYPES.has(q.questionType)) {
        skipped++;
        continue;
      }

      const hash = hashQuestionContent({
        questionType: q.questionType,
        question: q.question,
        passageText: q.passageText,
        correctAnswer: q.correctAnswer,
        options: q.options,
      });

      // Dedup check
      const existing = await ctx.runQuery(internal.questionPoolQueries.getByHash, {
        questionHash: hash,
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Generate embedding
      try {
        const embeddingText = buildEmbeddingText({
          questionType: q.questionType,
          targetSkill: q.targetSkill,
          difficulty: q.difficulty,
          question: q.question,
          passageText: q.passageText,
          correctAnswer: q.correctAnswer,
          options: q.options,
          grammarTags: q.grammarTags,
          vocabTags: q.vocabTags,
          topicTags: q.topicTags,
        });

        const { embedding } = await generateEmbedding(
          embeddingText,
          EMBEDDING_MODELS.TEXT_EMBEDDING_3_SMALL
        );

        // Insert into pool
        await ctx.runMutation(internal.questionPoolQueries.insertPoolQuestion, {
          questionHash: hash,
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
          embedding,
          modelUsed: args.modelUsed,
          qualityScore: args.qualityScore,
        });

        ingested++;
      } catch (error) {
        console.error(`Failed to embed/insert question: ${error}`);
        skipped++;
      }
    }

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
 * Uses vector search + post-retrieval filtering for seen questions,
 * IRT-optimal selection, semantic diversity, and difficulty ladder.
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
    }>;
    poolSize: number;
  }> => {
    // Build query embedding from learner context
    const queryText = buildQueryEmbeddingText({
      language: args.language,
      difficulty: args.difficulty,
      weakAreas: args.weakAreas,
      interests: args.interests,
      abilityEstimate: args.abilityEstimate,
    });

    const { embedding: queryEmbedding } = await generateEmbedding(
      queryText,
      EMBEDDING_MODELS.TEXT_EMBEDDING_3_SMALL
    );

    // Over-fetch 3x to have room for filtering
    const fetchLimit = Math.min(args.targetCount * 3, 64);

    // Vector search with language + difficulty filters
    const searchResults: Array<{ _id: string; _score: number }> = await ctx.vectorSearch(
      "questionPool",
      "by_embedding",
      {
        vector: queryEmbedding,
        limit: fetchLimit,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex vectorSearch filter callback type
        filter: (q: any) =>
          q.eq("language", args.language) &&
          q.eq("difficulty", args.difficulty) &&
          q.eq("isStandalone", true),
      }
    );

    if (searchResults.length === 0) {
      return { questions: [], poolSize: 0 };
    }

    // Fetch full question documents
    const questionDocs: PoolQuestionDoc[] = await ctx.runQuery(
      internal.questionPoolQueries.getQuestionsByIds,
      { ids: searchResults.map((r) => r._id) }
    );

    // Get user's seen question hashes
    const seenHashes: string[] = await ctx.runQuery(
      internal.questionPoolQueries.getUserSeenHashes,
      { userId: args.userId, language: args.language }
    );
    const seenSet = new Set(seenHashes);

    // Post-retrieval filtering and scoring
    const ability = args.abilityEstimate ?? 0;
    const candidates: Array<{ doc: PoolQuestionDoc; score: number }> = questionDocs
      .filter((doc) => doc !== null)
      .filter((doc) => !seenSet.has(doc.questionHash))
      .map((doc) => ({
        doc,
        score: scoreCandidate(doc, ability, searchResults),
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

    // Get pool size for ratio calculation
    const poolSize: number = await ctx.runQuery(internal.questionPoolQueries.getPoolSize, {
      language: args.language,
    });

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
      })),
      poolSize,
    };
  },
});

/**
 * Score a candidate question for selection.
 * Weighted sum: IRT information (40%), difficulty fit (25%),
 * topic relevance (20%), discrimination (15%).
 */
function scoreCandidate(
  doc: {
    totalResponses: number;
    correctResponses: number;
    empiricalDifficulty?: number;
    discrimination?: number;
    difficulty: DifficultyLevel;
    _id: string;
  },
  ability: number,
  searchResults: Array<{ _id: string; _score: number }>
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

  // Topic relevance: use vector search score (cosine similarity)
  const searchHit = searchResults.find((r) => r._id === doc._id);
  const relevance = searchHit ? Math.max(0, searchHit._score) : 0;

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

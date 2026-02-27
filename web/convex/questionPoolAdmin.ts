"use node";

/**
 * Admin-gated action for bulk ingesting questions into the pool.
 * Used by the pipeline upload script (pipeline/upload.ts).
 *
 * Wraps internal.questionPool.ingestQuestionsToPool with auth + admin check.
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import {
  difficultyLevelValidator,
  languageValidator,
  optionTranslationMapValidator,
  practiceQuestionTypeValidator,
  skillTypeValidator,
  translationMapValidator,
} from "./schema";

export const adminIngestQuestions = action({
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
  handler: async (ctx, args): Promise<{ ingested: number; skipped: number }> => {
    // Verify caller is admin
    const identity = await ctx.auth.getUserIdentity();
    if (!isAdminEmail(identity?.email)) {
      throw new Error("Unauthorized: admin access required");
    }

    // Delegate to internal ingestion action
    const result = (await ctx.runAction(internal.questionPool.ingestQuestionsToPool, {
      language: args.language,
      questions: args.questions,
      modelUsed: args.modelUsed,
      qualityScore: args.qualityScore,
    })) as { ingested: number; skipped: number };

    return result;
  },
});

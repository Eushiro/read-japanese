import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================
// QUERIES
// ============================================

// Get all sentences for a user
export const list = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sentences = await ctx.db
      .query("userSentences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 100);

    // Fetch associated vocabulary
    const sentencesWithVocab = await Promise.all(
      sentences.map(async (sentence) => {
        const vocab = await ctx.db.get(sentence.vocabularyId);
        return { ...sentence, vocabulary: vocab };
      })
    );

    return sentencesWithVocab;
  },
});

// Get sentences for a specific vocabulary item
export const getForVocabulary = query({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSentences")
      .withIndex("by_user_and_vocabulary", (q) =>
        q.eq("userId", args.userId).eq("vocabularyId", args.vocabularyId)
      )
      .order("desc")
      .collect();
  },
});

// Get sentence stats
export const getStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sentences = await ctx.db
      .query("userSentences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const stats = {
      total: sentences.length,
      correct: 0,
      incorrect: 0,
      averageGrammarScore: 0,
      averageUsageScore: 0,
      averageNaturalnessScore: 0,
      averageOverallScore: 0,
    };

    let grammarTotal = 0;
    let usageTotal = 0;
    let naturalnessTotal = 0;
    let overallTotal = 0;
    let withScores = 0;

    for (const sentence of sentences) {
      if (sentence.isCorrect) {
        stats.correct++;
      } else {
        stats.incorrect++;
      }

      if (sentence.overallScore !== undefined) {
        withScores++;
        grammarTotal += sentence.grammarScore ?? 0;
        usageTotal += sentence.usageScore ?? 0;
        naturalnessTotal += sentence.naturalnessScore ?? 0;
        overallTotal += sentence.overallScore;
      }
    }

    if (withScores > 0) {
      stats.averageGrammarScore = Math.round(grammarTotal / withScores);
      stats.averageUsageScore = Math.round(usageTotal / withScores);
      stats.averageNaturalnessScore = Math.round(naturalnessTotal / withScores);
      stats.averageOverallScore = Math.round(overallTotal / withScores);
    }

    return stats;
  },
});

// Get recent incorrect sentences (for review)
export const getIncorrect = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sentences = await ctx.db
      .query("userSentences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const incorrect = sentences.filter((s) => !s.isCorrect);

    const sentencesWithVocab = await Promise.all(
      incorrect.slice(0, args.limit ?? 20).map(async (sentence) => {
        const vocab = await ctx.db.get(sentence.vocabularyId);
        return { ...sentence, vocabulary: vocab };
      })
    );

    return sentencesWithVocab;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Submit a sentence for verification
export const submit = mutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),
    sentence: v.string(),
  },
  handler: async (ctx, args) => {
    // Create a pending sentence (to be verified by AI later)
    return await ctx.db.insert("userSentences", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      targetWord: args.targetWord,
      sentence: args.sentence,
      isCorrect: false, // Will be updated after AI verification
      createdAt: Date.now(),
    });
  },
});

// Update sentence with AI verification results
export const updateVerification = mutation({
  args: {
    sentenceId: v.id("userSentences"),
    isCorrect: v.boolean(),
    grammarScore: v.optional(v.number()),
    usageScore: v.optional(v.number()),
    naturalnessScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    corrections: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.string(),
        })
      )
    ),
    feedback: v.optional(v.string()),
    improvedSentence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sentenceId, ...updates } = args;

    await ctx.db.patch(sentenceId, updates);

    // Get the sentence to update vocabulary mastery
    const sentence = await ctx.db.get(sentenceId);
    if (sentence && args.isCorrect) {
      // If user created a correct sentence, consider upgrading mastery
      const vocab = await ctx.db.get(sentence.vocabularyId);
      if (vocab && vocab.masteryState === "learning") {
        await ctx.db.patch(sentence.vocabularyId, {
          masteryState: "tested",
          updatedAt: Date.now(),
        });
      }
    }

    return sentenceId;
  },
});

// Delete a sentence
export const remove = mutation({
  args: { sentenceId: v.id("userSentences") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sentenceId);
  },
});

// Submit and verify in one call (for immediate feedback)
// Note: In production, the AI verification would be done via an action
export const submitWithVerification = mutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),
    sentence: v.string(),
    // AI verification results (passed from frontend after calling AI)
    isCorrect: v.boolean(),
    grammarScore: v.optional(v.number()),
    usageScore: v.optional(v.number()),
    naturalnessScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    corrections: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.string(),
        })
      )
    ),
    feedback: v.optional(v.string()),
    improvedSentence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sentenceId = await ctx.db.insert("userSentences", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      targetWord: args.targetWord,
      sentence: args.sentence,
      isCorrect: args.isCorrect,
      grammarScore: args.grammarScore,
      usageScore: args.usageScore,
      naturalnessScore: args.naturalnessScore,
      overallScore: args.overallScore,
      corrections: args.corrections,
      feedback: args.feedback,
      improvedSentence: args.improvedSentence,
      createdAt: Date.now(),
    });

    // Update vocabulary mastery if correct
    if (args.isCorrect) {
      const vocab = await ctx.db.get(args.vocabularyId);
      if (vocab && vocab.masteryState === "learning") {
        await ctx.db.patch(args.vocabularyId, {
          masteryState: "tested",
          updatedAt: Date.now(),
        });
      }
    }

    // If incorrect, auto-add mistakes to vocabulary (per roadmap)
    // This could be expanded to extract specific words from corrections

    return sentenceId;
  },
});

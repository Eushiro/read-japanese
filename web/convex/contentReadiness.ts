/**
 * Content Readiness
 *
 * Checks if a user is ready for specific content based on vocabulary coverage.
 * Implements the i+1 principle - content should be ~85% comprehensible.
 */

import { v } from "convex/values";

import { internalQuery, query } from "./_generated/server";
import { languageValidator } from "./schema";

// ============================================
// CONSTANTS
// ============================================

// Minimum vocabulary coverage for content to be "ready"
const COVERAGE_THRESHOLD_READY = 0.85;
const COVERAGE_THRESHOLD_ALMOST_READY = 0.7;

// ============================================
// TYPES
// ============================================

export type ReadinessLevel = "ready" | "almost_ready" | "not_ready";

export interface ContentReadiness {
  ready: boolean;
  level: ReadinessLevel;
  coverage: number;
  knownWords: number;
  totalWords: number;
  unknownWords: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateReadinessLevel(coverage: number): ReadinessLevel {
  if (coverage >= COVERAGE_THRESHOLD_READY) return "ready";
  if (coverage >= COVERAGE_THRESHOLD_ALMOST_READY) return "almost_ready";
  return "not_ready";
}

// ============================================
// QUERIES
// ============================================

/**
 * Check if user is ready for specific content based on vocabulary coverage
 *
 * @param userId - The user's ID
 * @param language - The content language
 * @param contentWords - Array of words in the content (can be extracted from story/video)
 * @returns Readiness assessment with coverage percentage and unknown words
 */
export const checkReadiness = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    contentWords: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<ContentReadiness> => {
    const { userId, language, contentWords } = args;

    if (contentWords.length === 0) {
      return {
        ready: true,
        level: "ready",
        coverage: 1.0,
        knownWords: 0,
        totalWords: 0,
        unknownWords: [],
      };
    }

    // Get user's vocabulary for this language
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) => q.eq("userId", userId).eq("language", language))
      .collect();

    // Create a set of known words (mastery level >= "learning")
    const knownWordSet = new Set(
      vocabulary.filter((v) => v.masteryState !== "new").map((v) => v.word.toLowerCase())
    );

    // Calculate unique content words
    const uniqueContentWords = [...new Set(contentWords.map((w) => w.toLowerCase()))];
    const totalWords = uniqueContentWords.length;

    // Find known and unknown words
    const knownWords = uniqueContentWords.filter((w) => knownWordSet.has(w));
    const unknownWords = uniqueContentWords.filter((w) => !knownWordSet.has(w));

    const coverage = totalWords > 0 ? knownWords.length / totalWords : 1.0;
    const level = calculateReadinessLevel(coverage);

    return {
      ready: level === "ready",
      level,
      coverage: Math.round(coverage * 100) / 100,
      knownWords: knownWords.length,
      totalWords,
      unknownWords: unknownWords.slice(0, 20), // Limit to first 20 unknown words
    };
  },
});

/**
 * Internal query version for use in other Convex functions
 */
export const checkReadinessInternal = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
    contentWords: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<ContentReadiness> => {
    const { userId, language, contentWords } = args;

    if (contentWords.length === 0) {
      return {
        ready: true,
        level: "ready",
        coverage: 1.0,
        knownWords: 0,
        totalWords: 0,
        unknownWords: [],
      };
    }

    // Get user's vocabulary for this language
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) => q.eq("userId", userId).eq("language", language))
      .collect();

    // Create a set of known words (mastery level >= "learning")
    const knownWordSet = new Set(
      vocabulary.filter((v) => v.masteryState !== "new").map((v) => v.word.toLowerCase())
    );

    // Calculate unique content words
    const uniqueContentWords = [...new Set(contentWords.map((w) => w.toLowerCase()))];
    const totalWords = uniqueContentWords.length;

    // Find known and unknown words
    const knownWords = uniqueContentWords.filter((w) => knownWordSet.has(w));
    const unknownWords = uniqueContentWords.filter((w) => !knownWordSet.has(w));

    const coverage = totalWords > 0 ? knownWords.length / totalWords : 1.0;
    const level = calculateReadinessLevel(coverage);

    return {
      ready: level === "ready",
      level,
      coverage: Math.round(coverage * 100) / 100,
      knownWords: knownWords.length,
      totalWords,
      unknownWords: unknownWords.slice(0, 20),
    };
  },
});

/**
 * Get user's overall vocabulary stats for a language
 */
export const getVocabularyStats = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const stats = {
      total: vocabulary.length,
      new: 0,
      learning: 0,
      tested: 0,
      mastered: 0,
    };

    for (const word of vocabulary) {
      switch (word.masteryState) {
        case "new":
          stats.new++;
          break;
        case "learning":
          stats.learning++;
          break;
        case "tested":
          stats.tested++;
          break;
        case "mastered":
          stats.mastered++;
          break;
      }
    }

    return {
      ...stats,
      known: stats.learning + stats.tested + stats.mastered,
    };
  },
});

/**
 * Find content that matches user's current vocabulary level
 * Returns stories that have high coverage based on user's known words
 */
export const getReadyStories = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    minCoverage: v.optional(v.number()), // Default: 0.85
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minCoverage = args.minCoverage ?? COVERAGE_THRESHOLD_READY;
    const limit = args.limit ?? 10;

    // Get user's vocabulary
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    // Create a set of known words
    const knownWordSet = new Set(
      vocabulary.filter((v) => v.masteryState !== "new").map((v) => v.word.toLowerCase())
    );

    // Get all stories for this language
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();

    // For now, we'll sort by level as a proxy for difficulty
    // In a full implementation, we'd have word lists for each story
    const sortedStories = stories.sort((a, b) => {
      // Sort by level (easier first)
      const levelOrder =
        args.language === "japanese"
          ? ["N5", "N4", "N3", "N2", "N1"]
          : ["A1", "A2", "B1", "B2", "C1", "C2"];
      return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
    });

    // Calculate estimated coverage for each story and filter by minCoverage
    const storiesWithCoverage = sortedStories.map((story) => ({
      id: story.storyId,
      title: story.title,
      level: story.level,
      language: story.language,
      wordCount: story.wordCount,
      // Estimated coverage based on vocabulary size vs story word count
      estimatedCoverage: Math.min(
        1.0,
        knownWordSet.size / Math.max(1, story.wordCount * 0.5) // Rough estimate
      ),
    }));

    // Filter by minimum coverage threshold and return top results
    return storiesWithCoverage
      .filter((story) => story.estimatedCoverage >= minCoverage)
      .slice(0, limit);
  },
});

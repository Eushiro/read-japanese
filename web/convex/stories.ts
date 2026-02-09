/**
 * Stories - Convex functions for story listing and metadata
 *
 * Stories are stored in Convex with R2 URLs for the full content.
 * The full story content (chapters, segments, etc.) is fetched directly from R2.
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, query } from "./_generated/server";
import { languageValidator, proficiencyLevelValidator } from "./schema";

/**
 * List stories, optionally filtered by language.
 * When language is provided, uses the by_language index.
 * When omitted, returns all stories across all languages.
 */
export const listByLanguage = query({
  args: {
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const stories = args.language
      ? await ctx.db
          .query("stories")
          .withIndex("by_language", (q) => q.eq("language", args.language!))
          .collect()
      : await ctx.db.query("stories").collect();

    return stories.map((s) => ({
      id: s.storyId,
      language: s.language,
      title: s.title,
      titleTranslations: s.titleTranslations,
      level: s.level,
      wordCount: s.wordCount,
      genre: s.genre,
      summary: s.summary,
      summaryTranslations: s.summaryTranslations,
      coverImageURL: s.coverUrl,
      audioURL: s.audioUrl,
      chapterCount: s.chapterCount,
      isPremium: s.isPremium,
      storyUrl: s.storyUrl,
    }));
  },
});

/**
 * Get a single story's metadata by storyId
 */
export const getByStoryId = query({
  args: {
    storyId: v.string(),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_story_id", (q) => q.eq("storyId", args.storyId))
      .first();

    if (!story) {
      return null;
    }

    return {
      id: story.storyId,
      language: story.language,
      title: story.title,
      titleTranslations: story.titleTranslations,
      level: story.level,
      wordCount: story.wordCount,
      genre: story.genre,
      summary: story.summary,
      summaryTranslations: story.summaryTranslations,
      coverImageURL: story.coverUrl,
      audioURL: story.audioUrl,
      chapterCount: story.chapterCount,
      isPremium: story.isPremium,
      storyUrl: story.storyUrl,
    };
  },
});

/**
 * Get stories by level for a language
 */
export const listByLevel = query({
  args: {
    language: languageValidator,
    level: proficiencyLevelValidator,
  },
  handler: async (ctx, args) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_language_and_level", (q) =>
        q.eq("language", args.language).eq("level", args.level)
      )
      .collect();

    return stories.map((s) => ({
      id: s.storyId,
      language: s.language,
      title: s.title,
      titleTranslations: s.titleTranslations,
      level: s.level,
      wordCount: s.wordCount,
      genre: s.genre,
      summary: s.summary,
      summaryTranslations: s.summaryTranslations,
      coverImageURL: s.coverUrl,
      audioURL: s.audioUrl,
      chapterCount: s.chapterCount,
      isPremium: s.isPremium,
      storyUrl: s.storyUrl,
    }));
  },
});

/**
 * Get story count by language
 */
export const countByLanguage = query({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();

    return stories.length;
  },
});

/**
 * Get stories filtered by acceptable difficulty levels
 * Uses the learner's ability estimate to find appropriately challenging content
 */
export const listByAbilityLevel = query({
  args: {
    language: languageValidator,
    acceptableLevels: v.array(v.string()), // e.g., ["N5", "N4"] or ["A1", "A2", "B1"]
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { language, acceptableLevels, limit } = args;

    // Get all stories for this language
    const allStories = await ctx.db
      .query("stories")
      .withIndex("by_language", (q) => q.eq("language", language))
      .collect();

    // Filter to acceptable levels
    const filteredStories = allStories.filter((s) => acceptableLevels.includes(s.level));

    // Sort by level (easier first for i+1 principle)
    const levelOrder =
      language === "japanese"
        ? ["N5", "N4", "N3", "N2", "N1"]
        : ["A1", "A2", "B1", "B2", "C1", "C2"];

    const sorted = filteredStories.sort((a, b) => {
      return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
    });

    const limitedStories = limit ? sorted.slice(0, limit) : sorted;

    return limitedStories.map((s) => ({
      id: s.storyId,
      language: s.language,
      title: s.title,
      titleTranslations: s.titleTranslations,
      level: s.level,
      wordCount: s.wordCount,
      genre: s.genre,
      summary: s.summary,
      summaryTranslations: s.summaryTranslations,
      coverImageURL: s.coverUrl,
      audioURL: s.audioUrl,
      chapterCount: s.chapterCount,
      isPremium: s.isPremium,
      storyUrl: s.storyUrl,
    }));
  },
});

/**
 * Get recommended stories for a user based on their ability level
 * Combines ability filtering with content that's at or slightly above their level
 */
export const getRecommendedForUser = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, language, limit } = args;

    // Get learner profile to determine ability
    const profile = await ctx.db
      .query("learnerProfile")
      .withIndex("by_user_language", (q) => q.eq("userId", userId).eq("language", language))
      .first();

    // Determine acceptable levels based on ability
    const abilityEstimate = profile?.abilityEstimate ?? 0;

    // Convert ability to level with i+1 targeting
    let targetLevel: string;
    let acceptableLevels: string[];

    if (language === "japanese") {
      // JLPT levels
      if (abilityEstimate <= -2) {
        targetLevel = "N5";
        acceptableLevels = ["N5"];
      } else if (abilityEstimate <= -1) {
        targetLevel = "N4";
        acceptableLevels = ["N5", "N4"];
      } else if (abilityEstimate <= 0.5) {
        targetLevel = "N3";
        acceptableLevels = ["N4", "N3"];
      } else if (abilityEstimate <= 1.5) {
        targetLevel = "N2";
        acceptableLevels = ["N3", "N2"];
      } else {
        targetLevel = "N1";
        acceptableLevels = ["N2", "N1"];
      }
    } else {
      // CEFR levels
      if (abilityEstimate <= -2) {
        targetLevel = "A1";
        acceptableLevels = ["A1"];
      } else if (abilityEstimate <= -1) {
        targetLevel = "A2";
        acceptableLevels = ["A1", "A2"];
      } else if (abilityEstimate <= 0) {
        targetLevel = "B1";
        acceptableLevels = ["A2", "B1"];
      } else if (abilityEstimate <= 1) {
        targetLevel = "B2";
        acceptableLevels = ["B1", "B2"];
      } else if (abilityEstimate <= 2) {
        targetLevel = "C1";
        acceptableLevels = ["B2", "C1"];
      } else {
        targetLevel = "C2";
        acceptableLevels = ["C1", "C2"];
      }
    }

    // Get stories at acceptable levels
    const allStories = await ctx.db
      .query("stories")
      .withIndex("by_language", (q) => q.eq("language", language))
      .collect();

    const filteredStories = allStories.filter((s) => acceptableLevels.includes(s.level));

    // Sort: target level first, then adjacent levels
    const sorted = filteredStories.sort((a, b) => {
      // Prioritize exact target level
      if (a.level === targetLevel && b.level !== targetLevel) return -1;
      if (b.level === targetLevel && a.level !== targetLevel) return 1;
      return 0;
    });

    const limitedStories = limit ? sorted.slice(0, limit) : sorted;

    return {
      targetLevel,
      acceptableLevels,
      abilityEstimate,
      stories: limitedStories.map((s) => ({
        id: s.storyId,
        language: s.language,
        title: s.title,
        titleTranslations: s.titleTranslations,
        level: s.level,
        wordCount: s.wordCount,
        genre: s.genre,
        summary: s.summary,
        summaryTranslations: s.summaryTranslations,
        coverImageURL: s.coverUrl,
        audioURL: s.audioUrl,
        chapterCount: s.chapterCount,
        isPremium: s.isPremium,
        storyUrl: s.storyUrl,
      })),
    };
  },
});

// ============================================
// PERSONALIZED STORY GENERATION
// ============================================

export interface PersonalizedStoryResult {
  title: string;
  content: string;
  translation: string;
  vocabulary: Array<{
    word: string;
    reading?: string;
    meaning: string;
    isNew: boolean;
  }>;
  wordCount: number;
}

/**
 * Generate a personalized micro-story using the user's vocabulary and interests
 *
 * This creates a short story that:
 * - Uses 90%+ of words from user's known vocabulary
 * - Includes learning words to reinforce
 * - Introduces only a few new words (i+1 principle)
 * - Incorporates user's interests
 */
export const generatePersonalized = action({
  args: {
    language: languageValidator,
    difficulty: proficiencyLevelValidator, // e.g., "N5", "A1"
    topic: v.optional(v.string()), // Optional topic override
    targetWordCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PersonalizedStoryResult> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const userId = identity.subject;

    // Call the internal action
    const result = await ctx.runAction(internal.lib.generation.generatePersonalizedMicroStory, {
      userId,
      language: args.language,
      difficulty: args.difficulty,
      topic: args.topic,
      targetWordCount: args.targetWordCount ?? 100,
      newWordBudget: 3, // i+1 principle
    });

    return result;
  },
});

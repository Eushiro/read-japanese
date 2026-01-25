/**
 * Stories - Convex functions for story listing and metadata
 *
 * Stories are stored in Convex with R2 URLs for the full content.
 * The full story content (chapters, segments, etc.) is fetched directly from R2.
 */

import { v } from "convex/values";

import { query } from "./_generated/server";
import { languageValidator } from "./schema";

/**
 * List all stories for a given language
 */
export const listByLanguage = query({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_language", (q) => q.eq("language", args.language))
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
 * List all stories (all languages)
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();

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
    level: v.string(),
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

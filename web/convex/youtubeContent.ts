import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { languageValidator, proficiencyLevelValidator } from "./schema";
import { getThumbnailUrl, validateVideo, VIDEOS } from "./videoData";

function toSummary(video: Doc<"youtubeContent">) {
  return {
    _id: video._id,
    videoId: video.videoId,
    language: video.language,
    level: video.level,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    questionsCount: video.questions?.length ?? 0,
    transcriptCount: video.transcript?.length ?? 0,
    createdAt: video.createdAt,
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * List all YouTube videos, optionally filtered by language and level
 */
export const list = query({
  args: {
    language: v.optional(languageValidator),
    level: v.optional(proficiencyLevelValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let videos;
    if (args.language && args.level) {
      videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language_and_level", (q) =>
          q.eq("language", args.language!).eq("level", args.level!)
        )
        .take(limit);
    } else if (args.language) {
      videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language", (q) => q.eq("language", args.language!))
        .take(limit);
    } else {
      videos = await ctx.db.query("youtubeContent").order("desc").take(limit);
    }

    return videos;
  },
});

/**
 * List all YouTube videos (summary fields only), optionally filtered by language and level
 */
export const listSummary = query({
  args: {
    language: v.optional(languageValidator),
    level: v.optional(proficiencyLevelValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let videos;
    if (args.language && args.level) {
      videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language_and_level", (q) =>
          q.eq("language", args.language!).eq("level", args.level!)
        )
        .take(limit);
    } else if (args.language) {
      videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language", (q) => q.eq("language", args.language!))
        .take(limit);
    } else {
      videos = await ctx.db.query("youtubeContent").order("desc").take(limit);
    }

    return videos.map(toSummary);
  },
});

/**
 * Get a single video by its Convex ID
 */
export const get = query({
  args: {
    id: v.id("youtubeContent"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get a video by its YouTube video ID
 */
export const getByVideoId = query({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("youtubeContent")
      .withIndex("by_video_id", (q) => q.eq("videoId", args.videoId))
      .first();
  },
});

/**
 * Get videos for a specific user (if user-specific videos are added)
 */
export const listForUser = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    let videos = await ctx.db
      .query("youtubeContent")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (args.language) {
      videos = videos.filter((v) => v.language === args.language);
    }

    return videos;
  },
});

/**
 * Get videos filtered by acceptable difficulty levels (for adaptive content)
 * Uses the learner model's recommended levels to filter videos
 */
export const listByLevels = query({
  args: {
    language: languageValidator,
    levels: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Query each level via the compound index instead of collecting all and filtering
    const results = [];
    for (const level of args.levels) {
      const videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language_and_level", (q) =>
          q.eq("language", args.language).eq("level", level)
        )
        .take(limit);
      results.push(...videos);
    }

    return results.slice(0, limit);
  },
});

/**
 * Get videos filtered by acceptable difficulty levels (summary fields only)
 */
export const listByLevelsSummary = query({
  args: {
    language: languageValidator,
    levels: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const results = [];
    for (const level of args.levels) {
      const videos = await ctx.db
        .query("youtubeContent")
        .withIndex("by_language_and_level", (q) =>
          q.eq("language", args.language).eq("level", level)
        )
        .take(limit);
      results.push(...videos);
    }

    return results.slice(0, limit).map(toSummary);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Seed a new curated video (admin use)
 */
export const seed = mutation({
  args: {
    videoId: v.string(),
    language: languageValidator,
    level: v.optional(proficiencyLevelValidator),
    title: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if video already exists
    const existing = await ctx.db
      .query("youtubeContent")
      .withIndex("by_video_id", (q) => q.eq("videoId", args.videoId))
      .first();

    if (existing) {
      // Update existing video
      await ctx.db.patch(existing._id, {
        language: args.language,
        level: args.level,
        title: args.title,
        description: args.description,
        thumbnailUrl:
          args.thumbnailUrl ?? `https://img.youtube.com/vi/${args.videoId}/hqdefault.jpg`,
        duration: args.duration,
      });
      return existing._id;
    }

    // Create new video entry
    return await ctx.db.insert("youtubeContent", {
      videoId: args.videoId,
      language: args.language,
      level: args.level,
      title: args.title,
      description: args.description,
      thumbnailUrl: args.thumbnailUrl ?? `https://img.youtube.com/vi/${args.videoId}/hqdefault.jpg`,
      duration: args.duration,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update transcript for a video
 */
export const updateTranscript = mutation({
  args: {
    id: v.id("youtubeContent"),
    transcript: v.array(
      v.object({
        text: v.string(),
        start: v.number(),
        duration: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.id);
    if (!video) {
      throw new Error("Video not found");
    }

    await ctx.db.patch(args.id, {
      transcript: args.transcript,
    });
  },
});

/**
 * Update questions for a video
 */
export const updateQuestions = mutation({
  args: {
    id: v.id("youtubeContent"),
    questions: v.array(
      v.object({
        question: v.string(),
        type: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        timestamp: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.id);
    if (!video) {
      throw new Error("Video not found");
    }

    await ctx.db.patch(args.id, {
      questions: args.questions,
    });
  },
});

/**
 * Remove a video
 */
export const remove = mutation({
  args: {
    id: v.id("youtubeContent"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.id);
    if (!video) {
      throw new Error("Video not found");
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Remove multiple videos by their Convex IDs (batch delete)
 */
export const removeByIds = mutation({
  args: {
    ids: v.array(v.id("youtubeContent")),
  },
  handler: async (ctx, args) => {
    let deletedCount = 0;

    for (const id of args.ids) {
      const video = await ctx.db.get(id);
      if (video) {
        await ctx.db.delete(id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

/**
 * Remove a video by its videoId string
 */
export const removeByVideoId = mutation({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("youtubeContent")
      .withIndex("by_video_id", (q) => q.eq("videoId", args.videoId))
      .first();

    if (!video) {
      return { deleted: false, message: `Video not found: ${args.videoId}` };
    }

    await ctx.db.delete(video._id);
    return { deleted: true, videoId: args.videoId, title: video.title };
  },
});

/**
 * Remove multiple videos by their videoId strings (batch delete)
 */
export const removeByVideoIds = mutation({
  args: {
    videoIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];

    for (const videoId of args.videoIds) {
      const video = await ctx.db
        .query("youtubeContent")
        .withIndex("by_video_id", (q) => q.eq("videoId", videoId))
        .first();

      if (video) {
        await ctx.db.delete(video._id);
        results.push({ videoId, deleted: true, title: video.title });
      } else {
        results.push({ videoId, deleted: false, message: "Not found" });
      }
    }

    return {
      results,
      deletedCount: results.filter((r) => r.deleted).length,
    };
  },
});

/**
 * Remove all videos without transcripts
 */
export const removeVideosWithoutTranscripts = mutation({
  args: {},
  handler: async (ctx) => {
    const allVideos = await ctx.db.query("youtubeContent").collect();
    const removed = [];

    for (const video of allVideos) {
      if (!video.transcript || video.transcript.length === 0) {
        await ctx.db.delete(video._id);
        removed.push(video.videoId);
      }
    }

    return { removed: removed.length, videoIds: removed };
  },
});

/**
 * Internal mutation to update transcript (called from AI action)
 */
export const updateTranscriptInternal = internalMutation({
  args: {
    id: v.id("youtubeContent"),
    transcript: v.array(
      v.object({
        text: v.string(),
        start: v.number(),
        duration: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      transcript: args.transcript,
    });
  },
});

/**
 * Internal mutation to update questions (called from AI action)
 */
export const updateQuestionsInternal = internalMutation({
  args: {
    id: v.id("youtubeContent"),
    questions: v.array(
      v.object({
        question: v.string(),
        type: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        timestamp: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      questions: args.questions,
    });
  },
});

/**
 * Seed starter videos for all languages
 * Run from dashboard: api.youtubeContent.seedStarterVideos
 */
export const seedStarterVideos = mutation({
  args: {},
  handler: async (ctx) => {
    // eslint-disable-next-line no-restricted-syntax -- data array, not a language list
    const SEED_VIDEOS = [
      // Japanese - N5/Beginner
      {
        videoId: "rGrBHiuPlT0",
        language: "japanese" as const,
        level: "N5",
        title: "自己紹介 - Self Introduction in Japanese",
        description:
          "Learn basic self-introduction phrases in Japanese. Perfect for absolute beginners.",
        duration: 180,
      },
      {
        videoId: "6p9Il_j0zjc",
        language: "japanese" as const,
        level: "N5",
        title: "Basic Japanese Greetings",
        description: "Essential greetings and phrases for everyday Japanese conversation.",
        duration: 240,
      },
      {
        videoId: "qf-xqOWvH84",
        language: "japanese" as const,
        level: "N4",
        title: "て Form Explained Simply",
        description: "Master the Japanese て form with clear examples and practice.",
        duration: 360,
      },
      {
        videoId: "Vz2PGkpOXgU",
        language: "japanese" as const,
        level: "N3",
        title: "JLPT N3 Grammar Review",
        description: "Key grammar patterns for JLPT N3 preparation.",
        duration: 420,
      },
      // English - A1/A2/B1
      {
        videoId: "juKd26qkNAw",
        language: "english" as const,
        level: "A2",
        title: "Learn English: Daily Routines",
        description: "Practice talking about daily routines with simple English vocabulary.",
        duration: 180,
      },
      {
        videoId: "DHvZLI7Db8E",
        language: "english" as const,
        level: "A1",
        title: "100 Basic English Phrases for Beginners",
        description: "Essential English phrases every beginner should know.",
        duration: 300,
      },
      {
        videoId: "eW3gMGqcZQc",
        language: "english" as const,
        level: "B1",
        title: "Improve Your English Listening Skills",
        description: "Intermediate English listening practice with native speakers.",
        duration: 360,
      },
      // French - A1/B1
      {
        videoId: "K5PzS8cZ1Rc",
        language: "french" as const,
        level: "A1",
        title: "Se Présenter en Français - French Self Introduction",
        description: "Learn to introduce yourself in French with basic vocabulary.",
        duration: 240,
      },
      {
        videoId: "Fz-0BBQ_lFg",
        language: "french" as const,
        level: "A1",
        title: "French Numbers 1-100",
        description: "Master counting in French from 1 to 100.",
        duration: 300,
      },
      {
        videoId: "8sC6KMIJ3Hs",
        language: "french" as const,
        level: "B1",
        title: "French Listening Practice - Intermediate",
        description: "Natural French conversation for intermediate learners.",
        duration: 420,
      },
    ];

    const results = [];

    for (const video of SEED_VIDEOS) {
      const existing = await ctx.db
        .query("youtubeContent")
        .withIndex("by_video_id", (q) => q.eq("videoId", video.videoId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.duration,
        });
        results.push({ videoId: video.videoId, action: "updated", title: video.title });
      } else {
        await ctx.db.insert("youtubeContent", {
          videoId: video.videoId,
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.duration,
          createdAt: Date.now(),
        });
        results.push({ videoId: video.videoId, action: "created", title: video.title });
      }
    }

    return { seeded: results.length, results };
  },
});

/**
 * Internal mutation for batch seeding videos (called from actions)
 */
export const seedBatch = internalMutation({
  args: {
    videos: v.array(
      v.object({
        videoId: v.string(),
        language: languageValidator,
        level: v.optional(proficiencyLevelValidator),
        title: v.string(),
        description: v.optional(v.string()),
        duration: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const video of args.videos) {
      const existing = await ctx.db
        .query("youtubeContent")
        .withIndex("by_video_id", (q) => q.eq("videoId", video.videoId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          duration: video.duration,
        });
        results.push({ videoId: video.videoId, id: existing._id, action: "updated" });
      } else {
        const id = await ctx.db.insert("youtubeContent", {
          videoId: video.videoId,
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl: `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          duration: video.duration,
          createdAt: Date.now(),
        });
        results.push({ videoId: video.videoId, id, action: "created" });
      }
    }
    return results;
  },
});

/**
 * Seed all videos from videoData.ts
 *
 * Run: npx convex run youtubeContent:seedAllVideos
 *
 * To add new videos:
 * 1. Edit web/convex/videoData.ts
 * 2. Add new entries to the VIDEOS array
 * 3. Run this command again
 */
export const seedAllVideos = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🎬 Starting YouTube video seeding...\n");

    // Validate all videos first
    const allErrors: string[] = [];
    VIDEOS.forEach((video, index) => {
      const { errors } = validateVideo(video, index);
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      const errorMsg = `❌ Validation failed with ${allErrors.length} error(s):\n${allErrors.map((e) => `  • ${e}`).join("\n")}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`✅ Validated ${VIDEOS.length} videos\n`);

    // Count by language
    const counts = { japanese: 0, english: 0, french: 0 };
    VIDEOS.forEach((v) => counts[v.language]++);
    console.log(
      `📊 Videos by language: Japanese=${counts.japanese}, English=${counts.english}, French=${counts.french}\n`
    );

    // Seed videos
    const results: { videoId: string; action: string; title: string }[] = [];

    for (const video of VIDEOS) {
      const existing = await ctx.db
        .query("youtubeContent")
        .withIndex("by_video_id", (q) => q.eq("videoId", video.videoId))
        .first();

      const thumbnailUrl = getThumbnailUrl(video);

      if (existing) {
        await ctx.db.patch(existing._id, {
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl,
          duration: video.duration,
          transcript: video.transcript,
          questions: video.questions,
        });
        results.push({
          videoId: video.videoId,
          action: "updated",
          title: video.title,
        });
        console.log(`  📝 Updated: ${video.title}`);
      } else {
        await ctx.db.insert("youtubeContent", {
          videoId: video.videoId,
          language: video.language,
          level: video.level,
          title: video.title,
          description: video.description,
          thumbnailUrl,
          duration: video.duration,
          transcript: video.transcript,
          questions: video.questions,
          createdAt: Date.now(),
        });
        results.push({
          videoId: video.videoId,
          action: "created",
          title: video.title,
        });
        console.log(`  ✨ Created: ${video.title}`);
      }
    }

    console.log(`\n🎉 Successfully seeded ${results.length} videos!`);

    return {
      success: true,
      seeded: results.length,
      results,
      summary: {
        japanese: counts.japanese,
        english: counts.english,
        french: counts.french,
      },
    };
  },
});

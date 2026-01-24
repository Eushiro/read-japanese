import { v } from "convex/values";

import { mutation,query } from "./_generated/server";

// Default settings
const DEFAULT_SETTINGS = {
  // Display
  showFurigana: true,
  theme: "system",
  fontSize: "medium",

  // Audio
  autoplayAudio: false,
  audioHighlightMode: "sentence",
  audioSpeed: 1.0,

  // SRS
  dailyReviewGoal: 50,
  newCardsPerDay: 20,
  sentenceRefreshDays: 30,

  // Notifications
  reviewReminderEnabled: false,
  reviewReminderTime: "09:00",
};

// Get user settings (reads from userPreferences table)
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Return defaults if no settings exist
    if (!prefs) {
      return DEFAULT_SETTINGS;
    }

    // Flatten nested structure back to original flat API for backwards compatibility
    return {
      showFurigana: prefs.display.showFurigana,
      theme: prefs.display.theme ?? DEFAULT_SETTINGS.theme,
      fontSize: prefs.display.fontSize ?? DEFAULT_SETTINGS.fontSize,
      autoplayAudio: prefs.audio.autoplay ?? DEFAULT_SETTINGS.autoplayAudio,
      audioHighlightMode: prefs.audio.highlightMode ?? DEFAULT_SETTINGS.audioHighlightMode,
      audioSpeed: prefs.audio.speed ?? DEFAULT_SETTINGS.audioSpeed,
      dailyReviewGoal: prefs.srs.dailyReviewGoal ?? DEFAULT_SETTINGS.dailyReviewGoal,
      newCardsPerDay: prefs.srs.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
      sentenceRefreshDays: prefs.srs.sentenceRefreshDays ?? DEFAULT_SETTINGS.sentenceRefreshDays,
      reviewReminderEnabled:
        prefs.notifications?.reviewReminderEnabled ?? DEFAULT_SETTINGS.reviewReminderEnabled,
      reviewReminderTime:
        prefs.notifications?.reviewReminderTime ?? DEFAULT_SETTINGS.reviewReminderTime,
    };
  },
});

// Update user settings (writes to userPreferences table)
export const update = mutation({
  args: {
    userId: v.string(),
    showFurigana: v.optional(v.boolean()),
    theme: v.optional(v.string()),
    fontSize: v.optional(v.string()),
    autoplayAudio: v.optional(v.boolean()),
    audioHighlightMode: v.optional(v.string()),
    audioSpeed: v.optional(v.number()),
    dailyReviewGoal: v.optional(v.number()),
    newCardsPerDay: v.optional(v.number()),
    sentenceRefreshDays: v.optional(v.number()),
    reviewReminderEnabled: v.optional(v.boolean()),
    reviewReminderTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const now = Date.now();

    // Find existing preferences
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Build update object for nested structure
      const patchData: Record<string, unknown> = { updatedAt: now };

      // Display updates
      if (
        updates.showFurigana !== undefined ||
        updates.theme !== undefined ||
        updates.fontSize !== undefined
      ) {
        patchData.display = {
          showFurigana: updates.showFurigana ?? existing.display.showFurigana,
          theme: updates.theme ?? existing.display.theme,
          fontSize: updates.fontSize ?? existing.display.fontSize,
        };
      }

      // Audio updates
      if (
        updates.autoplayAudio !== undefined ||
        updates.audioHighlightMode !== undefined ||
        updates.audioSpeed !== undefined
      ) {
        patchData.audio = {
          autoplay: updates.autoplayAudio ?? existing.audio.autoplay,
          highlightMode: updates.audioHighlightMode ?? existing.audio.highlightMode,
          speed: updates.audioSpeed ?? existing.audio.speed,
        };
      }

      // SRS updates (only the userSettings portion - FSRS settings are handled separately)
      if (
        updates.dailyReviewGoal !== undefined ||
        updates.newCardsPerDay !== undefined ||
        updates.sentenceRefreshDays !== undefined
      ) {
        patchData.srs = {
          ...existing.srs,
          dailyReviewGoal: updates.dailyReviewGoal ?? existing.srs.dailyReviewGoal,
          newCardsPerDay: updates.newCardsPerDay ?? existing.srs.newCardsPerDay,
          sentenceRefreshDays: updates.sentenceRefreshDays ?? existing.srs.sentenceRefreshDays,
        };
      }

      // Notification updates
      if (updates.reviewReminderEnabled !== undefined || updates.reviewReminderTime !== undefined) {
        patchData.notifications = {
          reviewReminderEnabled:
            updates.reviewReminderEnabled ?? existing.notifications?.reviewReminderEnabled,
          reviewReminderTime:
            updates.reviewReminderTime ?? existing.notifications?.reviewReminderTime,
        };
      }

      await ctx.db.patch(existing._id, patchData);
    } else {
      // Create new preferences with defaults
      await ctx.db.insert("userPreferences", {
        userId,
        display: {
          showFurigana: updates.showFurigana ?? DEFAULT_SETTINGS.showFurigana,
          theme: updates.theme ?? DEFAULT_SETTINGS.theme,
          fontSize: updates.fontSize ?? DEFAULT_SETTINGS.fontSize,
        },
        audio: {
          autoplay: updates.autoplayAudio ?? DEFAULT_SETTINGS.autoplayAudio,
          highlightMode: updates.audioHighlightMode ?? DEFAULT_SETTINGS.audioHighlightMode,
          speed: updates.audioSpeed ?? DEFAULT_SETTINGS.audioSpeed,
        },
        srs: {
          dailyReviewGoal: updates.dailyReviewGoal ?? DEFAULT_SETTINGS.dailyReviewGoal,
          newCardsPerDay: updates.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
          sentenceRefreshDays: updates.sentenceRefreshDays ?? DEFAULT_SETTINGS.sentenceRefreshDays,
          // FSRS defaults
          desiredRetention: 0.9,
          maximumInterval: 365,
          preset: "default",
        },
        notifications: {
          reviewReminderEnabled:
            updates.reviewReminderEnabled ?? DEFAULT_SETTINGS.reviewReminderEnabled,
          reviewReminderTime: updates.reviewReminderTime ?? DEFAULT_SETTINGS.reviewReminderTime,
        },
        updatedAt: now,
      });
    }
  },
});

// Reset settings to defaults
export const reset = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        display: {
          showFurigana: DEFAULT_SETTINGS.showFurigana,
          theme: DEFAULT_SETTINGS.theme,
          fontSize: DEFAULT_SETTINGS.fontSize,
        },
        audio: {
          autoplay: DEFAULT_SETTINGS.autoplayAudio,
          highlightMode: DEFAULT_SETTINGS.audioHighlightMode,
          speed: DEFAULT_SETTINGS.audioSpeed,
        },
        srs: {
          ...existing.srs, // Keep FSRS settings
          dailyReviewGoal: DEFAULT_SETTINGS.dailyReviewGoal,
          newCardsPerDay: DEFAULT_SETTINGS.newCardsPerDay,
          sentenceRefreshDays: DEFAULT_SETTINGS.sentenceRefreshDays,
        },
        notifications: {
          reviewReminderEnabled: DEFAULT_SETTINGS.reviewReminderEnabled,
          reviewReminderTime: DEFAULT_SETTINGS.reviewReminderTime,
        },
        updatedAt: Date.now(),
      });
    }
  },
});

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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

// Get user settings
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Return defaults if no settings exist
    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      showFurigana: settings.showFurigana,
      theme: settings.theme ?? DEFAULT_SETTINGS.theme,
      fontSize: settings.fontSize ?? DEFAULT_SETTINGS.fontSize,
      autoplayAudio: settings.autoplayAudio ?? DEFAULT_SETTINGS.autoplayAudio,
      audioHighlightMode: settings.audioHighlightMode ?? DEFAULT_SETTINGS.audioHighlightMode,
      audioSpeed: settings.audioSpeed ?? DEFAULT_SETTINGS.audioSpeed,
      dailyReviewGoal: settings.dailyReviewGoal ?? DEFAULT_SETTINGS.dailyReviewGoal,
      newCardsPerDay: settings.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
      sentenceRefreshDays: settings.sentenceRefreshDays ?? DEFAULT_SETTINGS.sentenceRefreshDays,
      reviewReminderEnabled: settings.reviewReminderEnabled ?? DEFAULT_SETTINGS.reviewReminderEnabled,
      reviewReminderTime: settings.reviewReminderTime ?? DEFAULT_SETTINGS.reviewReminderTime,
    };
  },
});

// Update user settings
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

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Find existing settings
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, filteredUpdates);
    } else {
      // Create new settings with defaults
      await ctx.db.insert("userSettings", {
        userId,
        showFurigana: updates.showFurigana ?? DEFAULT_SETTINGS.showFurigana,
        theme: updates.theme ?? DEFAULT_SETTINGS.theme,
        fontSize: updates.fontSize ?? DEFAULT_SETTINGS.fontSize,
        autoplayAudio: updates.autoplayAudio ?? DEFAULT_SETTINGS.autoplayAudio,
        audioHighlightMode: updates.audioHighlightMode ?? DEFAULT_SETTINGS.audioHighlightMode,
        audioSpeed: updates.audioSpeed ?? DEFAULT_SETTINGS.audioSpeed,
        dailyReviewGoal: updates.dailyReviewGoal ?? DEFAULT_SETTINGS.dailyReviewGoal,
        newCardsPerDay: updates.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
        sentenceRefreshDays: updates.sentenceRefreshDays ?? DEFAULT_SETTINGS.sentenceRefreshDays,
        reviewReminderEnabled: updates.reviewReminderEnabled ?? DEFAULT_SETTINGS.reviewReminderEnabled,
        reviewReminderTime: updates.reviewReminderTime ?? DEFAULT_SETTINGS.reviewReminderTime,
      });
    }
  },
});

// Reset settings to defaults
export const reset = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        showFurigana: DEFAULT_SETTINGS.showFurigana,
        theme: DEFAULT_SETTINGS.theme,
        fontSize: DEFAULT_SETTINGS.fontSize,
        autoplayAudio: DEFAULT_SETTINGS.autoplayAudio,
        audioHighlightMode: DEFAULT_SETTINGS.audioHighlightMode,
        audioSpeed: DEFAULT_SETTINGS.audioSpeed,
        dailyReviewGoal: DEFAULT_SETTINGS.dailyReviewGoal,
        newCardsPerDay: DEFAULT_SETTINGS.newCardsPerDay,
        sentenceRefreshDays: DEFAULT_SETTINGS.sentenceRefreshDays,
        reviewReminderEnabled: DEFAULT_SETTINGS.reviewReminderEnabled,
        reviewReminderTime: DEFAULT_SETTINGS.reviewReminderTime,
      });
    }
  },
});

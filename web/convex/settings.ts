import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
      return {
        showFurigana: true,
        theme: "system",
        fontSize: "medium",
        autoplayAudio: false,
      };
    }

    return {
      showFurigana: settings.showFurigana,
      theme: settings.theme ?? "system",
      fontSize: settings.fontSize ?? "medium",
      autoplayAudio: settings.autoplayAudio ?? false,
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
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;

    // Find existing settings
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, updates);
    } else {
      // Create new settings with defaults
      await ctx.db.insert("userSettings", {
        userId,
        showFurigana: updates.showFurigana ?? true,
        theme: updates.theme ?? "system",
        fontSize: updates.fontSize ?? "medium",
        autoplayAudio: updates.autoplayAudio ?? false,
      });
    }
  },
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User vocabulary items
  vocabulary: defineTable({
    userId: v.string(),
    word: v.string(),
    reading: v.string(),
    meaning: v.string(),
    jlptLevel: v.optional(v.string()),
    partOfSpeech: v.optional(v.string()),
    sourceStoryId: v.optional(v.string()),
    sourceStoryTitle: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_word", ["userId", "word"]),

  // Reading progress per story
  readingProgress: defineTable({
    userId: v.string(),
    storyId: v.string(),
    currentChapterIndex: v.number(),
    currentSegmentIndex: v.number(),
    percentComplete: v.number(),
    isCompleted: v.boolean(),
    lastReadAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_story", ["userId", "storyId"]),

  // User settings
  userSettings: defineTable({
    userId: v.string(),
    showFurigana: v.boolean(),
    theme: v.optional(v.string()),
    fontSize: v.optional(v.string()),
    autoplayAudio: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
});

/**
 * Onboarding Orchestration
 *
 * Handles the beginner setup flow after onboarding completes:
 * 1. For exam-focused users: Subscribe to appropriate premade deck (e.g., JLPT N5)
 * 2. For goal-specific users: Generate personalized starter vocabulary
 * 3. Initialize foundations track for beginners
 */

import { v } from "convex/values";

import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { languageValidator, learningGoalValidator } from "./schema";

// ============================================
// TYPES
// ============================================

// Vocabulary item structure for goal-based generation (used by AI generation)
// TODO: Use this interface when implementing actual AI vocabulary generation
// interface GeneratedVocabItem {
//   word: string;
//   reading?: string;
//   definitions: string[];
//   partOfSpeech?: string;
//   exampleSentence?: string;
// }

// Goal to deck mapping for exam-focused users
const EXAM_TO_DECK_MAP: Record<string, string> = {
  // Japanese exams
  jlpt_n5: "jlpt_n5",
  jlpt_n4: "jlpt_n4",
  jlpt_n3: "jlpt_n3",
  jlpt_n2: "jlpt_n2",
  jlpt_n1: "jlpt_n1",
  // French exams
  delf_a1: "delf_a1",
  delf_a2: "delf_a2",
  delf_b1: "delf_b1",
  delf_b2: "delf_b2",
  dalf_c1: "dalf_c1",
  dalf_c2: "dalf_c2",
  tcf: "tcf_general",
  // English exams
  toefl: "toefl_essential",
  sat: "sat_vocab",
  gre: "gre_vocab",
};

// Goal to vocabulary themes mapping
const GOAL_TO_THEMES: Record<string, string[]> = {
  travel: [
    "transportation",
    "accommodation",
    "restaurant",
    "directions",
    "shopping",
    "emergencies",
  ],
  professional: ["business", "meetings", "email", "presentations", "networking", "negotiations"],
  media: ["entertainment", "emotions", "descriptions", "storytelling", "slang", "idioms"],
  casual: ["greetings", "daily_life", "hobbies", "weather", "family", "friends"],
};

// Interest to vocabulary themes mapping
const INTEREST_TO_THEMES: Record<string, string[]> = {
  food: ["ingredients", "cooking", "restaurants", "tastes", "meals"],
  sports: ["equipment", "actions", "competitions", "fitness", "teams"],
  technology: ["devices", "internet", "software", "gadgets", "innovation"],
  nature: ["animals", "plants", "weather", "landscapes", "environment"],
  relationships: ["family", "friends", "emotions", "social", "communication"],
  business: ["office", "meetings", "money", "career", "management"],
  popCulture: ["movies", "music", "celebrities", "trends", "entertainment"],
  history: ["events", "people", "places", "dates", "culture"],
  music: ["instruments", "genres", "performance", "listening", "artists"],
  art: ["colors", "materials", "techniques", "museums", "creativity"],
  gaming: ["games", "controls", "competition", "online", "characters"],
  science: ["experiments", "research", "discoveries", "lab", "theories"],
};

// ============================================
// QUERIES
// ============================================

// Check if user has completed onboarding setup
export const getOnboardingStatus = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      return { completed: false, hasGoal: false, hasInterests: false, hasDeck: false };
    }

    // Check if user has an active deck subscription
    const subscription = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();

    return {
      completed: !!user.learningGoal && (user.interests?.length ?? 0) >= 3,
      hasGoal: !!user.learningGoal,
      hasInterests: (user.interests?.length ?? 0) >= 3,
      hasDeck: !!subscription,
      foundationsProgress: user.foundationsProgress,
    };
  },
});

// Get recommended starter deck based on user's goal and language
export const getRecommendedDeck = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) return null;

    const language = user.languages[0];
    if (!language) return null;

    // For exam goal, recommend the target exam deck
    if (user.learningGoal === "exam" && user.targetExams.length > 0) {
      const examDeckId = EXAM_TO_DECK_MAP[user.targetExams[0]];
      if (examDeckId) {
        const deck = await ctx.db
          .query("premadeDecks")
          .withIndex("by_deck_id", (q) => q.eq("deckId", examDeckId))
          .first();

        if (deck && deck.isPublished) {
          return deck;
        }
      }
    }

    // For other goals, find the beginner deck for the language
    const beginnerDeckId =
      language === "japanese" ? "jlpt_n5" : language === "french" ? "delf_a1" : "toefl_essential";

    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", beginnerDeckId))
      .first();

    return deck?.isPublished ? deck : null;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Initialize beginner setup after onboarding
export const initializeBeginnerSetup = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const language = user.languages[0];
    if (!language) {
      throw new Error("No language selected");
    }

    // Initialize foundations progress
    if (!user.foundationsProgress) {
      await ctx.db.patch(user._id, {
        foundationsProgress: {
          wordsUnlocked: 0,
          wordsLearned: 0,
          storiesUnlocked: 0,
        },
        updatedAt: Date.now(),
      });
    }

    // For exam goal, auto-subscribe to the appropriate deck
    if (user.learningGoal === "exam" && user.targetExams.length > 0) {
      const examDeckId = EXAM_TO_DECK_MAP[user.targetExams[0]];
      if (examDeckId) {
        const deck = await ctx.db
          .query("premadeDecks")
          .withIndex("by_deck_id", (q) => q.eq("deckId", examDeckId))
          .first();

        if (deck && deck.isPublished) {
          // Check if not already subscribed
          const existing = await ctx.db
            .query("userDeckSubscriptions")
            .withIndex("by_user_and_deck", (q) =>
              q.eq("userId", args.userId).eq("deckId", examDeckId)
            )
            .first();

          if (!existing) {
            const now = Date.now();
            await ctx.db.insert("userDeckSubscriptions", {
              userId: args.userId,
              deckId: examDeckId,
              totalWordsInDeck: deck.totalWords,
              wordsAdded: 0,
              wordsStudied: 0,
              dailyNewCards: 10,
              cardsAddedToday: 0,
              status: "active",
              subscribedAt: now,
              updatedAt: now,
            });
          }

          return { type: "exam_deck", deckId: examDeckId, deckName: deck.name };
        }
      }
    }

    // For non-exam goals, recommend beginner deck but don't auto-subscribe
    // Let the user choose or we can generate personalized vocabulary
    return { type: "needs_setup", goal: user.learningGoal, interests: user.interests };
  },
});

// Subscribe to a starter deck
export const subscribeToStarterDeck = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get deck info
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    if (!deck.isPublished) {
      throw new Error("This deck is not available");
    }

    // Check if already subscribed
    const existing = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();

    if (existing) {
      return { subscribed: true, deckId: args.deckId };
    }

    // Pause any currently active deck
    const activeSub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .first();

    if (activeSub) {
      await ctx.db.patch(activeSub._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
    }

    const now = Date.now();

    // Create the subscription
    await ctx.db.insert("userDeckSubscriptions", {
      userId: args.userId,
      deckId: args.deckId,
      totalWordsInDeck: deck.totalWords,
      wordsAdded: 0,
      wordsStudied: 0,
      dailyNewCards: 10,
      cardsAddedToday: 0,
      status: "active",
      subscribedAt: now,
      updatedAt: now,
    });

    return { subscribed: true, deckId: args.deckId, deckName: deck.name };
  },
});

// Update foundations progress
export const updateFoundationsProgress = mutation({
  args: {
    userId: v.string(),
    wordsLearned: v.optional(v.number()),
    storiesUnlocked: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const current = user.foundationsProgress ?? {
      wordsUnlocked: 0,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    const newProgress = {
      ...current,
      wordsLearned: args.wordsLearned ?? current.wordsLearned,
      storiesUnlocked: args.storiesUnlocked ?? current.storiesUnlocked,
    };

    // Check if foundations is complete (100 words learned)
    if (newProgress.wordsLearned >= 100 && !current.completedAt) {
      newProgress.completedAt = Date.now();
    }

    await ctx.db.patch(user._id, {
      foundationsProgress: newProgress,
      updatedAt: Date.now(),
    });

    return newProgress;
  },
});

// Unlock more words in foundations track (daily drip)
export const unlockFoundationsWords = mutation({
  args: {
    userId: v.string(),
    count: v.optional(v.number()), // Default: 10
  },
  handler: async (ctx, args) => {
    const unlockCount = args.count ?? 10;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const current = user.foundationsProgress ?? {
      wordsUnlocked: 0,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    // Cap at 100 words for foundations
    const newUnlocked = Math.min(100, current.wordsUnlocked + unlockCount);

    await ctx.db.patch(user._id, {
      foundationsProgress: {
        ...current,
        wordsUnlocked: newUnlocked,
      },
      updatedAt: Date.now(),
    });

    return { wordsUnlocked: newUnlocked };
  },
});

// ============================================
// INTERNAL MUTATIONS (for AI generation)
// ============================================

// Store generated vocabulary items for a user
export const storeGeneratedVocabulary = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    items: v.array(
      v.object({
        word: v.string(),
        reading: v.optional(v.string()),
        definitions: v.array(v.string()),
        partOfSpeech: v.optional(v.string()),
      })
    ),
    source: v.string(), // "goal_based" or "interest_based"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let added = 0;
    let skipped = 0;

    for (const item of args.items) {
      // Check if word already exists for this user
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", item.word))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Create vocabulary entry
      await ctx.db.insert("vocabulary", {
        userId: args.userId,
        language: args.language,
        word: item.word,
        reading: item.reading,
        definitions: item.definitions,
        partOfSpeech: item.partOfSpeech,
        masteryState: "new",
        sourceType: "import",
        sourceContext: `Generated for ${args.source}`,
        timesReviewed: 0,
        timesCorrect: 0,
        createdAt: now,
        updatedAt: now,
      });

      added++;
    }

    return { added, skipped };
  },
});

// ============================================
// AI VOCABULARY GENERATION (for non-exam goals)
// ============================================

// Generate vocabulary list based on goal and interests
// This uses the AI to create a personalized starter vocabulary
export const generateGoalBasedVocabulary = internalAction({
  args: {
    userId: v.string(),
    language: languageValidator,
    goal: learningGoalValidator,
    interests: v.array(v.string()),
    count: v.optional(v.number()), // Default: 50 words
  },
  handler: async (_ctx, args): Promise<{ generated: number; stored: number }> => {
    const wordCount = args.count ?? 50;

    // Build themes from goal and interests
    const goalThemes = GOAL_TO_THEMES[args.goal] ?? [];
    const interestThemes = args.interests
      .flatMap((interest) => INTEREST_TO_THEMES[interest] ?? [])
      .slice(0, 10); // Limit interest themes

    const allThemes = [...new Set([...goalThemes, ...interestThemes])];

    // For now, we'll use a simple prompt-based generation
    // In production, this would call the AI generation function
    // TODO: Implement actual AI vocabulary generation

    // Placeholder: return empty for now
    // Real implementation would call internal.ai.generateVocabularyList
    console.log(
      `Would generate ${wordCount} words for ${args.language} with themes:`,
      allThemes.join(", ")
    );

    return { generated: 0, stored: 0 };
  },
});

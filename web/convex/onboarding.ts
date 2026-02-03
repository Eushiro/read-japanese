/**
 * Onboarding Orchestration
 *
 * Handles the beginner setup flow after onboarding completes:
 * 1. For exam-focused users: Subscribe to appropriate premade deck (e.g., JLPT N5)
 * 2. For goal-specific users: Generate personalized starter vocabulary
 * 3. Initialize foundations track for beginners
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { TEXT_MODELS } from "./lib/models";
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
          wordsUnlocked: 100,
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
      wordsUnlocked: 100,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    const newProgress = {
      ...current,
      wordsUnlocked: current.wordsUnlocked > 0 ? current.wordsUnlocked : 100,
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

// Vocabulary item structure for AI generation output
interface GeneratedVocabItem {
  word: string;
  reading?: string;
  definitions: string[];
  partOfSpeech?: string;
  exampleSentence?: string;
}

interface VocabListResponse {
  vocabulary: GeneratedVocabItem[];
}

// Language name mapping for prompts
const LANGUAGE_NAMES: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

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
  handler: async (ctx, args): Promise<{ generated: number; stored: number }> => {
    const wordCount = args.count ?? 50;
    const languageName = LANGUAGE_NAMES[args.language] || args.language;

    // Build themes from goal and interests
    const goalThemes = GOAL_TO_THEMES[args.goal] ?? [];
    const interestThemes = args.interests
      .flatMap((interest) => INTEREST_TO_THEMES[interest] ?? [])
      .slice(0, 10); // Limit interest themes

    const allThemes = [...new Set([...goalThemes, ...interestThemes])];

    // Build the AI prompt
    const systemPrompt = `You are a language learning expert who creates beginner-friendly vocabulary lists.
Your task is to generate practical, high-frequency vocabulary words that a ${languageName} learner would need.

Guidelines:
1. Focus on practical, everyday words
2. Include a mix of nouns, verbs, adjectives, and useful phrases
3. Ensure words are appropriate for beginners (A1-A2 level)
4. For Japanese, include readings (hiragana) for kanji words
5. Provide clear, concise definitions
6. Prioritize words that match the user's goals and interests

Respond ONLY with valid JSON.`;

    const prompt = `Generate ${wordCount} ${languageName} vocabulary words for a beginner learner.

**Learning Goal:** ${args.goal}
**Topics/Themes to focus on:** ${allThemes.join(", ")}
**User Interests:** ${args.interests.join(", ")}

Generate vocabulary that:
- Matches the learning goal (${args.goal === "travel" ? "travel and conversation phrases" : args.goal === "professional" ? "business and formal language" : args.goal === "media" ? "entertainment and media vocabulary" : "general everyday words"})
- Relates to the user's interests where possible
- Is practical and immediately useful
- Is appropriate for beginners

Return a JSON object with this structure:
{
  "vocabulary": [
    {
      "word": "the word in ${languageName}",
      "reading": "reading/pronunciation (for Japanese only, use hiragana)",
      "definitions": ["definition 1", "definition 2"],
      "partOfSpeech": "noun/verb/adjective/phrase/etc"
    }
  ]
}`;

    try {
      // Call OpenRouter API
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        console.error("OPENROUTER_API_KEY not set");
        return { generated: 0, stored: 0 };
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://sanlang.app",
          "X-Title": "SanLang",
        },
        body: JSON.stringify({
          model: TEXT_MODELS.GEMINI_3_FLASH,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "vocabulary_list",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  vocabulary: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        word: { type: "string" },
                        reading: { type: "string" },
                        definitions: { type: "array", items: { type: "string" } },
                        partOfSpeech: { type: "string" },
                      },
                      required: ["word", "definitions"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["vocabulary"],
                additionalProperties: false,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        return { generated: 0, stored: 0 };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";

      // Parse the response
      let cleaned = content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const parsed: VocabListResponse = JSON.parse(cleaned);

      if (!parsed.vocabulary || !Array.isArray(parsed.vocabulary)) {
        console.error("Invalid response format: missing vocabulary array");
        return { generated: 0, stored: 0 };
      }

      // Store the generated vocabulary
      const result = await ctx.runMutation(internal.onboarding.storeGeneratedVocabulary, {
        userId: args.userId,
        language: args.language,
        items: parsed.vocabulary.map((item) => ({
          word: item.word,
          reading: item.reading,
          definitions: item.definitions,
          partOfSpeech: item.partOfSpeech,
        })),
        source: `goal_based_${args.goal}`,
      });

      console.log(
        `Generated ${parsed.vocabulary.length} words for ${args.language} with themes:`,
        allThemes.join(", ")
      );

      return { generated: parsed.vocabulary.length, stored: result.added };
    } catch (error) {
      console.error("Error generating vocabulary:", error);
      return { generated: 0, stored: 0 };
    }
  },
});

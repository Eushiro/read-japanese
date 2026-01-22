import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Supported languages
export const languageValidator = v.union(
  v.literal("japanese"),
  v.literal("english"),
  v.literal("french")
);

// Mastery states for vocabulary items
export const masteryStateValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("tested"),
  v.literal("mastered")
);

// Source types for vocabulary
export const sourceTypeValidator = v.union(
  v.literal("story"),
  v.literal("manual"),
  v.literal("import"),
  v.literal("youtube"),
  v.literal("mistake")
);

// Target exams
export const examTypeValidator = v.union(
  // Japanese
  v.literal("jlpt_n5"),
  v.literal("jlpt_n4"),
  v.literal("jlpt_n3"),
  v.literal("jlpt_n2"),
  v.literal("jlpt_n1"),
  // English
  v.literal("toefl"),
  v.literal("sat"),
  v.literal("gre"),
  // French
  v.literal("delf_a1"),
  v.literal("delf_a2"),
  v.literal("delf_b1"),
  v.literal("delf_b2"),
  v.literal("dalf_c1"),
  v.literal("dalf_c2"),
  v.literal("tcf")
);

// Subscription tiers
export const subscriptionTierValidator = v.union(
  v.literal("free"),
  v.literal("basic"),
  v.literal("pro"),
  v.literal("unlimited")
);

// Subscription status
export const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("cancelled"),
  v.literal("expired")
);

// SRS card states (FSRS algorithm)
export const cardStateValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("review"),
  v.literal("relearning")
);

// Rating for SRS reviews
export const ratingValidator = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy")
);

export default defineSchema({
  // ============================================
  // USER PROFILE
  // ============================================
  users: defineTable({
    clerkId: v.string(), // From auth provider
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    languages: v.array(languageValidator), // Languages user is learning
    targetExams: v.array(examTypeValidator), // Exams user is preparing for
    primaryLanguage: v.optional(languageValidator), // Currently active language
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // ============================================
  // VOCABULARY SYSTEM
  // ============================================
  vocabulary: defineTable({
    userId: v.string(),
    language: languageValidator,
    word: v.string(),
    reading: v.optional(v.string()), // Furigana for Japanese, pronunciation for others
    definitions: v.array(v.string()), // Multiple definitions
    partOfSpeech: v.optional(v.string()),

    // Mastery tracking
    masteryState: masteryStateValidator,

    // Source tracking
    sourceType: sourceTypeValidator,
    sourceStoryId: v.optional(v.string()),
    sourceStoryTitle: v.optional(v.string()),
    sourceYoutubeId: v.optional(v.string()),
    sourceContext: v.optional(v.string()), // The sentence where the word was found

    // Exam association
    examLevel: v.optional(v.string()), // e.g., "N3", "B2", etc.

    // Stats
    timesReviewed: v.number(),
    timesCorrect: v.number(),
    lastReviewedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_language", ["userId", "language"])
    .index("by_user_and_word", ["userId", "word"])
    .index("by_user_language_mastery", ["userId", "language", "masteryState"]),

  // ============================================
  // FLASHCARD SYSTEM (SRS)
  // ============================================
  flashcards: defineTable({
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),

    // Card content
    sentence: v.string(), // AI-generated example sentence
    sentenceTranslation: v.string(),
    audioUrl: v.optional(v.string()), // TTS audio of sentence

    // FSRS algorithm fields
    state: cardStateValidator,
    due: v.number(), // Next review timestamp
    stability: v.number(), // Memory stability
    difficulty: v.number(), // Card difficulty (0-1)
    elapsedDays: v.number(), // Days since last review
    scheduledDays: v.number(), // Days until next review
    reps: v.number(), // Number of reviews
    lapses: v.number(), // Number of times forgotten
    lastReview: v.optional(v.number()), // Last review timestamp

    // Sentence refresh
    sentenceGeneratedAt: v.number(),
    nextRefreshAt: v.optional(v.number()), // When to regenerate sentence

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_vocabulary", ["vocabularyId"])
    .index("by_user_and_due", ["userId", "due"]),

  // Review history for flashcards
  flashcardReviews: defineTable({
    userId: v.string(),
    flashcardId: v.id("flashcards"),
    vocabularyId: v.id("vocabulary"),

    rating: ratingValidator,
    previousState: cardStateValidator,
    newState: cardStateValidator,

    // Response time in milliseconds
    responseTime: v.optional(v.number()),

    reviewedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_flashcard", ["flashcardId"])
    .index("by_vocabulary", ["vocabularyId"]),

  // ============================================
  // USER SENTENCES (Output Practice)
  // ============================================
  userSentences: defineTable({
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),

    // User's attempt
    sentence: v.string(),

    // AI verification results
    isCorrect: v.boolean(),
    grammarScore: v.optional(v.number()), // 0-100
    usageScore: v.optional(v.number()), // 0-100
    naturalnessScore: v.optional(v.number()), // 0-100
    overallScore: v.optional(v.number()), // 0-100

    // AI feedback
    corrections: v.optional(v.array(v.object({
      original: v.string(),
      corrected: v.string(),
      explanation: v.string(),
    }))),
    feedback: v.optional(v.string()), // General feedback
    improvedSentence: v.optional(v.string()), // AI-suggested improvement

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_vocabulary", ["vocabularyId"])
    .index("by_user_and_vocabulary", ["userId", "vocabularyId"]),

  // ============================================
  // READING PROGRESS (existing, enhanced)
  // ============================================
  readingProgress: defineTable({
    userId: v.string(),
    storyId: v.string(),
    language: v.optional(languageValidator), // Added for multi-language
    currentChapterIndex: v.number(),
    currentSegmentIndex: v.number(),
    percentComplete: v.number(),
    isCompleted: v.boolean(),
    lastReadAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_story", ["userId", "storyId"])
    .index("by_user_and_language", ["userId", "language"]),

  // ============================================
  // USER SETTINGS (existing, enhanced)
  // ============================================
  userSettings: defineTable({
    userId: v.string(),

    // Display settings
    showFurigana: v.boolean(),
    theme: v.optional(v.string()), // "light" | "dark" | "system"
    fontSize: v.optional(v.string()), // "small" | "medium" | "large"

    // Audio settings
    autoplayAudio: v.optional(v.boolean()),
    audioHighlightMode: v.optional(v.string()), // "word" | "sentence"
    audioSpeed: v.optional(v.number()), // 0.5 to 2.0

    // SRS settings
    dailyReviewGoal: v.optional(v.number()), // Target cards per day
    newCardsPerDay: v.optional(v.number()), // Max new cards per day
    sentenceRefreshDays: v.optional(v.number()), // Days before refreshing flashcard sentences

    // Notification settings
    reviewReminderEnabled: v.optional(v.boolean()),
    reviewReminderTime: v.optional(v.string()), // HH:MM format
  }).index("by_user", ["userId"]),

  // ============================================
  // SUBSCRIPTIONS (mocked for now)
  // ============================================
  subscriptions: defineTable({
    userId: v.string(),
    tier: subscriptionTierValidator,
    status: subscriptionStatusValidator,

    // Billing info (mocked)
    startDate: v.number(),
    renewalDate: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),

    // Stripe integration placeholders
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ============================================
  // USAGE TRACKING
  // ============================================
  usageRecords: defineTable({
    userId: v.string(),
    periodMonth: v.number(), // 1-12
    periodYear: v.number(), // e.g., 2024

    // Tracked usage
    aiVerifications: v.number(), // Sentence checks
    storiesRead: v.number(),
    personalizedStoriesGenerated: v.number(),
    mockTestsGenerated: v.number(),
    flashcardsGenerated: v.number(),
    audioGenerated: v.number(),

    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_period", ["userId", "periodYear", "periodMonth"]),

  // ============================================
  // MOCK TESTS
  // ============================================
  mockTests: defineTable({
    userId: v.string(),
    language: languageValidator,
    examType: examTypeValidator,

    // Test structure
    title: v.string(),
    sections: v.array(v.object({
      type: v.string(), // "reading" | "listening" | "writing" | "vocabulary"
      title: v.string(),
      content: v.optional(v.string()), // Passage or prompt
      audioUrl: v.optional(v.string()), // For listening sections
      questions: v.array(v.object({
        question: v.string(),
        type: v.string(), // "multiple_choice" | "short_answer" | "essay"
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        userAnswer: v.optional(v.string()),
        isCorrect: v.optional(v.boolean()),
        points: v.number(),
        earnedPoints: v.optional(v.number()),
        feedback: v.optional(v.string()),
      })),
    })),

    // Scoring
    totalPoints: v.number(),
    earnedPoints: v.optional(v.number()),
    percentScore: v.optional(v.number()),

    // Timing
    timeLimitMinutes: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Vocabulary targeting
    targetedVocabularyIds: v.optional(v.array(v.id("vocabulary"))),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_exam", ["userId", "examType"])
    .index("by_user_and_language", ["userId", "language"]),

  // ============================================
  // YOUTUBE CONTENT (Future)
  // ============================================
  youtubeContent: defineTable({
    userId: v.optional(v.string()), // Optional for shared content
    videoId: v.string(),
    language: languageValidator,

    title: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()), // In seconds

    // Transcript
    transcript: v.optional(v.array(v.object({
      text: v.string(),
      start: v.number(), // Start time in seconds
      duration: v.number(),
    }))),

    // Generated questions
    questions: v.optional(v.array(v.object({
      question: v.string(),
      type: v.string(),
      options: v.optional(v.array(v.string())),
      correctAnswer: v.optional(v.string()),
      timestamp: v.optional(v.number()), // Related video timestamp
    }))),

    // Vocabulary extracted
    extractedVocabularyIds: v.optional(v.array(v.id("vocabulary"))),

    createdAt: v.number(),
  })
    .index("by_video_id", ["videoId"])
    .index("by_user", ["userId"])
    .index("by_language", ["language"]),
});

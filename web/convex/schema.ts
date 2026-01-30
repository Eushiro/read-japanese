import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================
// TYPE EXPORTS (for use in frontend/backend)
// ============================================

// Supported content languages (what the user is learning)
// Note: Separate from UI language (i18n locale)
export type ContentLanguage = "japanese" | "english" | "french";

// Mastery states for vocabulary items
export type MasteryState = "new" | "learning" | "tested" | "mastered";

// Source types for vocabulary
export type SourceType = "story" | "manual" | "import" | "youtube" | "mistake";

// Target exams
export type ExamType =
  | "jlpt_n5"
  | "jlpt_n4"
  | "jlpt_n3"
  | "jlpt_n2"
  | "jlpt_n1" // Japanese
  | "toefl"
  | "sat"
  | "gre" // English
  | "delf_a1"
  | "delf_a2"
  | "delf_b1"
  | "delf_b2"
  | "dalf_c1"
  | "dalf_c2"
  | "tcf"; // French

// Subscription tiers (unified credit system)
export type SubscriptionTier = "free" | "plus" | "pro";

// Subscription status
export type SubscriptionStatus = "active" | "cancelled" | "expired";

// SRS card states (FSRS algorithm)
export type CardState = "new" | "learning" | "review" | "relearning";

// Rating for SRS reviews
export type Rating = "again" | "hard" | "good" | "easy";

// Subscription status for deck subscriptions
export type DeckSubscriptionStatus = "active" | "paused" | "completed";

// Batch job status
export type BatchJobStatus =
  | "pending"
  | "submitted"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

// Batch job types
export type BatchJobType = "sentences" | "audio" | "images";

// Readiness levels for exam preparation
export type ReadinessLevel = "not_ready" | "almost_ready" | "ready" | "confident";

// Question source types
export type QuestionSourceType = "exam" | "placement" | "comprehension" | "flashcard" | "video";

// Skill types
export type SkillType = "vocabulary" | "grammar" | "reading" | "listening" | "writing" | "speaking";

// Learning goals
export type LearningGoal = "exam" | "travel" | "professional" | "media" | "casual";

// ============================================
// VALIDATORS
// ============================================

// Supported content languages
export const languageValidator = v.union(
  v.literal("japanese"),
  v.literal("english"),
  v.literal("french")
);

// Supported UI languages (for translations)
export const uiLanguageValidator = v.union(
  v.literal("en"),
  v.literal("ja"),
  v.literal("fr"),
  v.literal("zh")
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

// Subscription tiers (unified credit system)
export const subscriptionTierValidator = v.union(
  v.literal("free"),
  v.literal("plus"),
  v.literal("pro")
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

// Readiness levels for exam preparation
export const readinessLevelValidator = v.union(
  v.literal("not_ready"),
  v.literal("almost_ready"),
  v.literal("ready"),
  v.literal("confident")
);

// Question source types
export const questionSourceTypeValidator = v.union(
  v.literal("exam"),
  v.literal("placement"),
  v.literal("comprehension"),
  v.literal("flashcard"),
  v.literal("video")
);

// Skill types
export const skillTypeValidator = v.union(
  v.literal("vocabulary"),
  v.literal("grammar"),
  v.literal("reading"),
  v.literal("listening"),
  v.literal("writing"),
  v.literal("speaking")
);

// Learning goals
export const learningGoalValidator = v.union(
  v.literal("exam"),
  v.literal("travel"),
  v.literal("professional"),
  v.literal("media"),
  v.literal("casual")
);

// Question types for exams
export const examQuestionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("short_answer"),
  v.literal("essay"),
  v.literal("translation"),
  v.literal("fill_blank"),
  v.literal("matching")
);

// Exam section types
export const examSectionTypeValidator = v.union(
  v.literal("reading"),
  v.literal("listening"),
  v.literal("vocabulary"),
  v.literal("grammar"),
  v.literal("writing")
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
    // Primary learning goal
    learningGoal: v.optional(learningGoalValidator),
    // User interests for personalized content (e.g., ["food", "sports", "technology"])
    interests: v.optional(v.array(v.string())),
    // Proficiency levels determined by placement tests
    proficiencyLevels: v.optional(
      v.object({
        japanese: v.optional(
          v.object({
            level: v.string(), // "N5", "N4", "N3", "N2", "N1"
            assessedAt: v.number(),
            testId: v.optional(v.id("placementTests")),
          })
        ),
        english: v.optional(
          v.object({
            level: v.string(), // "A1", "A2", "B1", "B2", "C1", "C2"
            assessedAt: v.number(),
            testId: v.optional(v.id("placementTests")),
          })
        ),
        french: v.optional(
          v.object({
            level: v.string(), // "A1", "A2", "B1", "B2", "C1", "C2"
            assessedAt: v.number(),
            testId: v.optional(v.id("placementTests")),
          })
        ),
      })
    ),
    // Foundations track progress for beginners
    foundationsProgress: v.optional(
      v.object({
        wordsUnlocked: v.number(),
        wordsLearned: v.number(),
        storiesUnlocked: v.number(),
        completedAt: v.optional(v.number()),
      })
    ),
    // Streak tracking
    currentStreak: v.optional(v.number()), // Current consecutive days of activity
    longestStreak: v.optional(v.number()), // Personal best streak
    lastActivityDate: v.optional(v.string()), // YYYY-MM-DD format
    // Stripe customer ID (pre-created for faster checkout)
    stripeCustomerId: v.optional(v.string()),
    // Admin mode (for admin emails only - bypasses credit limits)
    isAdminMode: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // ============================================
  // VOCABULARY SYSTEM
  // ============================================
  vocabulary: defineTable({
    userId: v.string(),
    language: languageValidator,
    word: v.string(),
    reading: v.optional(v.string()), // Furigana for Japanese, pronunciation for others
    definitions: v.array(v.string()), // DEPRECATED: Use definitionTranslations instead
    // Multi-language definitions - each definition has translations to all UI languages
    definitionTranslations: v.optional(
      v.array(
        v.object({
          en: v.string(),
          ja: v.string(),
          fr: v.string(),
          zh: v.string(),
        })
      )
    ),
    partOfSpeech: v.optional(v.string()),

    // Mastery tracking
    masteryState: masteryStateValidator,

    // Source tracking
    sourceType: sourceTypeValidator,
    sourceStoryId: v.optional(v.string()),
    sourceStoryTitle: v.optional(v.string()),
    sourceYoutubeId: v.optional(v.string()),
    sourceContext: v.optional(v.string()), // The sentence where the word was found
    sourceDeckId: v.optional(v.string()), // Track which premade deck word came from

    // Exam association
    examLevel: v.optional(v.string()), // e.g., "N3", "B2", etc.

    // AI flashcard generation in progress
    flashcardPending: v.optional(v.boolean()),

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
    .index("by_user_language_mastery", ["userId", "language", "masteryState"])
    .index("by_user_and_deck", ["userId", "sourceDeckId"]),

  // ============================================
  // FLASHCARD SYSTEM (SRS)
  // ============================================
  flashcards: defineTable({
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),

    // References to content libraries
    sentenceId: v.optional(v.id("sentences")), // Current sentence for this card
    imageId: v.optional(v.id("images")), // Current image (optional)
    // Word audio is looked up by word+language from wordAudio table

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
    .index("by_flashcard", ["flashcardId"]),

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
    corrections: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.string(),
        })
      )
    ),
    feedback: v.optional(v.string()), // General feedback
    improvedSentence: v.optional(v.string()), // AI-suggested improvement

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_vocabulary", ["userId", "vocabularyId"]),

  // ============================================
  // SHADOWING PRACTICE
  // ============================================
  shadowingPractices: defineTable({
    userId: v.string(),
    flashcardId: v.optional(v.id("flashcards")),
    vocabularyId: v.optional(v.id("vocabulary")),

    // Target
    targetText: v.string(),
    targetLanguage: languageValidator,

    // User attempt
    userAudioStorageId: v.optional(v.id("_storage")),

    // AI Feedback
    feedbackAudioUrl: v.optional(v.string()),
    feedbackText: v.string(),
    accuracyScore: v.number(), // 0-100

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "createdAt"]),

  // ============================================
  // STORIES (content metadata with R2 URLs)
  // ============================================
  stories: defineTable({
    storyId: v.string(), // Unique identifier (e.g., "n5_first_cafe_001")
    language: languageValidator, // Content language

    // Primary title (in the story's language)
    title: v.string(),
    // Translations of the title (all languages required)
    titleTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),

    // Metadata
    level: v.string(), // "N5", "A1", etc.
    wordCount: v.number(),
    genre: v.string(),
    chapterCount: v.number(),
    isPremium: v.boolean(),

    // Summary (in the story's language)
    summary: v.string(),
    // Translations of the summary (all languages required)
    summaryTranslations: v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    }),

    // R2 URLs (direct links to content)
    storyUrl: v.string(), // Full story JSON: stories/{language}/{storyId}/story.json
    coverUrl: v.optional(v.string()), // Cover image
    audioUrl: v.optional(v.string()), // Story audio

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_story_id", ["storyId"])
    .index("by_language", ["language"])
    .index("by_language_and_level", ["language", "level"]),

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
  // USER SETTINGS - DEPRECATED
  // ============================================
  // @deprecated: Migrated to userPreferences table.
  // Run migration: npx convex run migrations/settingsMigration:migrateAllSettings
  // Then run cleanup: npx convex run migrations/settingsMigration:cleanupOldTables
  // After migration verified, remove this table definition.
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
  // USER PREFERENCES (consolidated settings)
  // ============================================
  // Merges: userSettings, fsrsSettings, contentPreferences
  userPreferences: defineTable({
    userId: v.string(),

    // Display & UI (from userSettings)
    display: v.object({
      showFurigana: v.boolean(),
      theme: v.optional(v.string()), // "light" | "dark" | "system"
      fontSize: v.optional(v.string()), // "small" | "medium" | "large"
    }),

    // Audio settings (from userSettings)
    audio: v.object({
      autoplay: v.optional(v.boolean()),
      highlightMode: v.optional(v.string()), // "word" | "sentence"
      speed: v.optional(v.number()), // 0.5 to 2.0
    }),

    // SRS settings (merged from userSettings + fsrsSettings)
    srs: v.object({
      dailyReviewGoal: v.optional(v.number()), // Target cards per day
      newCardsPerDay: v.optional(v.number()), // Max new cards per day
      sentenceRefreshDays: v.optional(v.number()), // Days before refreshing sentences
      desiredRetention: v.optional(v.number()), // 0.80 to 0.97 (from fsrsSettings)
      maximumInterval: v.optional(v.number()), // Max days between reviews
      customWeights: v.optional(v.array(v.number())), // 17 FSRS weights
      preset: v.optional(v.string()), // "default" | "aggressive" | "relaxed" | "custom"
      maxReviewsPerSession: v.optional(v.number()), // Cap reviews per session (default 30)
      forgivenessMode: v.optional(v.boolean()), // Restart interval for 7+ day overdue cards
      vacationMode: v.optional(v.boolean()), // Pause all SRS scheduling
      vacationStartedAt: v.optional(v.number()), // When vacation mode was enabled
    }),

    // Content preferences (from contentPreferences)
    content: v.optional(
      v.object({
        interests: v.optional(v.array(v.string())), // ["anime", "cooking", "travel"]
        tonePreference: v.optional(v.string()), // "casual" | "formal" | "humorous"
        ageAppropriate: v.optional(v.string()), // "all_ages" | "teen" | "adult"
        culturalFocus: v.optional(v.array(v.string())), // ["traditional", "modern"]
        learningGoal: v.optional(v.string()), // "jlpt_prep" | "travel" | "business"
        avoidTopics: v.optional(v.array(v.string())), // ["politics", "religion"]
      })
    ),

    // Notification settings (from userSettings)
    notifications: v.optional(
      v.object({
        reviewReminderEnabled: v.optional(v.boolean()),
        reviewReminderTime: v.optional(v.string()), // HH:MM format
      })
    ),

    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ============================================
  // SUBSCRIPTIONS (unified credit system)
  // ============================================
  subscriptions: defineTable({
    userId: v.string(),
    tier: subscriptionTierValidator,
    status: subscriptionStatusValidator,
    billingPeriod: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),

    // Billing info
    startDate: v.number(),
    renewalDate: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),

    // Stripe integration
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ============================================
  // USAGE TRACKING (deprecated - use creditUsage)
  // ============================================
  // @deprecated: Migrated to creditUsage table for unified credit system
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
  // CREDIT USAGE (unified credit system)
  // ============================================
  // Tracks monthly credit consumption per user
  creditUsage: defineTable({
    userId: v.string(),
    periodMonth: v.number(), // 1-12
    periodYear: v.number(), // e.g., 2024
    creditsUsed: v.number(), // Total credits consumed this period
    // Alert dismissal tracking (once per month)
    alertDismissed80: v.optional(v.boolean()),
    alertDismissed95: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_period", ["userId", "periodYear", "periodMonth"]),

  // ============================================
  // CREDIT TRANSACTIONS (usage history)
  // ============================================
  // Individual actions for usage history display
  creditTransactions: defineTable({
    userId: v.string(),
    action: v.string(), // "sentence", "feedback", "comprehension", "audio", "shadowing"
    creditsSpent: v.number(), // 0 for admin bypass
    metadata: v.optional(v.any()), // { word, text, adminBypass, etc. }
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "createdAt"]),

  // ============================================
  // AI USAGE TRACKING (cost monitoring)
  // ============================================
  // Tracks actual AI API costs for monitoring and optimization
  aiUsage: defineTable({
    userId: v.optional(v.string()), // Optional for system-level generation
    action: v.string(), // "sentence", "feedback", "tts", "image", "comprehension", etc.
    model: v.string(), // "google/gemini-3-flash-preview", "anthropic/claude-haiku-4.5"
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostCents: v.number(), // Cost in cents (e.g., 0.15 = $0.0015)
    latencyMs: v.optional(v.number()), // Response time
    success: v.boolean(),
    error: v.optional(v.string()), // Error message if failed
    metadata: v.optional(v.any()), // { word, language, etc. }
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_model", ["model"])
    .index("by_date", ["createdAt"]),

  // ============================================
  // MOCK TESTS
  // ============================================
  mockTests: defineTable({
    userId: v.string(),
    language: languageValidator,
    examType: examTypeValidator,

    // Test structure
    title: v.string(),
    sections: v.array(
      v.object({
        type: v.string(), // "reading" | "listening" | "writing" | "vocabulary"
        title: v.string(),
        content: v.optional(v.string()), // Passage or prompt
        audioUrl: v.optional(v.string()), // For listening sections
        questions: v.array(
          v.object({
            question: v.string(),
            type: v.string(), // "multiple_choice" | "short_answer" | "essay"
            options: v.optional(v.array(v.string())),
            correctAnswer: v.optional(v.string()),
            userAnswer: v.optional(v.string()),
            isCorrect: v.optional(v.boolean()),
            points: v.number(),
            earnedPoints: v.optional(v.number()),
            feedback: v.optional(v.string()),
          })
        ),
      })
    ),

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
  // STORY COMPREHENSION
  // ============================================
  storyComprehension: defineTable({
    userId: v.string(),
    storyId: v.string(),
    storyTitle: v.string(),
    language: languageValidator,

    // Questions generated for this story
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.union(
          v.literal("multiple_choice"),
          v.literal("translation"),
          v.literal("short_answer"),
          v.literal("inference"),
          v.literal("prediction"),
          v.literal("grammar"),
          v.literal("opinion")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()), // English translation for learners
        options: v.optional(v.array(v.string())), // For multiple choice
        correctAnswer: v.optional(v.string()), // For MC and short answer
        rubric: v.optional(v.string()), // AI grading guidelines for essays
        userAnswer: v.optional(v.string()),
        isCorrect: v.optional(v.boolean()),
        aiScore: v.optional(v.number()), // 0-100 for essay/short answer
        aiFeedback: v.optional(v.string()),
        relatedChapter: v.optional(v.number()), // Which chapter this question is about
        points: v.number(), // Points for this question
        earnedPoints: v.optional(v.number()),
      })
    ),

    // Overall results
    totalScore: v.number(), // Max possible score
    earnedScore: v.optional(v.number()),
    percentScore: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_story", ["userId", "storyId"])
    .index("by_user_and_language", ["userId", "language"]),

  // ============================================
  // STORY QUESTIONS (cached per difficulty)
  // ============================================
  // Questions are generated once per story/difficulty and reused for all users
  storyQuestions: defineTable({
    storyId: v.string(),
    difficulty: v.number(), // 1-6 scale (maps to N5-N1 / A1-C2)
    language: languageValidator,

    // Questions (without user-specific fields)
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.union(
          v.literal("multiple_choice"),
          v.literal("translation"),
          v.literal("short_answer"),
          v.literal("inference"),
          v.literal("prediction"),
          v.literal("grammar"),
          v.literal("opinion")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        rubric: v.optional(v.string()),
        relatedChapter: v.optional(v.number()),
        points: v.number(),
      })
    ),

    generatedAt: v.number(),
  }).index("by_story_and_difficulty", ["storyId", "difficulty"]),

  // ============================================
  // PLACEMENT TESTS (CAT-style adaptive testing)
  // ============================================
  placementTests: defineTable({
    userId: v.string(),
    language: languageValidator,

    // Test status
    status: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("abandoned")),

    // Questions answered (CAT selects dynamically)
    questions: v.array(
      v.object({
        questionId: v.string(),
        level: v.string(), // "N5", "A1", etc.
        type: v.union(
          v.literal("vocabulary"),
          v.literal("grammar"),
          v.literal("reading"),
          v.literal("listening")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        userAnswer: v.optional(v.string()),
        isCorrect: v.optional(v.boolean()),
        answeredAt: v.optional(v.number()),
        difficulty: v.number(), // Item difficulty parameter (IRT)
      })
    ),

    // CAT algorithm state
    currentAbilityEstimate: v.number(), // Theta (ability) estimate
    abilityStandardError: v.number(), // Confidence in estimate
    questionsAnswered: v.number(),
    correctAnswers: v.number(),

    // Results
    determinedLevel: v.optional(v.string()), // Final level (N3, B2, etc.)
    confidence: v.optional(v.number()), // 0-100 confidence score
    scoresBySection: v.optional(
      v.object({
        vocabulary: v.optional(v.number()),
        grammar: v.optional(v.number()),
        reading: v.optional(v.number()),
        listening: v.optional(v.number()),
      })
    ),

    // Timestamps
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user_and_language", ["userId", "language"]),

  // ============================================
  // GRADING PROFILES (level-specific thresholds)
  // ============================================
  // @deprecated: Moved to constants in lib/gradingProfiles.ts
  // Table can be removed from schema after verifying placementTest.ts works
  gradingProfiles: defineTable({
    language: languageValidator,
    level: v.string(), // "N5", "A1", etc.

    // Thresholds for sentence verification (0-100)
    grammarPassThreshold: v.number(),
    usagePassThreshold: v.number(),
    naturalnessPassThreshold: v.number(),

    // Description for users
    levelDescription: v.string(),

    // Story difficulty range this level can comfortably read
    storyDifficultyMin: v.optional(v.string()),
    storyDifficultyMax: v.optional(v.string()),
  }).index("by_language_and_level", ["language", "level"]),

  // ============================================
  // CONTENT LIBRARIES
  // ============================================
  // Shared pools of sentences, images, and word audio
  // Multiple entries per word allow variety and swapping

  // Sentence library - multiple sentences per word at various difficulty levels
  sentences: defineTable({
    word: v.string(),
    language: languageValidator, // Language the sentence is written in
    difficulty: v.number(), // 1-6 scale (N5-N1 / A1-C2)

    sentence: v.string(),
    // Translations keyed by language code
    translations: v.object({
      en: v.optional(v.string()),
      ja: v.optional(v.string()),
      fr: v.optional(v.string()),
      es: v.optional(v.string()),
      zh: v.optional(v.string()),
    }),
    audioUrl: v.optional(v.string()), // TTS audio of the sentence

    // Source tracking
    model: v.string(), // AI model that generated this (e.g., "gemini-2.0-flash", "user")
    createdBy: v.optional(v.string()), // userId if user-submitted, undefined for system
    createdAt: v.number(),
  }).index("by_word_language", ["word", "language"]),

  // Image library - multiple images per word for variety
  images: defineTable({
    word: v.string(),
    language: languageValidator,

    imageUrl: v.string(),
    style: v.optional(v.string()), // "realistic", "illustration", "icon", etc.

    // Source tracking
    model: v.string(), // AI model that generated this (e.g., "dall-e-3", "user")
    createdBy: v.optional(v.string()), // userId if user-submitted, undefined for system
    createdAt: v.number(),
  }).index("by_word_language", ["word", "language"]),

  // Word audio library - pronunciation of individual words
  wordAudio: defineTable({
    word: v.string(),
    language: languageValidator,

    audioUrl: v.string(),

    // Source tracking
    model: v.string(), // TTS model used (e.g., "gemini-2.5-flash-preview-tts", "user")
    createdBy: v.optional(v.string()), // userId if user-submitted, undefined for system
    createdAt: v.number(),
  }).index("by_word_language", ["word", "language"]),

  // ============================================
  // PREMADE VOCABULARY (Shared decks)
  // ============================================
  // Pre-generated vocabulary with sentences/audio, shared across all users
  premadeVocabulary: defineTable({
    // Deck identification
    deckId: v.string(), // e.g., "jlpt_n5", "cefr_a1_french"
    language: languageValidator,
    level: v.string(), // "N5", "A1", etc.

    // Word data
    word: v.string(),
    reading: v.optional(v.string()), // Furigana/pronunciation
    definitions: v.array(v.string()), // DEPRECATED: Use definitionTranslations instead
    // Multi-language definitions - each definition has translations to all UI languages
    definitionTranslations: v.optional(
      v.array(
        v.object({
          en: v.string(),
          ja: v.string(),
          fr: v.string(),
          zh: v.string(),
        })
      )
    ),
    partOfSpeech: v.optional(v.string()),

    // References to content libraries
    sentenceId: v.optional(v.id("sentences")), // Current sentence for this deck entry
    imageId: v.optional(v.id("images")), // Current image
    // Word audio is looked up by word+language from wordAudio table

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deck", ["deckId"])
    .index("by_word_language", ["word", "language"]),

  // Premade deck metadata
  premadeDecks: defineTable({
    deckId: v.string(), // Unique identifier
    name: v.string(), // Display name: "JLPT N5"
    description: v.string(),
    language: languageValidator,
    level: v.string(), // "N5", "A1", etc.

    // Stats
    totalWords: v.number(),
    wordsWithSentences: v.number(),
    wordsWithAudio: v.number(),
    wordsWithImages: v.number(),

    // Status
    isPublished: v.boolean(), // Visible to users
    lastUpdated: v.number(),

    // Auto-progression to next deck when completed
    nextDeckId: v.optional(v.string()), // e.g., jlpt_n5 → jlpt_n4

    // Personal deck fields
    isPersonal: v.optional(v.boolean()), // True for user's personal deck
    ownerUserId: v.optional(v.string()), // User who owns this personal deck
  })
    .index("by_deck_id", ["deckId"])
    .index("by_language_and_published", ["language", "isPublished"])
    .index("by_owner", ["ownerUserId"]),

  // ============================================
  // USER DECK SUBSCRIPTIONS
  // ============================================
  // Tracks user subscriptions to premade decks with drip-feed progress
  userDeckSubscriptions: defineTable({
    userId: v.string(),
    deckId: v.string(),
    totalWordsInDeck: v.number(),
    wordsAdded: v.number(), // Words added to user's vocabulary
    wordsStudied: v.number(), // Words user has reviewed at least once
    dailyNewCards: v.number(), // Cards to add per day (default: 10)
    lastDripDate: v.optional(v.string()), // "YYYY-MM-DD" - last day cards were dripped
    cardsAddedToday: v.number(), // Cards added on lastDripDate
    skippedWords: v.optional(v.array(v.string())), // Words user deleted (don't re-add)
    status: v.union(
      v.literal("active"), // Currently receiving daily cards
      v.literal("paused"), // Paused by user or when another deck is active
      v.literal("completed") // All words added
    ),
    subscribedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_deck", ["userId", "deckId"])
    .index("by_user_and_status", ["userId", "status"]),

  // ============================================
  // BATCH JOBS (for AI generation tracking)
  // ============================================
  batchJobs: defineTable({
    // Job identification
    jobType: v.union(
      v.literal("sentences"), // Generate sentences
      v.literal("audio"), // Generate audio
      v.literal("images") // Generate images
    ),
    deckId: v.optional(v.string()), // If deck-specific

    // Google Batch API tracking
    googleBatchJobName: v.optional(v.string()), // e.g., "batches/abc123"
    inputFileUri: v.optional(v.string()), // Uploaded JSONL file URI
    outputFileUri: v.optional(v.string()), // Results file URI

    // Job parameters
    model: v.string(), // e.g., "gemini-2.0-flash"
    itemCount: v.number(), // How many items in this batch
    processedCount: v.number(), // How many processed so far

    // Status
    status: v.union(
      v.literal("pending"), // Created, not yet submitted
      v.literal("submitted"), // Sent to Google
      v.literal("running"), // Processing
      v.literal("succeeded"), // Complete
      v.literal("failed"), // Error
      v.literal("cancelled") // User cancelled
    ),
    errorMessage: v.optional(v.string()),

    // Cost tracking
    estimatedCost: v.optional(v.number()), // In dollars
    actualCost: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_google_job", ["googleBatchJobName"]),

  // ============================================
  // YOUTUBE CONTENT (Future)
  // ============================================
  youtubeContent: defineTable({
    userId: v.optional(v.string()), // Optional for shared content
    videoId: v.string(),
    language: languageValidator,
    level: v.optional(v.string()), // "N5", "A1", etc. for filtering

    title: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()), // In seconds

    // Transcript
    transcript: v.optional(
      v.array(
        v.object({
          text: v.string(),
          start: v.number(), // Start time in seconds
          duration: v.number(),
        })
      )
    ),

    // Generated questions
    questions: v.optional(
      v.array(
        v.object({
          question: v.string(),
          type: v.string(),
          options: v.optional(v.array(v.string())),
          correctAnswer: v.optional(v.string()),
          timestamp: v.optional(v.number()), // Related video timestamp
        })
      )
    ),

    // Vocabulary extracted
    extractedVocabularyIds: v.optional(v.array(v.id("vocabulary"))),

    createdAt: v.number(),
  })
    .index("by_video_id", ["videoId"])
    .index("by_user", ["userId"])
    .index("by_language", ["language"])
    .index("by_language_and_level", ["language", "level"]),

  // ============================================
  // VIDEO QUESTIONS (by difficulty level)
  // ============================================
  videoQuestions: defineTable({
    videoId: v.string(), // YouTube video ID
    difficulty: v.number(), // 1-6 (maps to N5-N1/A1-C2)
    language: languageValidator,

    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.union(
          v.literal("multiple_choice"),
          v.literal("translation"),
          v.literal("short_answer"),
          v.literal("inference"),
          v.literal("listening"), // Video-specific
          v.literal("grammar"),
          v.literal("opinion")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        rubric: v.optional(v.string()),
        timestamp: v.optional(v.number()), // Related video timestamp
        points: v.number(),
      })
    ),

    generatedAt: v.number(),
  })
    .index("by_video_and_difficulty", ["videoId", "difficulty"])
    .index("by_video", ["videoId"]),

  // ============================================
  // UNIFIED LEARNER MODEL
  // ============================================

  // Learner profile - unified view of user's understanding per language
  learnerProfile: defineTable({
    userId: v.string(),
    language: languageValidator,
    examType: v.optional(examTypeValidator), // Primary target exam

    // Overall ability (IRT-style, updated continuously)
    abilityEstimate: v.number(), // -3 to +3 scale
    abilityConfidence: v.number(), // Standard error

    // Skill breakdown (0-100 scale)
    skills: v.object({
      vocabulary: v.number(),
      grammar: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
      speaking: v.number(), // From shadowing practice
    }),

    // Weak areas (auto-detected from mistakes)
    weakAreas: v.array(
      v.object({
        skill: v.string(), // "grammar"
        topic: v.string(), // "passive voice"
        score: v.number(), // 0-100
        lastTestedAt: v.number(),
        questionCount: v.number(), // Sample size
      })
    ),

    // Vocabulary coverage for target level
    vocabCoverage: v.object({
      targetLevel: v.string(), // "N3"
      totalWords: v.number(), // Words in level
      known: v.number(), // Mastered
      learning: v.number(), // In progress
      unknown: v.number(), // Not started
    }),

    // Readiness prediction
    readiness: v.object({
      level: readinessLevelValidator, // "almost_ready"
      predictedScore: v.optional(v.number()),
      confidence: v.number(),
    }),

    // FSRS performance metrics
    fsrsMetrics: v.optional(
      v.object({
        actualRetention: v.number(), // Measured from reviews
        predictedRetention: v.number(), // From FSRS model
        reviewsPerDay: v.number(), // Average daily load
        lastOptimizedAt: v.optional(v.number()),
      })
    ),

    // Time tracking
    totalStudyMinutes: v.number(),
    lastActivityAt: v.optional(v.number()), // Last time user did any learning activity
    // NOTE: Streak data lives in `users` table (currentStreak, longestStreak, lastActivityDate)
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_language", ["userId", "language"]),

  // Question history - every question answered for pattern analysis
  questionHistory: defineTable({
    userId: v.string(),
    language: languageValidator,

    // Question source
    sourceType: questionSourceTypeValidator, // "exam" | "placement" | "comprehension" | "flashcard"
    sourceId: v.optional(v.string()), // Reference to source

    // FULL QUESTION CONTENT (stored for re-grading)
    questionContent: v.object({
      questionText: v.string(),
      questionType: v.string(), // "multiple_choice" | "short_answer" | "essay"
      options: v.optional(v.array(v.string())),
      correctAnswer: v.optional(v.string()),
      acceptableAnswers: v.optional(v.array(v.string())),
      rubric: v.optional(v.string()), // For essay grading
      passageText: v.optional(v.string()), // Reading context
      audioUrl: v.optional(v.string()), // Listening context
    }),

    // USER'S RAW ANSWER (stored for re-grading)
    userAnswer: v.string(), // Exactly what the user submitted
    responseTimeMs: v.optional(v.number()),

    // Multi-skill tagging
    skills: v.array(
      v.object({
        skill: v.string(), // "vocabulary" | "grammar" | "reading" | etc.
        weight: v.number(), // 0-1, how much this Q tests this skill
      })
    ),
    topics: v.optional(v.array(v.string())), // ["passive voice", "N3 kanji"]
    difficulty: v.optional(v.number()), // IRT difficulty parameter

    // CURRENT GRADING (can be re-computed)
    grading: v.object({
      isCorrect: v.boolean(),
      score: v.optional(v.number()), // 0-1 for partial credit
      modelUsed: v.optional(v.string()), // "gemini-2.0-flash" | "claude-3-haiku"
      gradedAt: v.number(),
      feedback: v.optional(v.string()), // AI explanation
      detailedScores: v.optional(
        v.object({
          grammar: v.optional(v.number()),
          usage: v.optional(v.number()),
          naturalness: v.optional(v.number()),
        })
      ),
    }),

    // GRADING HISTORY (for model comparison)
    gradingHistory: v.optional(
      v.array(
        v.object({
          modelUsed: v.string(),
          isCorrect: v.boolean(),
          score: v.optional(v.number()),
          gradedAt: v.number(),
        })
      )
    ),

    answeredAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "answeredAt"]),

  // Daily progress - time-series data for progress charts
  dailyProgress: defineTable({
    userId: v.string(),
    date: v.string(), // "2024-01-15"
    language: languageValidator,

    // Daily metrics
    studyMinutes: v.number(),
    cardsReviewed: v.number(),
    cardsCorrect: v.number(),
    questionsAnswered: v.number(),
    questionsCorrect: v.number(),
    wordsLearned: v.number(),
    contentConsumed: v.number(), // Stories/videos

    // Skill snapshots (for progress charts)
    skillSnapshot: v.object({
      vocabulary: v.number(),
      grammar: v.number(),
      reading: v.number(),
      listening: v.number(),
      writing: v.number(),
    }),

    createdAt: v.number(),
  }).index("by_user_language_date", ["userId", "language", "date"]),

  // Topic taxonomy - structured tags for questions and content
  topicTaxonomy: defineTable({
    language: languageValidator,

    // Hierarchical path
    category: v.string(), // "grammar" | "vocabulary" | "reading" | "listening" | "writing"
    subcategory: v.string(), // "verb_forms" | "particles" | "kanji" | ...
    topic: v.string(), // "passive" | "causative" | "te_form" | ...

    // Metadata
    displayName: v.string(), // "Passive Voice (受身形)"
    description: v.optional(v.string()),
    level: v.optional(v.string()), // "N5" | "N4" | ... (if level-specific)

    // For ML
    prerequisites: v.optional(v.array(v.id("topicTaxonomy"))), // Topics to learn first

    createdAt: v.number(),
  }),

  // Content preferences - user interests for personalized content
  // @deprecated: Migrated to userPreferences.content
  // Remove after running migration
  contentPreferences: defineTable({
    userId: v.string(),
    language: v.optional(languageValidator), // null = applies to all languages

    // Topic interests (for sentence/story generation)
    interests: v.array(v.string()), // ["anime", "cooking", "travel", "business"]

    // Content style
    tonePreference: v.optional(v.string()), // "casual" | "formal" | "humorous"
    ageAppropriate: v.optional(v.string()), // "all_ages" | "teen" | "adult"

    // Cultural focus (for Japanese)
    culturalFocus: v.optional(v.array(v.string())), // ["traditional", "modern", "pop_culture"]

    // Learning context
    learningGoal: v.optional(v.string()), // "jlpt_prep" | "travel" | "business" | "anime"

    // Avoid topics (sensitive)
    avoidTopics: v.optional(v.array(v.string())), // ["politics", "religion", ...]

    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // FSRS settings - user-configurable spaced repetition settings
  // @deprecated: Migrated to userPreferences.srs
  // Remove after running migration
  fsrsSettings: defineTable({
    userId: v.string(),
    language: v.optional(languageValidator),

    // User-facing settings
    desiredRetention: v.number(), // 0.80 to 0.97 (default: 0.90)
    dailyNewCards: v.number(), // How many new cards per day
    maximumInterval: v.number(), // Max days between reviews

    // Auto-optimized weights (optional override)
    customWeights: v.optional(v.array(v.number())), // 17 FSRS weights

    // Preset
    preset: v.optional(v.string()), // "default" | "aggressive" | "relaxed" | "custom"

    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ============================================
  // PRACTICE EXAMS
  // ============================================

  // Exam templates - structure definitions for reusable exams
  examTemplates: defineTable({
    examType: examTypeValidator,
    language: languageValidator,
    title: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()), // PDF filename or official source
    year: v.optional(v.number()),
    sections: v.array(
      v.object({
        type: examSectionTypeValidator,
        title: v.string(),
        timeLimitMinutes: v.optional(v.number()),
        questionCount: v.number(),
      })
    ),
    totalTimeLimitMinutes: v.optional(v.number()),
    passingScore: v.optional(v.number()), // Percentage needed to pass
    isPublished: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_exam_type", ["examType"])
    .index("by_language", ["language"])
    .index("by_published", ["isPublished"]),

  // Question bank - stores all digitized questions
  examQuestions: defineTable({
    templateId: v.optional(v.id("examTemplates")),
    examType: examTypeValidator,
    language: languageValidator,
    sectionType: examSectionTypeValidator,

    // Content
    questionText: v.string(),
    passageText: v.optional(v.string()), // For reading comprehension
    passageAudioUrl: v.optional(v.string()), // For listening sections

    // Answer format
    questionType: examQuestionTypeValidator,
    options: v.optional(v.array(v.string())), // For multiple choice
    correctAnswer: v.string(),
    acceptableAnswers: v.optional(v.array(v.string())), // Alternative correct answers
    explanation: v.optional(v.string()), // Why this is correct
    rubric: v.optional(v.string()), // For essay grading

    // Metadata
    difficulty: v.optional(v.number()), // IRT difficulty parameter
    points: v.number(),
    source: v.optional(v.string()), // PDF page reference

    // Topic tagging for analytics
    topicIds: v.optional(v.array(v.id("topicTaxonomy"))),

    createdAt: v.number(),
  })
    .index("by_template", ["templateId"])
    .index("by_exam_section", ["examType", "sectionType"]),

  // User exam attempts - tracks each exam session
  examAttempts: defineTable({
    userId: v.string(),
    templateId: v.id("examTemplates"),
    examType: examTypeValidator,
    language: languageValidator,

    // Attempt status
    status: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("abandoned")),

    // Questions for this attempt (subset of question bank)
    questions: v.array(
      v.object({
        questionId: v.id("examQuestions"),
        userAnswer: v.optional(v.string()),
        isCorrect: v.optional(v.boolean()),
        aiScore: v.optional(v.number()), // For essay/short answer
        aiFeedback: v.optional(v.string()),
        earnedPoints: v.optional(v.number()),
        answeredAt: v.optional(v.number()),
      })
    ),

    // Section progress
    currentSection: v.number(), // Index of current section
    currentQuestion: v.number(), // Index within section

    // Timing
    timeLimitMinutes: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    timeSpentSeconds: v.optional(v.number()),

    // Scoring
    totalPoints: v.number(),
    earnedPoints: v.optional(v.number()),
    percentScore: v.optional(v.number()),
    passed: v.optional(v.boolean()),

    // Section breakdown
    sectionScores: v.optional(
      v.array(
        v.object({
          sectionType: examSectionTypeValidator,
          totalPoints: v.number(),
          earnedPoints: v.number(),
          percentScore: v.number(),
        })
      )
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_exam", ["userId", "examType"])
    .index("by_template", ["templateId"]),

  // ============================================
  // USER CONTENT HISTORY (seen tracking)
  // ============================================
  // Tracks which content each user has seen per vocabulary word
  // Prevents showing the same sentence/image twice
  userContentHistory: defineTable({
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    seenSentenceIds: v.array(v.id("sentences")), // Sentences user has seen
    seenImageIds: v.array(v.id("images")), // Images user has seen
    lastShownAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_vocabulary", ["userId", "vocabularyId"]),

  // User exam analytics - aggregated stats per exam type
  examAnalytics: defineTable({
    userId: v.string(),
    examType: examTypeValidator,
    totalAttempts: v.number(),
    averageScore: v.number(),
    highestScore: v.number(),
    sectionScores: v.object({
      reading: v.optional(v.number()),
      listening: v.optional(v.number()),
      vocabulary: v.optional(v.number()),
      grammar: v.optional(v.number()),
      writing: v.optional(v.number()),
    }),
    weakAreas: v.optional(v.array(v.string())),
    lastAttemptAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_exam", ["userId", "examType"]),

  // ============================================
  // CONCEPT PRACTICE HISTORY (for grammar/pattern SRS)
  // ============================================
  // Track when concepts (not just vocab) were last practiced for spaced review
  conceptPracticeHistory: defineTable({
    userId: v.string(),
    language: languageValidator,
    conceptType: v.union(v.literal("grammar"), v.literal("pattern")),
    conceptId: v.string(), // "passive_voice", "te_form", "counters", etc.

    // Practice history
    lastPracticedAt: v.number(),
    practiceCount: v.number(),
    correctCount: v.number(),
    currentScore: v.number(), // 0-100

    // SRS-like scheduling for concepts
    nextReviewAt: v.optional(v.number()),
    intervalDays: v.optional(v.number()),
  })
    .index("by_user_language", ["userId", "language"])
    .index("by_user_due", ["userId", "nextReviewAt"]),
});

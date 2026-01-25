// Central re-export of Convex-generated types for React components

export type { Doc, Id } from "../../convex/_generated/dataModel";

// Re-export schema types
export type {
  BatchJobStatus,
  BatchJobType,
  CardState,
  ContentLanguage,
  DeckSubscriptionStatus,
  ExamType,
  MasteryState,
  Rating,
  SourceType,
  SubscriptionStatus,
  SubscriptionTier,
} from "../../convex/schema";

// GenerationStatus type (if needed in the future)
export type GenerationStatus = "pending" | "generating" | "completed" | "failed";

// Convenience type aliases for common document types
import type { Doc } from "../../convex/_generated/dataModel";

export type Vocabulary = Doc<"vocabulary">;
export type Flashcard = Doc<"flashcards">;
export type FlashcardReview = Doc<"flashcardReviews">;
export type User = Doc<"users">;
export type Subscription = Doc<"subscriptions">;
export type UserSettings = Doc<"userSettings">;
export type ReadingProgress = Doc<"readingProgress">;
export type MockTest = Doc<"mockTests">;
export type UserSentence = Doc<"userSentences">;
export type StoryComprehension = Doc<"storyComprehension">;
export type PlacementTest = Doc<"placementTests">;
export type PremadeVocabulary = Doc<"premadeVocabulary">;
export type PremadeDeck = Doc<"premadeDecks">;
export type UserDeckSubscription = Doc<"userDeckSubscriptions">;
export type BatchJob = Doc<"batchJobs">;
export type YoutubeContent = Doc<"youtubeContent">;

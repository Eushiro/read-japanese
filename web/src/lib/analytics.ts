import posthog from "posthog-js";

// PostHog configuration (same project as iOS app)
const POSTHOG_API_KEY = "REMOVED";
const POSTHOG_HOST = "https://us.i.posthog.com";

// Initialize PostHog
export function initAnalytics() {
  if (typeof window === "undefined") return;

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We handle page views manually with router
    capture_pageleave: true,
    autocapture: false, // We track events explicitly
    persistence: "localStorage",
  });
}

// User identification
export function identifyUser(
  userId: string,
  properties?: {
    email?: string | null;
    name?: string | null;
    subscription_tier?: string;
    languages_learning?: string[];
    target_exams?: string[];
  }
) {
  posthog.identify(userId, {
    ...properties,
    platform: "web",
  });
}

// Reset on logout
export function resetAnalytics() {
  posthog.reset();
}

// Page view tracking
export function trackPageView(path: string, properties?: Record<string, unknown>) {
  posthog.capture("$pageview", {
    $current_url: window.location.href,
    path,
    ...properties,
  });
}

// Generic event tracking
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

// Event names aligned with iOS app where applicable
export const AnalyticsEvents = {
  // Vocabulary (aligned with iOS)
  VOCABULARY_VIEWED: "vocabulary_viewed",
  VOCABULARY_SEARCHED: "vocabulary_searched",
  WORD_ADDED_TO_VOCABULARY: "word_added_to_vocabulary",
  WORD_REMOVED_FROM_VOCABULARY: "word_removed_from_vocabulary",
  WORD_TAPPED: "word_tapped",

  // Flashcards
  FLASHCARD_SESSION_STARTED: "flashcard_session_started",
  FLASHCARD_CARD_SHOWN: "flashcard_card_shown",
  FLASHCARD_ANSWER_REVEALED: "flashcard_answer_revealed",
  FLASHCARD_RATED: "flashcard_rated",
  FLASHCARD_SESSION_COMPLETED: "flashcard_session_completed",
  FLASHCARD_GENERATED: "flashcard_generated",

  // Practice
  PRACTICE_STARTED: "practice_started",
  PRACTICE_WORD_SELECTED: "practice_word_selected",
  SENTENCE_SUBMITTED: "sentence_submitted",
  SENTENCE_VERIFIED: "sentence_verified",

  // Reader (aligned with iOS)
  READER_OPENED: "reader_opened",
  READER_CLOSED: "reader_closed",
  CHAPTER_CHANGED: "chapter_changed",
  FURIGANA_TOGGLED: "furigana_toggled",
  AUDIO_PLAYED: "audio_played",

  // Library (aligned with iOS)
  LIBRARY_VIEWED: "library_viewed",
  STORY_SELECTED: "story_selected",

  // Settings (aligned with iOS)
  SETTINGS_OPENED: "settings_opened",
  SETTING_CHANGED: "setting_changed",
  UPGRADE_CLICKED: "upgrade_clicked",

  // Auth (aligned with iOS)
  LOGIN_COMPLETED: "login_completed",
  LOGOUT_COMPLETED: "logout_completed",

  // Onboarding
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_LANGUAGE_SELECTED: "onboarding_language_selected",
  ONBOARDING_EXAM_SELECTED: "onboarding_exam_selected",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // AI Operations
  AI_REQUEST_STARTED: "ai_request_started",
  AI_REQUEST_COMPLETED: "ai_request_completed",
  AI_REQUEST_FAILED: "ai_request_failed",
  AI_RESPONSE_CORRUPTED: "ai_response_corrupted",
  AI_RETRY_ATTEMPTED: "ai_retry_attempted",
  AI_FALLBACK_USED: "ai_fallback_used",
} as const;

// AI error tracking helpers
export function trackAIRequest(
  operation: string,
  model: string,
  properties?: Record<string, unknown>
) {
  trackEvent(AnalyticsEvents.AI_REQUEST_STARTED, {
    operation,
    model,
    timestamp: Date.now(),
    ...properties,
  });
}

export function trackAISuccess(
  operation: string,
  model: string,
  latencyMs: number,
  properties?: Record<string, unknown>
) {
  trackEvent(AnalyticsEvents.AI_REQUEST_COMPLETED, {
    operation,
    model,
    latency_ms: latencyMs,
    ...properties,
  });
}

export function trackAIError(
  operation: string,
  model: string,
  error: string,
  properties?: Record<string, unknown>
) {
  trackEvent(AnalyticsEvents.AI_REQUEST_FAILED, {
    operation,
    model,
    error,
    ...properties,
  });
}

export function trackAICorruptedResponse(
  operation: string,
  model: string,
  issue: string,
  properties?: Record<string, unknown>
) {
  trackEvent(AnalyticsEvents.AI_RESPONSE_CORRUPTED, {
    operation,
    model,
    issue, // e.g., "reasoning_in_field", "missing_required_field", "invalid_json"
    ...properties,
  });
}

export function trackAIRetry(
  operation: string,
  originalModel: string,
  retryModel: string,
  attemptNumber: number
) {
  trackEvent(AnalyticsEvents.AI_RETRY_ATTEMPTED, {
    operation,
    original_model: originalModel,
    retry_model: retryModel,
    attempt_number: attemptNumber,
  });
}

export function trackAIFallback(
  operation: string,
  failedModel: string,
  fallbackModel: string
) {
  trackEvent(AnalyticsEvents.AI_FALLBACK_USED, {
    operation,
    failed_model: failedModel,
    fallback_model: fallbackModel,
  });
}

// Feature flags
export function isFeatureEnabled(flag: string): boolean {
  return posthog.isFeatureEnabled(flag) ?? false;
}

export function getFeatureFlag(flag: string): unknown {
  return posthog.getFeatureFlagPayload(flag);
}

// Export posthog instance for advanced usage
export { posthog };

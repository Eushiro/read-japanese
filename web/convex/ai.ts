"use node";

// ============================================
// AI MODULE - BARREL FILE
// ============================================
// Re-exports all AI functions from modular files for backward compatibility
// All existing imports from "internal.ai.*" continue to work

// Core utilities and shared interfaces
export {
  calculateCostCents,
  callOpenRouter,
  callOpenRouterWithUsage,
  callWithRetry,
  type CallWithRetryResult,
  callWithRetryTracked,
  cleanJsonResponse,
  DEFAULT_MODEL,
  type GeneratedSentence,
  type JsonSchema,
  languageNames,
  MODEL_CHAIN,
  OPENROUTER_API_URL,
  parseJson,
  type SentenceTranslations,
  uiLanguageNames,
} from "./ai/core";

// Media generation (TTS and images)
export {
  generateFlashcardImage,
  generateFlashcardImageAction,
  generateTTSAudio,
  generateTTSAudioAction,
} from "./ai/media";

// Flashcard and sentence operations
export {
  enhancePremadeVocabulary,
  generateFlashcard,
  generateFlashcardAudio,
  generateFlashcardsBulk,
  generateFlashcardWithAudio,
  generateSentence,
  generateSentenceHelper,
  generateSentenceHelperTracked,
  generateSentenceInternal,
  refreshFlashcardSentence,
  verifySentence,
  verifySentenceInternal,
} from "./ai/flashcards";

// Comprehension (story and video)
export {
  fetchYoutubeTranscript,
  generateComprehensionQuestions,
  generateVideoQuestions,
  gradeComprehensionAnswer,
} from "./ai/comprehension";

// Assessment (placement tests, exams, shadowing)
export {
  difficultyToLevel,
  evaluateShadowing,
  generatePlacementQuestion,
  getNextQuestionDifficulty,
  gradeExamAnswer,
  gradeExamAnswerInternal,
  gradeExamAnswersBatch,
} from "./ai/assessment";

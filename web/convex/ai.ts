"use node";

// ============================================
// AI MODULE - BARREL FILE
// ============================================
// Re-exports all AI functions from modular files for backward compatibility
// All existing imports from "internal.ai.*" continue to work

// Core utilities and shared interfaces
export {
  callOpenRouter,
  callOpenRouterWithUsage,
  callWithRetry,
  type CallWithRetryResult,
  callWithRetryTracked,
  cleanJsonResponse,
  type GeneratedSentence,
  type JsonSchema,
  languageNames,
  OPENROUTER_API_URL,
  parseJson,
  type SentenceTranslations,
  uiLanguageNames,
} from "./ai/core";

// Model configuration (single source of truth)
export { TEXT_MODEL_CHAIN, TEXT_MODELS } from "./lib/models";

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
  generatePersonalizedStoryInternal,
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

// Definition translations
export { translateDefinitions, translateDefinitionsTracked } from "./ai/definitions";

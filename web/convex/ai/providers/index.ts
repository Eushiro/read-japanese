"use node";

// ============================================
// UNIFIED AI PROVIDER EXPORTS
// ============================================

// Types
export type {
  AIProvider,
  AudioInputOptions,
  ImageGenerationOptions,
  ImageGenerationResult,
  JsonSchema,
  ModelConfig,
  ProviderType,
  TextGenerationOptions,
  TextGenerationResult,
  TokenUsage,
  TTSOptions,
  TTSResult,
} from "./types";

// Google provider
export {
  generateImage as googleGenerateImage,
  generateSpeech as googleGenerateSpeech,
  generateText as googleGenerateText,
  generateTextWithAudio as googleGenerateTextWithAudio,
} from "./google";

// OpenRouter provider
export {
  generateImage as openrouterGenerateImage,
  generateText as openrouterGenerateText,
  generateTextWithAudio as openrouterGenerateTextWithAudio,
} from "./openrouter";

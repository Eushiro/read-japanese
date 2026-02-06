/**
 * AI Model Configuration - Single Source of Truth
 *
 * ALL AI models used in the app are defined ONLY here.
 * Review this file to audit which models are in use.
 *
 * To add a new model:
 * 1. Add it to the appropriate *_MODELS constant
 * 2. Add it to any chains that should use it
 * 3. Update ESLint config if needed (the regex catches most model name patterns)
 */

// ============================================
// PROVIDER TYPES
// ============================================

export type ProviderType = "google" | "openrouter";

export interface ModelConfig {
  model: string;
  provider: ProviderType;
}

// ============================================
// TEXT MODELS
// ============================================

export const TEXT_MODELS = {
  // Google direct API models (free tier)
  GEMINI_3_FLASH: "gemini-3-flash-preview",

  // OpenRouter-routed models (fallbacks)
  KIMI_K2_5: "moonshotai/kimi-k2.5",
  CLAUDE_HAIKU_4_5: "anthropic/claude-haiku-4.5",
} as const;

// ============================================
// AUDIO MODELS
// ============================================

export const AUDIO_MODELS = {
  // Google TTS (direct API)
  GEMINI_TTS: "gemini-2.5-flash-preview-tts",
} as const;

// ============================================
// IMAGE MODELS
// ============================================

export const IMAGE_MODELS = {
  // Google image generation (direct API)
  GEMINI_IMAGE: "gemini-2.5-flash-image",
} as const;

// ============================================
// SPECIAL MODELS
// ============================================

export const SPECIAL_MODELS = {
  // Tag for user-submitted content (not an actual AI model)
  USER: "user",
} as const;

// ============================================
// MODEL CHAINS (fallback sequences)
// ============================================

/**
 * Default text generation chain: Gemini (Google) -> Kimi (OpenRouter) -> Claude (OpenRouter)
 * Primary model is Gemini via Google direct API (free tier)
 */
export const TEXT_MODEL_CHAIN: ModelConfig[] = [
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
  { model: TEXT_MODELS.KIMI_K2_5, provider: "openrouter" },
  { model: TEXT_MODELS.CLAUDE_HAIKU_4_5, provider: "openrouter" },
];

/**
 * Additional models used only in admin test mode comparisons
 */
export const TEST_MODELS = {
  GROK_CODE_FAST: "x-ai/grok-code-fast-1",
  GPT_OSS_20B: "openai/gpt-oss-20b",
  CLAUDE_SONNET_4_5: "anthropic/claude-sonnet-4.5",
} as const;

/**
 * Test mode models: all models to compare in parallel (admin model test mode)
 */
export const TEST_MODE_MODELS: ModelConfig[] = [
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
  { model: TEST_MODELS.GROK_CODE_FAST, provider: "openrouter" },
  { model: TEST_MODELS.GPT_OSS_20B, provider: "openrouter" },
  { model: TEST_MODELS.CLAUDE_SONNET_4_5, provider: "openrouter" },
];

/**
 * Grading model chain: Gemini first (fast & free), Kimi as fallback
 * Used for structured evaluation tasks
 */
export const GRADING_MODEL_CHAIN: ModelConfig[] = [
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
  { model: TEXT_MODELS.KIMI_K2_5, provider: "openrouter" },
];

/**
 * Content generation models (two-candidate parallel generation)
 * Gemini is PRIMARY for grading and first candidate
 */
export const CONTENT_MODELS = {
  primary: { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" as ProviderType },
  secondary: { model: TEXT_MODELS.KIMI_K2_5, provider: "openrouter" as ProviderType },
};

/**
 * TTS model configuration
 */
export const TTS_MODEL: ModelConfig = {
  model: AUDIO_MODELS.GEMINI_TTS,
  provider: "google",
};

/**
 * Image generation model configuration
 */
export const IMAGE_MODEL: ModelConfig = {
  model: IMAGE_MODELS.GEMINI_IMAGE,
  provider: "google",
};

// ============================================
// COMBINED EXPORTS
// ============================================

/**
 * All model identifiers for simple lookups
 */
export const MODELS = {
  ...TEXT_MODELS,
  ...AUDIO_MODELS,
  ...IMAGE_MODELS,
  ...SPECIAL_MODELS,
} as const;

export type Model = (typeof MODELS)[keyof typeof MODELS];

// ============================================
// PROVIDER ROUTING UTILITIES
// ============================================

/**
 * Check if a model should be routed to Google direct API
 * All Gemini models use Google's direct API for cost efficiency
 */
export function isGoogleModel(model: string): boolean {
  // All Google models start with "gemini" or have "google/" prefix
  return model.startsWith("gemini") || model.startsWith("google/");
}

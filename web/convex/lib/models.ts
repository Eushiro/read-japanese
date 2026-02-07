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
  // OpenRouter-routed models
  GPT_5_2_CHAT: "openai/gpt-5.2-chat",
  GPT_OSS_120B: "openai/gpt-oss-120b",
  CLAUDE_SONNET_4_5: "anthropic/claude-sonnet-4.5",
  CLAUDE_HAIKU_4_5: "anthropic/claude-haiku-4.5",

  // Google direct API models
  GEMINI_3_FLASH: "gemini-3-flash-preview",
} as const;

// ============================================
// DEFAULT MODEL SELECTION (LOCAL VS PROD)
// ============================================

const MODEL_ENV = (
  process.env.AI_DEFAULT_ENV ??
  process.env.NODE_ENV ??
  "development"
).toLowerCase();
const IS_PROD = MODEL_ENV === "production" || MODEL_ENV === "prod";
const DEFAULT_PRIMARY_TEXT_MODEL = IS_PROD
  ? TEXT_MODELS.CLAUDE_SONNET_4_5
  : TEXT_MODELS.GPT_5_2_CHAT;
const DEFAULT_SECONDARY_TEXT_MODEL = IS_PROD
  ? TEXT_MODELS.GPT_5_2_CHAT
  : TEXT_MODELS.CLAUDE_SONNET_4_5;

export const DEFAULT_TEXT_PRIMARY: ModelConfig = {
  model: DEFAULT_PRIMARY_TEXT_MODEL,
  provider: "openrouter",
};
export const DEFAULT_TEXT_SECONDARY: ModelConfig = {
  model: DEFAULT_SECONDARY_TEXT_MODEL,
  provider: "openrouter",
};

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
 * Default text generation chain:
 * - Prod: Claude Sonnet (OpenRouter) -> GPT-5.2-Chat (OpenRouter) -> Gemini Flash (Google)
 * - Local: GPT-5.2-Chat (OpenRouter) -> Claude Sonnet (OpenRouter) -> Gemini Flash (Google)
 */
export const TEXT_MODEL_CHAIN: ModelConfig[] = [
  DEFAULT_TEXT_PRIMARY,
  DEFAULT_TEXT_SECONDARY,
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
];

/**
 * Additional models used only in admin test mode comparisons
 */
export const TEST_MODELS = {
  GROK_FAST: "x-ai/grok-4.1-fast",
} as const;

/**
 * Test mode models: all models to compare in parallel (admin model test mode)
 */
export const TEST_MODE_MODELS: ModelConfig[] = [
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
  { model: TEST_MODELS.GROK_FAST, provider: "openrouter" },
  { model: TEXT_MODELS.GPT_5_2_CHAT, provider: "openrouter" },
  { model: TEXT_MODELS.CLAUDE_SONNET_4_5, provider: "openrouter" },
];

/**
 * Grading model chain: Claude Sonnet (OpenRouter) -> GPT-5.2-Chat (OpenRouter) -> Gemini Flash (Google)
 * Used for structured evaluation tasks
 */
export const GRADING_MODEL_CHAIN: ModelConfig[] = [
  DEFAULT_TEXT_PRIMARY,
  DEFAULT_TEXT_SECONDARY,
  { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
];

/**
 * Content generation models (two-candidate parallel generation)
 */
export const CONTENT_MODELS = {
  primary: DEFAULT_TEXT_PRIMARY,
  secondary: DEFAULT_TEXT_SECONDARY,
};

/** Number of parallel calls in race mode */
export const RACE_CONCURRENCY = 4;

/** Race config: model to race + fallback chain */
export const TEXT_MODEL_RACE_CONFIG = {
  raceModel: DEFAULT_TEXT_PRIMARY,
  fallbackChain: [
    DEFAULT_TEXT_SECONDARY,
    { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" as ProviderType },
  ],
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

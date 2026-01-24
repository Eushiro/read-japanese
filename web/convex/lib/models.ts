/**
 * AI Model Constants
 */

export const MODELS = {
  // Text generation
  GEMINI_3_FLASH: "gemini-3-flash",

  // Audio generation (TTS)
  GEMINI_2_5_FLASH_PREVIEW_TTS: "gemini-2.5-flash-preview-tts",

  // Image generation
  GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image",

  // User-submitted content
  USER: "user",
} as const;

export type Model = (typeof MODELS)[keyof typeof MODELS];

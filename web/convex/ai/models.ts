"use node";

import {
  CONTENT_MODELS,
  GRADING_MODEL_CHAIN,
  IMAGE_MODEL,
  type ModelConfig,
  type ProviderType,
  RACE_CONCURRENCY,
  TEXT_MODEL_CHAIN,
  TEXT_MODEL_RACE_CONFIG,
  TEXT_MODELS,
  TTS_MODEL,
} from "../lib/models";
import {
  googleGenerateImage,
  googleGenerateSpeech,
  googleGenerateText,
  googleGenerateTextWithAudio,
  type ImageGenerationOptions,
  type ImageGenerationResult,
  type JsonSchema,
  openrouterGenerateText,
  type TextGenerationOptions,
  type TextGenerationResult,
  type TTSOptions,
  type TTSResult,
} from "./providers";

// Re-export model configuration from lib/models.ts
export {
  CONTENT_MODELS,
  GRADING_MODEL_CHAIN,
  IMAGE_MODEL,
  RACE_CONCURRENCY,
  TEXT_MODEL_CHAIN,
  TEXT_MODEL_RACE_CONFIG,
  TEXT_MODELS,
  TTS_MODEL,
};

// ============================================
// GENERIC TEXT GENERATION
// ============================================

export interface GenerateTextOptions extends TextGenerationOptions {
  /** Model chain to try (defaults to TEXT_MODEL_CHAIN) */
  models?: ModelConfig[];
}

export type GenerateTextResult = TextGenerationResult;

/**
 * Generate text using the default model chain with fallback
 * Automatically routes to appropriate provider
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const models = options.models || TEXT_MODEL_CHAIN;
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const config = models[i];
    const isRetry = i > 0;

    if (isRetry) {
      console.log(`Retrying with model: ${config.model} (${config.provider})`);
    }

    try {
      const result = await callProvider(config, {
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens,
        jsonSchema: options.jsonSchema,
        temperature: options.temperature,
      });

      return result;
    } catch (error) {
      console.error(`Model ${config.model} (${config.provider}) failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Failed after trying ${models.length} models`);
}

/**
 * Generate text with a specific model preference
 */
export async function generateTextWithPreference(
  options: TextGenerationOptions,
  preference: "fast" | "smart" | "cheap"
): Promise<GenerateTextResult> {
  const chain = getModelChainForPreference(preference);
  return generateText({ ...options, models: chain });
}

/**
 * Get the model chain for a given preference
 */
function getModelChainForPreference(preference: "fast" | "smart" | "cheap"): ModelConfig[] {
  switch (preference) {
    case "fast":
      // Gemini first (lowest latency)
      return [
        { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
        { model: TEXT_MODELS.CLAUDE_HAIKU_4_5, provider: "openrouter" },
      ];
    case "smart":
      // GPT-OSS-120B first (best quality for complex tasks)
      return [
        { model: TEXT_MODELS.GPT_OSS_120B, provider: "openrouter" },
        { model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" },
      ];
    case "cheap":
      // Gemini only (free tier)
      return [{ model: TEXT_MODELS.GEMINI_3_FLASH, provider: "google" }];
    default:
      return TEXT_MODEL_CHAIN;
  }
}

/**
 * Route to appropriate provider for text generation
 */
async function callProvider(
  config: ModelConfig,
  options: TextGenerationOptions
): Promise<TextGenerationResult> {
  if (config.provider === "google") {
    return googleGenerateText({ ...options, model: config.model });
  } else {
    return openrouterGenerateText({ ...options, model: config.model });
  }
}

// ============================================
// PARSED TEXT GENERATION (with validation)
// ============================================

export interface GenerateAndParseOptions<T> extends GenerateTextOptions {
  /** Parse the response string into the expected type */
  parse: (response: string) => T;
  /** Optional validation - return error message if invalid, null if valid */
  validate?: (parsed: T) => string | null;
}

export interface GenerateAndParseResult<T> {
  result: T;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
}

/**
 * Generate text, parse, and validate with retry through model chain
 */
export async function generateAndParse<T>(
  options: GenerateAndParseOptions<T>
): Promise<GenerateAndParseResult<T>> {
  const models = options.models || TEXT_MODEL_CHAIN;
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const config = models[i];
    const isRetry = i > 0;

    if (isRetry) {
      console.log(`Retrying with model: ${config.model} (${config.provider})`);
    }

    try {
      const response = await callProvider(config, {
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens,
        jsonSchema: options.jsonSchema,
        temperature: options.temperature,
      });

      const parsed = options.parse(response.content);

      // Run validation if provided
      if (options.validate) {
        const validationError = options.validate(parsed);
        if (validationError) {
          console.warn(`Validation failed for model ${config.model}: ${validationError}`);
          lastError = new Error(validationError);
          continue; // Try next model
        }
      }

      return {
        result: parsed,
        usage: {
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs: response.latencyMs,
        },
      };
    } catch (error) {
      console.error(`Model ${config.model} failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Failed after trying ${models.length} models`);
}

// ============================================
// RACE-BASED PARSED TEXT GENERATION
// ============================================

export interface GenerateAndParseRaceOptions<T> extends GenerateAndParseOptions<T> {
  raceModel: ModelConfig;
  raceConcurrency?: number;
  fallbackChain: ModelConfig[];
}

/**
 * Race N parallel calls with the same cheap model, pick the first valid result.
 * Falls back to sequential chain if all race calls fail.
 */
export async function generateAndParseRace<T>(
  options: GenerateAndParseRaceOptions<T>
): Promise<GenerateAndParseResult<T>> {
  const concurrency = options.raceConcurrency ?? RACE_CONCURRENCY;
  const { raceModel, fallbackChain } = options;

  const providerOptions = {
    prompt: options.prompt,
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens,
    jsonSchema: options.jsonSchema,
    temperature: options.temperature,
  };

  // Phase 1: Race N concurrent calls with the same cheap model
  const racePromises = Array.from({ length: concurrency }, (_, i) => {
    const promise = (async (): Promise<GenerateAndParseResult<T>> => {
      const response = await callProvider(raceModel, providerOptions);
      const parsed = options.parse(response.content);

      if (options.validate) {
        const validationError = options.validate(parsed);
        if (validationError) {
          throw new Error(`Race call ${i} validation failed: ${validationError}`);
        }
      }

      return {
        result: parsed,
        usage: {
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs: response.latencyMs,
        },
      };
    })();

    // Suppress unhandled rejection warnings for losing race calls
    promise.catch(() => {});
    return promise;
  });

  try {
    const result = await Promise.any(racePromises);
    console.log(`Race completed: ${raceModel.model} won (${concurrency} parallel calls)`);
    return result;
  } catch (aggregateError) {
    const errors =
      aggregateError instanceof AggregateError ? aggregateError.errors : [aggregateError];
    console.warn(
      `All ${concurrency} race calls to ${raceModel.model} failed:`,
      errors.map((e: unknown) => (e instanceof Error ? e.message : String(e)))
    );
  }

  // Phase 2: Sequential fallback through remaining models
  return generateAndParse({ ...options, models: fallbackChain });
}

// ============================================
// IMAGE GENERATION
// ============================================

/**
 * Generate an image using Google Gemini (no fallback)
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult | null> {
  try {
    const result = await googleGenerateImage(options);
    if (result) return result;
  } catch (error) {
    console.error("Google image generation failed:", error);
  }

  return null;
}

// ============================================
// TTS GENERATION
// ============================================

/**
 * Generate speech audio using the default TTS model
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult | null> {
  return googleGenerateSpeech(options);
}

// ============================================
// AUDIO INPUT EVALUATION
// ============================================

export interface AudioEvaluationOptions {
  /** The prompt for the AI */
  prompt: string;
  /** System prompt with evaluation instructions */
  systemPrompt: string;
  /** Base64 encoded audio data */
  audioBase64: string;
  /** Audio format (e.g., "wav", "webm") */
  audioFormat: string;
  /** JSON schema for structured output */
  jsonSchema?: JsonSchema;
}

/**
 * Evaluate audio input using an audio-capable model
 * Uses Google's Gemini API with multimodal audio support
 */
export async function evaluateAudioInput(
  options: AudioEvaluationOptions
): Promise<TextGenerationResult> {
  return googleGenerateTextWithAudio({
    prompt: options.prompt,
    systemPrompt: options.systemPrompt,
    model: TEXT_MODELS.GEMINI_3_FLASH,
    audioBase64: options.audioBase64,
    audioFormat: options.audioFormat,
    jsonSchema: options.jsonSchema,
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clean JSON response - strips markdown code blocks and whitespace
 */
export function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

/**
 * Parse JSON response with automatic cleanup
 */
export function parseJson<T>(response: string): T {
  const cleaned = cleanJsonResponse(response);
  return JSON.parse(cleaned) as T;
}

// Re-export types for convenience
export type {
  ImageGenerationOptions,
  ImageGenerationResult,
  JsonSchema,
  ModelConfig,
  ProviderType,
  TextGenerationOptions,
  TextGenerationResult,
  TTSOptions,
  TTSResult,
};

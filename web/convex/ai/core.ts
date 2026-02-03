"use node";

import { isGoogleModel, type ModelConfig, TEXT_MODEL_CHAIN } from "../lib/models";
import {
  cleanJsonResponse as cleanJsonResponseNew,
  generateAndParse,
  generateText as generateTextNew,
  parseJson as parseJsonNew,
} from "./models";

// ============================================
// OPENROUTER CONFIGURATION & SHARED UTILITIES
// ============================================

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: OpenRouterUsage;
  model?: string;
}

export interface AICallResult {
  content: string;
  usage?: OpenRouterUsage;
  model: string;
  latencyMs: number;
}

export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

/**
 * Convert string model names to ModelConfig array
 */
function toModelConfigs(models: string[]): ModelConfig[] {
  return models.map((model) => {
    // Route Google models to Google direct API
    if (isGoogleModel(model)) {
      return { model, provider: "google" as const };
    }
    // OpenRouter models
    return { model, provider: "openrouter" as const };
  });
}

/**
 * Call AI and return content string
 */
export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model?: string,
  maxTokens: number = 500,
  jsonSchema?: JsonSchema
): Promise<string> {
  const result = await callOpenRouterWithUsage(prompt, systemPrompt, model, maxTokens, jsonSchema);
  return result.content;
}

/**
 * Call AI and return full result including usage data
 */
export async function callOpenRouterWithUsage(
  prompt: string,
  systemPrompt: string,
  model?: string,
  maxTokens: number = 500,
  jsonSchema?: JsonSchema
): Promise<AICallResult> {
  const models = model ? toModelConfigs([model]) : TEXT_MODEL_CHAIN;

  const result = await generateTextNew({
    prompt,
    systemPrompt,
    maxTokens,
    jsonSchema,
    models,
  });

  return {
    content: result.content,
    usage: {
      prompt_tokens: result.usage.inputTokens,
      completion_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
    },
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

/**
 * Clean JSON response - strips markdown code blocks and whitespace
 */
export function cleanJsonResponse(response: string): string {
  return cleanJsonResponseNew(response);
}

/**
 * Parse JSON response with automatic cleanup
 */
export function parseJson<T>(response: string): T {
  return parseJsonNew<T>(response);
}

export interface CallWithRetryOptions<T> {
  prompt: string;
  systemPrompt: string;
  maxTokens?: number;
  jsonSchema?: JsonSchema;
  /** Parse the response string into the expected type */
  parse: (response: string) => T;
  /** Optional validation - return error message if invalid, null if valid */
  validate?: (parsed: T) => string | null;
  /** Model configs to try (defaults to TEXT_MODEL_CHAIN) */
  models?: ModelConfig[];
}

export interface CallWithRetryResult<T> {
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
 * Call AI with automatic retry through model chain
 * Retries on API errors AND validation failures
 */
export async function callWithRetry<T>(options: CallWithRetryOptions<T>): Promise<T> {
  const result = await callWithRetryTracked(options);
  return result.result;
}

/**
 * Call AI with automatic retry and return usage tracking data
 */
export async function callWithRetryTracked<T>(
  options: CallWithRetryOptions<T>
): Promise<CallWithRetryResult<T>> {
  const { prompt, systemPrompt, maxTokens = 500, jsonSchema, parse, validate, models } = options;

  const result = await generateAndParse<T>({
    prompt,
    systemPrompt,
    maxTokens,
    jsonSchema,
    models: models || TEXT_MODEL_CHAIN,
    parse,
    validate,
  });

  return {
    result: result.result,
    usage: result.usage,
  };
}

// ============================================
// SHARED CONSTANTS
// ============================================

export const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

export const uiLanguageNames: Record<string, string> = {
  en: "English",
  ja: "日本語",
  fr: "français",
  zh: "中文",
};

// ============================================
// SHARED INTERFACES
// ============================================

export interface SentenceTranslations {
  en?: string;
  ja?: string;
  fr?: string;
  zh?: string;
}

export interface GeneratedSentence {
  sentence: string;
  translation: string;
  translations: SentenceTranslations;
}

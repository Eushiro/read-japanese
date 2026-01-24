"use node";

// ============================================
// OPENROUTER CONFIGURATION & SHARED UTILITIES
// ============================================

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Model configuration - ordered by preference (primary first, then fallbacks)
export const MODEL_CHAIN = [
  "google/gemini-3-flash-preview", // Primary: fast and cheap
  "anthropic/claude-haiku-4.5", // Fallback: reliable structured output
];

// For backward compatibility
export const DEFAULT_MODEL = MODEL_CHAIN[0];

export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string = DEFAULT_MODEL,
  maxTokens: number = 500,
  jsonSchema?: JsonSchema
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  // Enable structured JSON output with schema for Gemini
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        strict: true,
        schema: jsonSchema.schema,
      },
    };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://sanlang.app",
      "X-Title": "SanLang",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "";
}

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

export interface CallWithRetryOptions<T> {
  prompt: string;
  systemPrompt: string;
  maxTokens?: number;
  jsonSchema?: JsonSchema;
  /** Parse the response string into the expected type */
  parse: (response: string) => T;
  /** Optional validation - return error message if invalid, null if valid */
  validate?: (parsed: T) => string | null;
  /** Model chain to try (defaults to MODEL_CHAIN) */
  models?: string[];
}

/**
 * Call OpenRouter with automatic retry through model chain
 * Retries on API errors AND validation failures
 */
export async function callWithRetry<T>(options: CallWithRetryOptions<T>): Promise<T> {
  const {
    prompt,
    systemPrompt,
    maxTokens = 500,
    jsonSchema,
    parse,
    validate,
    models = MODEL_CHAIN,
  } = options;

  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isRetry = i > 0;

    if (isRetry) {
      console.log(`Retrying with model: ${model}`);
    }

    try {
      const response = await callOpenRouter(prompt, systemPrompt, model, maxTokens, jsonSchema);
      const parsed = parse(response);

      // Run validation if provided
      if (validate) {
        const validationError = validate(parsed);
        if (validationError) {
          console.warn(`Validation failed for model ${model}: ${validationError}`);
          lastError = new Error(validationError);
          continue; // Try next model
        }
      }

      return parsed;
    } catch (error) {
      console.error(`Model ${model} failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Failed after trying ${models.length} models`);
}

// ============================================
// SHARED CONSTANTS
// ============================================

export const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

// UI language names for feedback
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
  translation: string; // Kept for backwards compatibility (English)
  translations: SentenceTranslations; // All UI language translations
}

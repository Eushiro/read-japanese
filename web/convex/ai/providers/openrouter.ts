"use node";

import { BRAND } from "../../lib/brand";
import { compressToWebp } from "../../lib/imageCompression";
import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  TextGenerationOptions,
  TextGenerationResult,
  TokenUsage,
} from "./types";

// ============================================
// OPENROUTER API
// ============================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Get the OpenRouter API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }
  return apiKey;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      images?: Array<{
        image_url?: {
          url: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

// ============================================
// TEXT GENERATION
// ============================================

/**
 * Generate text using OpenRouter API
 */
export async function generateText(
  options: TextGenerationOptions & { model: string }
): Promise<TextGenerationResult> {
  const apiKey = getApiKey();

  const messages = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.prompt });

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 500,
    max_completion_tokens: options.maxTokens || 500,
  };

  // Enable structured JSON output with schema
  if (options.jsonSchema) {
    // Only use full json_schema mode for models known to support it well (OpenAI, Claude)
    // Other models may return empty responses or malformed JSON with json_schema
    // Fall back to simple json_object mode which just asks for JSON output
    const supportsJsonSchema =
      options.model.includes("openai/") || options.model.includes("anthropic/");

    if (supportsJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.jsonSchema.name,
          strict: true,
          schema: options.jsonSchema.schema,
        },
      };
    } else {
      // Fall back to simple JSON mode - model will follow schema from prompt
      body.response_format = { type: "json_object" };
    }
  }

  const startTime = Date.now();

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": BRAND.url,
      "X-Title": BRAND.name,
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;

  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    usage,
    model: data.model || options.model,
    latencyMs,
  };
}

// ============================================
// IMAGE GENERATION (via OpenRouter)
// ============================================

/**
 * Generate an image using OpenRouter (for models that support it)
 */
export async function generateImage(
  options: ImageGenerationOptions & { model: string }
): Promise<ImageGenerationResult | null> {
  const apiKey = getApiKey();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": BRAND.url,
        "X-Title": BRAND.name,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: "user",
            content: options.prompt,
          },
        ],
        modalities: ["image", "text"],
        image_generation_config: {
          aspect_ratio: options.aspectRatio || "1:1",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter image generation error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = (await response.json()) as OpenRouterResponse;
    console.log("OpenRouter image response:", JSON.stringify(result, null, 2));

    // Extract raw image bytes from response
    let rawImageBytes: Uint8Array | null = null;

    // Check for images array in the response
    const images = result.choices?.[0]?.message?.images;
    if (images && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url;
      if (imageUrl && imageUrl.startsWith("data:image/")) {
        const base64Match = imageUrl.match(/data:image\/(\w+);base64,(.+)/);
        if (base64Match) {
          const base64Data = base64Match[2];
          const binaryString = atob(base64Data);
          rawImageBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            rawImageBytes[i] = binaryString.charCodeAt(i);
          }
        }
      }
    }

    // Fallback: Check content for base64 data URL
    if (!rawImageBytes) {
      const content = result.choices?.[0]?.message?.content;
      if (content && typeof content === "string") {
        const base64Match = content.match(/data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/);
        if (base64Match) {
          const base64Data = base64Match[2];
          const binaryString = atob(base64Data);
          rawImageBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            rawImageBytes[i] = binaryString.charCodeAt(i);
          }
        }
      }
    }

    if (!rawImageBytes) {
      console.error("No image data found in OpenRouter response");
      return null;
    }

    // Compress to WebP for storage efficiency
    const compressedBytes = await compressToWebp(rawImageBytes);
    console.log(
      `Image compressed: ${rawImageBytes.length} bytes -> ${compressedBytes.length} bytes (${Math.round((1 - compressedBytes.length / rawImageBytes.length) * 100)}% savings)`
    );

    return {
      imageData: compressedBytes,
      mimeType: "image/webp",
    };
  } catch (error) {
    console.error("OpenRouter image generation failed:", error);
    return null;
  }
}

// ============================================
// EMBEDDING GENERATION
// ============================================

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

interface OpenRouterEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

/**
 * Generate an embedding vector using OpenRouter's embeddings endpoint.
 */
export async function generateEmbedding(
  text: string,
  model: string
): Promise<{ embedding: number[]; usage: { promptTokens: number; totalTokens: number } }> {
  const apiKey = getApiKey();

  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": BRAND.url,
      "X-Title": BRAND.name,
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter embeddings error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterEmbeddingResponse;

  return {
    embedding: data.data[0].embedding,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

// ============================================
// AUDIO INPUT SUPPORT
// ============================================

/**
 * Generate text with audio input (for models that support it, like gpt-audio-mini)
 */
export async function generateTextWithAudio(
  options: TextGenerationOptions & {
    model: string;
    audioBase64: string;
    audioFormat?: string;
  }
): Promise<TextGenerationResult> {
  const apiKey = getApiKey();

  const messages = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: options.prompt,
      },
      {
        type: "input_audio",
        input_audio: {
          data: options.audioBase64,
          format: options.audioFormat || "wav",
        },
      },
    ],
  });

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    max_tokens: options.maxTokens || 500,
    max_completion_tokens: options.maxTokens || 500,
  };

  // Enable structured JSON output with schema
  if (options.jsonSchema) {
    // Only use full json_schema mode for models known to support it well (OpenAI, Claude)
    // Other models may return empty responses or malformed JSON with json_schema
    // Fall back to simple json_object mode which just asks for JSON output
    const supportsJsonSchema =
      options.model.includes("openai/") || options.model.includes("anthropic/");

    if (supportsJsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.jsonSchema.name,
          strict: true,
          schema: options.jsonSchema.schema,
        },
      };
    } else {
      // Fall back to simple JSON mode - model will follow schema from prompt
      body.response_format = { type: "json_object" };
    }
  }

  const startTime = Date.now();

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": BRAND.url,
      "X-Title": BRAND.name,
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;

  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    usage,
    model: data.model || options.model,
    latencyMs,
  };
}

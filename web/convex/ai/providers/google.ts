"use node";

import { convertPcmToMp3 } from "../../lib/audioCompression";
import { compressToWebp } from "../../lib/imageCompression";
import { AUDIO_MODELS, IMAGE_MODELS } from "../../lib/models";
import type {
  AudioInputOptions,
  ImageGenerationOptions,
  ImageGenerationResult,
  JsonSchema,
  TextGenerationOptions,
  TextGenerationResult,
  TokenUsage,
  TTSOptions,
  TTSResult,
} from "./types";

// ============================================
// GOOGLE GENERATIVE LANGUAGE API
// ============================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const TTS_VOICE = "Aoede";

/**
 * Get the Gemini API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return apiKey;
}

// ============================================
// TEXT GENERATION
// ============================================

/**
 * Generate text using Google Gemini API
 */
export async function generateText(
  options: TextGenerationOptions & { model: string }
): Promise<TextGenerationResult> {
  const apiKey = getApiKey();
  const modelName = options.model.replace("google/", "");

  const contents = [];

  // Add system prompt as first message if provided
  if (options.systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: options.systemPrompt }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "I understand. I will follow these instructions." }],
    });
  }

  // Add user prompt
  contents.push({
    role: "user",
    parts: [{ text: options.prompt }],
  });

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxTokens || 500,
    temperature: options.temperature ?? 0.7,
  };

  // Add JSON schema for structured output
  if (options.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = convertToGeminiSchema(options.jsonSchema);
  }

  const startTime = Date.now();

  const response = await fetch(
    `${GEMINI_API_URL}/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig,
      }),
    }
  );

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Extract content
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Extract usage
  const usageMetadata = result.usageMetadata || {};
  const usage: TokenUsage = {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: usageMetadata.candidatesTokenCount || 0,
    totalTokens: usageMetadata.totalTokenCount || 0,
  };

  return {
    content,
    usage,
    model: modelName,
    latencyMs,
  };
}

/**
 * Recursively strip JSON Schema fields that Gemini doesn't support
 */
function stripUnsupportedFields(obj: Record<string, unknown>): Record<string, unknown> {
  // Fields not supported by Gemini's responseSchema
  const unsupportedKeys = ["additionalProperties", "minItems", "maxItems", "minimum", "maximum"];

  // Gemini requires uppercase type names
  const typeMap: Record<string, string> = {
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY",
    object: "OBJECT",
  };

  const result: Record<string, unknown> = {};

  // Handle nullable types: ["string", "null"] → { type: "STRING", nullable: true }
  if (Array.isArray(obj.type)) {
    const types = obj.type as string[];
    const nonNullType = types.find((t) => t !== "null");
    if (nonNullType) {
      result.type = typeMap[nonNullType] || nonNullType.toUpperCase();
      if (types.includes("null")) {
        result.nullable = true;
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (unsupportedKeys.includes(key)) continue;
    // Skip "type" if we already handled the array case above
    if (key === "type" && result.type !== undefined) continue;

    if (key === "type" && typeof value === "string") {
      result[key] = typeMap[value] || value.toUpperCase();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = stripUnsupportedFields(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object"
          ? stripUnsupportedFields(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Convert our JSON schema format to Gemini's expected format
 */
function convertToGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  // Gemini uses a slightly different schema format
  // It doesn't need the wrapper object with "name"
  // Also strip fields that Gemini doesn't support (additionalProperties, etc.)
  return stripUnsupportedFields(schema.schema as Record<string, unknown>);
}

// ============================================
// TEXT GENERATION WITH AUDIO INPUT
// ============================================

/**
 * Generate text from audio input using Google Gemini API
 * Uses multimodal capabilities to process audio
 */
export async function generateTextWithAudio(
  options: AudioInputOptions & { model: string }
): Promise<TextGenerationResult> {
  const apiKey = getApiKey();
  const modelName = options.model.replace("google/", "");

  const contents = [];

  // Add system prompt as first message if provided
  if (options.systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: options.systemPrompt }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "I understand. I will follow these instructions." }],
    });
  }

  // Determine MIME type from format
  const mimeTypeMap: Record<string, string> = {
    wav: "audio/wav",
    webm: "audio/webm",
    mp3: "audio/mp3",
    mpeg: "audio/mpeg",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  const mimeType = mimeTypeMap[options.audioFormat.toLowerCase()] || `audio/${options.audioFormat}`;

  // Add user prompt with audio
  contents.push({
    role: "user",
    parts: [
      {
        inlineData: {
          mimeType,
          data: options.audioBase64,
        },
      },
      { text: options.prompt },
    ],
  });

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxTokens || 500,
    temperature: options.temperature ?? 0.7,
  };

  // Add JSON schema for structured output
  if (options.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = convertToGeminiSchema(options.jsonSchema);
  }

  const startTime = Date.now();

  const response = await fetch(
    `${GEMINI_API_URL}/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig,
      }),
    }
  );

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Extract content
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Extract usage
  const usageMetadata = result.usageMetadata || {};
  const usage: TokenUsage = {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: usageMetadata.candidatesTokenCount || 0,
    totalTokens: usageMetadata.totalTokenCount || 0,
  };

  return {
    content,
    usage,
    model: modelName,
    latencyMs,
  };
}

// ============================================
// IMAGE GENERATION
// ============================================

/**
 * Generate an image using Google Gemini API
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult | null> {
  const apiKey = getApiKey();
  const modelName = IMAGE_MODELS.GEMINI_IMAGE;

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: options.prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Gemini image generation error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    // Extract image data from response
    const parts = result.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const base64Data = part.inlineData.data;
        const binaryString = atob(base64Data);
        const rawImageBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          rawImageBytes[i] = binaryString.charCodeAt(i);
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
      }
    }

    console.error("No image data found in Google Gemini response");
    return null;
  } catch (error) {
    console.error("Google Gemini image generation failed:", error);
    return null;
  }
}

// ============================================
// TTS GENERATION
// ============================================

/**
 * Generate speech audio using Google Gemini TTS
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult | null> {
  const apiKey = getApiKey();
  const modelName = AUDIO_MODELS.GEMINI_TTS;
  const voice = options.voice || TTS_VOICE;

  // For short text (single words), add language context for correct pronunciation
  const isShortText = options.text.length <= 10 || !options.text.includes(" ");

  let promptText: string;
  if (isShortText) {
    const wordHints: Record<string, string> = {
      japanese: `Pronounce this Japanese word: ${options.text}`,
      english: `Pronounce this English word: ${options.text}`,
      french: `Pronounce this French word: ${options.text}`,
    };
    promptText = wordHints[options.language] || options.text;
  } else {
    const languageHints: Record<string, string> = {
      japanese: "Read this Japanese text clearly and naturally for language learners:",
      english: "Read this English text clearly and naturally for language learners:",
      french: "Read this French text clearly and naturally for language learners:",
    };
    const hint = languageHints[options.language] || languageHints.english;
    promptText = `${hint}\n\n${options.text}`;
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Gemini TTS error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    // Extract audio data from response
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData?.data) {
      console.error("No audio data in Google Gemini TTS response:", JSON.stringify(result));
      return null;
    }

    // Decode base64 audio (Gemini returns raw PCM 16-bit 24kHz)
    const binaryString = atob(audioData.data);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM to MP3 for browser playback and storage efficiency
    const mp3Bytes = convertPcmToMp3(pcmBytes, 24000, 1, 128);
    console.log(
      `Audio compressed: ${pcmBytes.length} bytes PCM -> ${mp3Bytes.length} bytes MP3 (${Math.round((1 - mp3Bytes.length / pcmBytes.length) * 100)}% savings)`
    );

    return {
      audioData: mp3Bytes,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Google Gemini TTS generation failed:", error);
    return null;
  }
}

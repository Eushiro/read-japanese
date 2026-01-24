"use node";

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { compressToWebp } from "../lib/imageCompression";
import { uploadAudio, uploadImage } from "../lib/storage";
import { languageNames } from "./core";

// ============================================
// GEMINI TTS CONFIGURATION (Generative Language API)
// ============================================

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

// Consistent voice for all languages
const TTS_VOICE = "Aoede";

/**
 * Generate audio for a sentence using Gemini 2.5 Flash TTS
 * Returns MP3 audio data
 */
export async function generateTTSAudio(
  text: string,
  language: string
): Promise<{ audioData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    return null;
  }

  const voice = TTS_VOICE;

  // For short text (single words), add language context for correct pronunciation
  // For longer text (sentences), add a pronunciation hint
  const isShortText = text.length <= 10 || !text.includes(" ");

  let promptText: string;
  if (isShortText) {
    // Add language context for single words
    const wordHints: Record<string, string> = {
      japanese: `Pronounce this Japanese word: ${text}`,
      english: `Pronounce this English word: ${text}`,
      french: `Pronounce this French word: ${text}`,
    };
    promptText = wordHints[language] || text;
  } else {
    // For sentences, add pronunciation hints
    const languageHints: Record<string, string> = {
      japanese: "Read this Japanese text clearly and naturally for language learners:",
      english: "Read this English text clearly and naturally for language learners:",
      french: "Read this French text clearly and naturally for language learners:",
    };
    const hint = languageHints[language] || languageHints.english;
    promptText = `${hint}\n\n${text}`;
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`,
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
              audioConfig: {
                audioEncoding: "MP3",
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini TTS error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    // Extract audio data from response
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData?.data) {
      console.error("No audio data in Gemini TTS response:", JSON.stringify(result));
      return null;
    }

    // Decode base64 MP3 audio
    const binaryString = atob(audioData.data);
    const audioBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i);
    }

    return {
      audioData: audioBytes,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

// ============================================
// IMAGE GENERATION (OpenRouter + Gemini)
// ============================================

/**
 * Generate an image for a flashcard using OpenRouter with Gemini
 */
export async function generateFlashcardImage(
  word: string,
  sentence: string,
  language: string
): Promise<{ imageData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }

  const languageName = languageNames[language] || "English";

  const prompt = `Generate an illustration that helps a language learner remember this ${languageName} vocabulary word: "${word}"

Context sentence: "${sentence}"

The image should:
- Be a clear, memorable visual representation of the word's meaning
- Use a simple, clean art style suitable for educational flashcards
- Avoid any text in the image
- Be colorful but not cluttered`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://sanlang.app",
        "X-Title": "SanLang",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
        // Square aspect ratio for flashcards
        image_generation_config: {
          aspect_ratio: "1:1",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Image generation error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log("Image generation response:", JSON.stringify(result, null, 2));

    // Extract raw image bytes from response
    let rawImageBytes: Uint8Array | null = null;

    // Check for images array in the response (OpenRouter format)
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
      console.error("No image data found in response");
      return null;
    }

    // Compress to WebP for ~70% storage savings
    const compressedBytes = await compressToWebp(rawImageBytes);
    console.log(
      `Image compressed: ${rawImageBytes.length} bytes -> ${compressedBytes.length} bytes (${Math.round((1 - compressedBytes.length / rawImageBytes.length) * 100)}% savings)`
    );

    return {
      imageData: compressedBytes,
      mimeType: "image/webp",
    };
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
}

// ============================================
// INTERNAL ACTION WRAPPERS
// ============================================

/**
 * Internal action wrapper for TTS audio generation
 */
export const generateTTSAudioAction = internalAction({
  args: {
    text: v.string(),
    language: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    const audioResult = await generateTTSAudio(args.text, args.language);

    if (!audioResult) {
      return { success: false };
    }

    // Upload audio to storage
    const audioUrl = await uploadAudio(new Uint8Array(audioResult.audioData), audioResult.mimeType);

    return { success: true, audioUrl };
  },
});

/**
 * Internal action wrapper for image generation
 */
export const generateFlashcardImageAction = internalAction({
  args: {
    word: v.string(),
    sentence: v.string(),
    language: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; imageUrl?: string }> => {
    const imageResult = await generateFlashcardImage(args.word, args.sentence, args.language);

    if (!imageResult) {
      return { success: false };
    }

    // Upload image to storage
    const imageUrl = await uploadImage(new Uint8Array(imageResult.imageData), imageResult.mimeType);

    return { success: true, imageUrl };
  },
});

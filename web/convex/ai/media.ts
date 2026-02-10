"use node";

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { convertPcmToMp3 } from "../lib/audioCompression";
import { AUDIO_MODELS } from "../lib/models";
import { uploadSentenceAudio, uploadWordAudio, uploadWordImage } from "../lib/storage";
import { type ContentLanguage, languageValidator } from "../schema";
import { generateImage as generateImageNew } from "./models";

// Language name mappings
const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

// ============================================
// GEMINI TTS CONFIGURATION (Generative Language API)
// ============================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

// Consistent voice for all languages
const TTS_VOICE = "Aoede";

// Dialogue voices for multi-speaker TTS
const DIALOGUE_VOICES = {
  speaker1: "Aoede", // Breezy, default voice
  speaker2: "Charon", // Contrasting firm voice
} as const;

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
      `${GEMINI_API_URL}/models/${AUDIO_MODELS.GEMINI_TTS}:generateContent?key=${apiKey}`,
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

    // Decode base64 audio (Gemini returns raw PCM 16-bit 24kHz)
    const binaryString = atob(audioData.data);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM to MP3 for browser playback and storage efficiency
    // Gemini TTS outputs: 24kHz sample rate, 16-bit, mono
    const mp3Bytes = convertPcmToMp3(pcmBytes, 24000, 1, 128);
    console.log(
      `Audio compressed: ${pcmBytes.length} bytes PCM -> ${mp3Bytes.length} bytes MP3 (${Math.round((1 - mp3Bytes.length / pcmBytes.length) * 100)}% savings)`
    );

    return {
      audioData: mp3Bytes,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

/**
 * Generate multi-speaker dialogue audio using Gemini 2.5 Flash TTS.
 * Maps unique speakers from dialogueTurns to Speaker1/Speaker2 voices.
 * Returns MP3 audio data.
 */
export async function generateMultiSpeakerTTSAudio(
  dialogueTurns: Array<{ speaker: string; line: string }>,
  language: string
): Promise<{ audioData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    return null;
  }

  // Map unique speakers to Speaker1/Speaker2
  const uniqueSpeakers = [...new Set(dialogueTurns.map((t) => t.speaker))];
  const speakerMap = new Map<string, string>();
  uniqueSpeakers.forEach((s, i) => {
    speakerMap.set(s, i === 0 ? "Speaker1" : "Speaker2");
  });

  // Format prompt with speaker labels
  const languageHints: Record<string, string> = {
    japanese: "Read this Japanese dialogue clearly and naturally for language learners:",
    english: "Read this English dialogue clearly and naturally for language learners:",
    french: "Read this French dialogue clearly and naturally for language learners:",
  };
  const hint = languageHints[language] || languageHints.english;

  const dialogueLines = dialogueTurns
    .map((t) => `${speakerMap.get(t.speaker)}: ${t.line}`)
    .join("\n");

  const promptText = `${hint}\n\n${dialogueLines}`;

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${AUDIO_MODELS.GEMINI_TTS}:generateContent?key=${apiKey}`,
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
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: "Speaker1",
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: DIALOGUE_VOICES.speaker1 },
                    },
                  },
                  {
                    speaker: "Speaker2",
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: DIALOGUE_VOICES.speaker2 },
                    },
                  },
                ],
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini multi-speaker TTS error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData?.data) {
      console.error("No audio data in Gemini multi-speaker TTS response:", JSON.stringify(result));
      return null;
    }

    // Decode base64 audio (Gemini returns raw PCM 16-bit 24kHz)
    const binaryString = atob(audioData.data);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM to MP3
    const mp3Bytes = convertPcmToMp3(pcmBytes, 24000, 1, 128);
    console.log(
      `Multi-speaker audio compressed: ${pcmBytes.length} bytes PCM -> ${mp3Bytes.length} bytes MP3 (${Math.round((1 - mp3Bytes.length / pcmBytes.length) * 100)}% savings)`
    );

    return {
      audioData: mp3Bytes,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Multi-speaker TTS generation failed:", error);
    return null;
  }
}

// ============================================
// IMAGE GENERATION (via new provider abstraction)
// ============================================

/**
 * Generate an image for a flashcard
 * Now uses the unified provider abstraction (routes to Google direct API)
 */
export async function generateFlashcardImage(
  word: string,
  sentence: string,
  language: string
): Promise<{ imageData: Uint8Array; mimeType: string } | null> {
  const languageName = languageNames[language] || "English";

  const prompt = `Generate an illustration that helps a language learner remember this ${languageName} vocabulary word: "${word}"

Context sentence: "${sentence}"

The image should:
- Be a clear, memorable visual representation of the word's meaning
- Use a simple, clean art style suitable for educational flashcards
- Avoid any text in the image
- Be colorful but not cluttered`;

  // Use the unified provider abstraction
  return generateImageNew({ prompt, aspectRatio: "1:1" });
}

// ============================================
// INTERNAL ACTION WRAPPERS
// ============================================

/**
 * Internal action wrapper for TTS audio generation
 *
 * Word-centric storage organization:
 * - word: The vocabulary word this audio is for
 * - audioType: "word" for word pronunciation, "sentence" for sentence audio
 * - sentenceId: Required when audioType is "sentence"
 */
export const generateTTSAudioAction = internalAction({
  args: {
    text: v.string(),
    language: languageValidator,
    // Word context for organized storage (optional for backwards compatibility)
    word: v.optional(v.string()),
    audioType: v.optional(v.union(v.literal("word"), v.literal("sentence"))),
    sentenceId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    const audioResult = await generateTTSAudio(args.text, args.language);

    if (!audioResult) {
      return { success: false };
    }

    const language = args.language as ContentLanguage;
    let audioUrl: string;

    // Use word-centric storage
    if (args.word && args.audioType === "word") {
      audioUrl = await uploadWordAudio(
        new Uint8Array(audioResult.audioData),
        args.word,
        language,
        audioResult.mimeType
      );
    } else if (args.word && args.audioType === "sentence" && args.sentenceId) {
      audioUrl = await uploadSentenceAudio(
        new Uint8Array(audioResult.audioData),
        args.word,
        language,
        args.sentenceId,
        audioResult.mimeType
      );
    } else if (args.word && args.audioType === "sentence") {
      // Sentence audio without sentenceId - generate a random ID
      const randomId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      audioUrl = await uploadSentenceAudio(
        new Uint8Array(audioResult.audioData),
        args.word,
        language,
        randomId,
        audioResult.mimeType
      );
    } else {
      // No word context - use word audio path with text as the word
      audioUrl = await uploadWordAudio(
        new Uint8Array(audioResult.audioData),
        args.text,
        language,
        audioResult.mimeType
      );
    }

    return { success: true, audioUrl };
  },
});

/**
 * Internal action wrapper for multi-speaker dialogue TTS audio generation.
 * Generates audio with two distinct voices for dialogue content.
 */
export const generateMultiSpeakerTTSAudioAction = internalAction({
  args: {
    dialogueTurns: v.array(v.object({ speaker: v.string(), line: v.string() })),
    language: languageValidator,
    word: v.optional(v.string()),
    sentenceId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    const audioResult = await generateMultiSpeakerTTSAudio(args.dialogueTurns, args.language);

    if (!audioResult) {
      return { success: false };
    }

    const language = args.language as ContentLanguage;
    const word = args.word ?? "dialogue";
    const sentenceId =
      args.sentenceId ?? Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    const audioUrl = await uploadSentenceAudio(
      new Uint8Array(audioResult.audioData),
      word,
      language,
      sentenceId,
      audioResult.mimeType
    );

    return { success: true, audioUrl };
  },
});

/**
 * Internal action wrapper for image generation
 *
 * Word-centric storage organization:
 * - imageId: Unique identifier for this image (e.g., database ID)
 *   If not provided, a random ID is generated.
 */
export const generateFlashcardImageAction = internalAction({
  args: {
    word: v.string(),
    sentence: v.string(),
    language: languageValidator,
    // Optional image ID for organized storage (random ID generated if not provided)
    imageId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; imageUrl?: string }> => {
    const imageResult = await generateFlashcardImage(args.word, args.sentence, args.language);

    if (!imageResult) {
      return { success: false };
    }

    const language = args.language as ContentLanguage;
    // Use provided imageId or generate a random one
    const imageId =
      args.imageId || Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    const imageUrl = await uploadWordImage(
      new Uint8Array(imageResult.imageData),
      args.word,
      language,
      imageId,
      imageResult.mimeType
    );

    return { success: true, imageUrl };
  },
});

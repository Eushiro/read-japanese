"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// GEMINI TTS CONFIGURATION
// ============================================

const GEMINI_TTS_MODEL = "gemini-2.0-flash-preview-tts";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

// Voices optimized for language learning narration
const VOICES_BY_LANGUAGE: Record<string, string[]> = {
  japanese: ["Aoede", "Leda", "Alnilam"],
  english: ["Puck", "Charon", "Kore"],
  french: ["Aoede", "Leda", "Puck"],
};

function selectVoice(language: string): string {
  const voices = VOICES_BY_LANGUAGE[language] || VOICES_BY_LANGUAGE.english;
  return voices[Math.floor(Math.random() * voices.length)];
}

/**
 * Generate audio for a sentence using Gemini TTS
 * Returns base64 encoded PCM audio data
 */
async function generateTTSAudio(
  text: string,
  language: string,
  voice?: string
): Promise<{ audioData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    return null;
  }

  const selectedVoice = voice || selectVoice(language);

  // Prepare narration prompt for language learners
  const narrationPrompt = `Read aloud clearly and slowly for language learners:\n\n${text}`;

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
              parts: [{ text: narrationPrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
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
      console.error("No audio data in Gemini response");
      return null;
    }

    // Decode base64 audio
    const binaryString = atob(audioData.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      audioData: bytes,
      mimeType: audioData.mimeType || "audio/wav",
    };
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

// ============================================
// OPENROUTER CONFIGURATION
// ============================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string = "qwen/qwen3-next-80b-a3b-instruct:free"
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://sanlang.app",
      "X-Title": "SanLang",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "";
}

// ============================================
// SENTENCE GENERATION
// ============================================

interface GeneratedSentence {
  sentence: string;
  translation: string;
}

const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

// Helper function to generate sentence (not a Convex action)
async function generateSentenceHelper(args: {
  word: string;
  reading?: string;
  definitions: string[];
  language: "japanese" | "english" | "french";
  examLevel?: string;
}): Promise<GeneratedSentence> {
  const languageName = languageNames[args.language];
  const definitionList = args.definitions.join(", ");
  const readingInfo = args.reading ? ` (reading: ${args.reading})` : "";
  const levelInfo = args.examLevel ? ` at ${args.examLevel} level` : "";

  const systemPrompt = `You are a language learning assistant that creates natural, contextual example sentences for vocabulary study. Your sentences should:
1. Be natural and commonly used in everyday situations
2. Clearly demonstrate the meaning of the target word
3. Be appropriate for the learner's level
4. Be memorable and interesting

Respond ONLY with valid JSON in this exact format:
{
  "sentence": "the example sentence in ${languageName}",
  "translation": "the English translation"
}`;

  const prompt = `Create an example sentence for the ${languageName} word "${args.word}"${readingInfo}${levelInfo}.

The word means: ${definitionList}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners${levelInfo}.`;

  const response = await callOpenRouter(prompt, systemPrompt);

  try {
    // Parse the JSON response
    const parsed = JSON.parse(response) as GeneratedSentence;
    return {
      sentence: parsed.sentence,
      translation: parsed.translation,
    };
  } catch {
    // If parsing fails, try to extract from the response
    console.error("Failed to parse AI response:", response);
    throw new Error("Failed to generate sentence: Invalid AI response format");
  }
}

// Generate an example sentence for a vocabulary word (public action)
export const generateSentence = action({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    examLevel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GeneratedSentence> => {
    return generateSentenceHelper({
      word: args.word,
      reading: args.reading ?? undefined,
      definitions: args.definitions,
      language: args.language,
      examLevel: args.examLevel ?? undefined,
    });
  },
});

// Internal action for scheduled jobs to call
export const generateSentenceInternal = internalAction({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    examLevel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GeneratedSentence> => {
    return generateSentenceHelper({
      word: args.word,
      reading: args.reading ?? undefined,
      definitions: args.definitions,
      language: args.language,
      examLevel: args.examLevel ?? undefined,
    });
  },
});

// Generate a sentence and create/update a flashcard
export const generateFlashcard = action({
  args: {
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; flashcardId?: string }> => {
    // Get the vocabulary item
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: args.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary item not found");
    }

    // Generate the sentence using the helper function
    const generated = await generateSentenceHelper({
      word: vocab.word,
      reading: vocab.reading ?? undefined,
      definitions: vocab.definitions,
      language: vocab.language,
      examLevel: vocab.examLevel ?? undefined,
    });

    // Create or update the flashcard
    const flashcardId = await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
      vocabularyId: args.vocabularyId,
      userId: vocab.userId,
      sentence: generated.sentence,
      sentenceTranslation: generated.translation,
    });

    return { success: true, flashcardId };
  },
});

// ============================================
// BULK FLASHCARD GENERATION
// ============================================

// Generate flashcards for multiple vocabulary items
export const generateFlashcardsBulk = action({
  args: {
    vocabularyIds: v.array(v.id("vocabulary")),
  },
  handler: async (ctx, args): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (const vocabularyId of args.vocabularyIds) {
      try {
        // Get the vocabulary item
        const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
          vocabularyId,
        });

        if (!vocab) {
          failed++;
          continue;
        }

        // Check if flashcard already exists
        const existingFlashcard = await ctx.runQuery(
          internal.aiHelpers.getFlashcardByVocabulary,
          { vocabularyId }
        );

        if (existingFlashcard) {
          // Skip if flashcard already exists
          success++;
          continue;
        }

        // Generate the sentence
        const generated = await generateSentenceHelper({
          word: vocab.word,
          reading: vocab.reading ?? undefined,
          definitions: vocab.definitions,
          language: vocab.language,
          examLevel: vocab.examLevel ?? undefined,
        });

        // Create the flashcard
        await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
          vocabularyId,
          userId: vocab.userId,
          sentence: generated.sentence,
          sentenceTranslation: generated.translation,
        });

        success++;
      } catch (error) {
        console.error(`Failed to generate flashcard for ${vocabularyId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  },
});

// ============================================
// SENTENCE VERIFICATION (for user output practice)
// ============================================

interface VerificationResult {
  isCorrect: boolean;
  grammarScore: number;
  usageScore: number;
  naturalnessScore: number;
  overallScore: number;
  difficultyLevel: string; // "beginner" | "intermediate" | "advanced"
  difficultyExplanation: string; // Why this difficulty level
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  feedback: string;
  improvedSentence: string;
}

export const verifySentence = action({
  args: {
    sentence: v.string(),
    targetWord: v.string(),
    wordDefinitions: v.array(v.string()),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    const languageNames: Record<string, string> = {
      japanese: "Japanese",
      english: "English",
      french: "French",
    };

    const languageName = languageNames[args.language];
    const definitionList = args.wordDefinitions.join(", ");

    const systemPrompt = `You are a ${languageName} language teacher evaluating a student's sentence. Be encouraging but accurate in your feedback.

Respond ONLY with valid JSON in this exact format:
{
  "isCorrect": boolean (true if the sentence is grammatically correct and uses the word properly),
  "grammarScore": number (0-100),
  "usageScore": number (0-100, how well the target word is used),
  "naturalnessScore": number (0-100, how natural the sentence sounds to a native speaker),
  "overallScore": number (0-100),
  "difficultyLevel": "beginner" | "intermediate" | "advanced",
  "difficultyExplanation": "Brief explanation of why this difficulty level (e.g., grammar structures used, vocabulary complexity, sentence length)",
  "corrections": [
    {
      "original": "the part that needs correction",
      "corrected": "the corrected version",
      "explanation": "why this correction is needed"
    }
  ],
  "feedback": "overall feedback for the student",
  "improvedSentence": "ALWAYS provide an enhanced version - if the original is good, show a more sophisticated, varied, or native-like alternative that teaches something new"
}

DIFFICULTY LEVELS:
- "beginner": Simple grammar, basic vocabulary, short sentences, common patterns
- "intermediate": Compound sentences, varied vocabulary, some idioms, moderate complexity
- "advanced": Complex grammar, sophisticated vocabulary, nuanced expressions, native-like constructions

IMPORTANT: The "improvedSentence" field must ALWAYS contain a different sentence from the original. Even if the student's sentence is perfect, provide an alternative that:
- Uses more advanced vocabulary or grammar structures
- Shows a more idiomatic or native-like expression
- Demonstrates a different but valid way to express the same idea
This helps learners see multiple ways to express themselves and expands their language skills.`;

    const prompt = `Please evaluate this ${languageName} sentence written by a language learner:

Sentence: "${args.sentence}"

The student is trying to use the word "${args.targetWord}" which means: ${definitionList}

Evaluate the sentence for:
1. Grammar correctness
2. Proper usage of the target word
3. Natural expression

Provide detailed feedback and corrections if needed.`;

    const response = await callOpenRouter(prompt, systemPrompt);

    try {
      const parsed = JSON.parse(response) as VerificationResult;
      return parsed;
    } catch {
      console.error("Failed to parse verification response:", response);
      // Return a default response on parse failure
      return {
        isCorrect: false,
        grammarScore: 0,
        usageScore: 0,
        naturalnessScore: 0,
        overallScore: 0,
        difficultyLevel: "beginner",
        difficultyExplanation: "Unable to assess difficulty.",
        corrections: [],
        feedback: "Unable to verify sentence. Please try again.",
        improvedSentence: args.sentence,
      };
    }
  },
});

// ============================================
// AUDIO GENERATION (TTS)
// ============================================

// Generate audio for a flashcard sentence
export const generateFlashcardAudio = action({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    // Get the flashcard
    const flashcard = await ctx.runQuery(internal.aiHelpers.getFlashcard, {
      flashcardId: args.flashcardId,
    });

    if (!flashcard) {
      throw new Error("Flashcard not found");
    }

    // Get vocabulary for language info
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: flashcard.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Generate audio using Gemini TTS
    const audioResult = await generateTTSAudio(
      flashcard.sentence,
      vocab.language
    );

    if (!audioResult) {
      console.error("Failed to generate audio");
      return { success: false };
    }

    // Store audio in Convex file storage
    const blob = new Blob([audioResult.audioData], { type: audioResult.mimeType });
    const storageId = await ctx.storage.store(blob);

    // Get the public URL
    const audioUrl = await ctx.storage.getUrl(storageId);

    if (!audioUrl) {
      console.error("Failed to get audio URL");
      return { success: false };
    }

    // Update flashcard with audio URL
    await ctx.runMutation(internal.aiHelpers.updateFlashcardAudio, {
      flashcardId: args.flashcardId,
      audioUrl,
    });

    return { success: true, audioUrl };
  },
});

// Generate flashcard with audio
export const generateFlashcardWithAudio = action({
  args: {
    vocabularyId: v.id("vocabulary"),
    includeAudio: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; flashcardId?: string; audioUrl?: string }> => {
    // Get the vocabulary item
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: args.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary item not found");
    }

    // Generate the sentence using the helper function
    const generated = await generateSentenceHelper({
      word: vocab.word,
      reading: vocab.reading ?? undefined,
      definitions: vocab.definitions,
      language: vocab.language,
      examLevel: vocab.examLevel ?? undefined,
    });

    // Create or update the flashcard
    const flashcardId = await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
      vocabularyId: args.vocabularyId,
      userId: vocab.userId,
      sentence: generated.sentence,
      sentenceTranslation: generated.translation,
    });

    let audioUrl: string | undefined;

    // Generate audio if requested
    if (args.includeAudio !== false) {
      try {
        const audioResult = await generateTTSAudio(
          generated.sentence,
          vocab.language
        );

        if (audioResult) {
          // Store audio in Convex file storage
          const blob = new Blob([audioResult.audioData], { type: audioResult.mimeType });
          const storageId = await ctx.storage.store(blob);
          audioUrl = await ctx.storage.getUrl(storageId) ?? undefined;

          if (audioUrl) {
            await ctx.runMutation(internal.aiHelpers.updateFlashcardAudio, {
              flashcardId: flashcardId as any,
              audioUrl,
            });
          }
        }
      } catch (error) {
        console.error("Audio generation failed:", error);
        // Continue without audio - flashcard is still created
      }
    }

    return { success: true, flashcardId, audioUrl };
  },
});

"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import {
  buildDistractorRules,
  buildLanguageMixingDirective,
  buildStemVarietyRules,
  type ContentLanguage,
  getUILanguageName,
  type UILanguage,
} from "../lib/promptHelpers";
import { generateTTSAudio } from "./media";
import {
  cleanJsonResponse,
  evaluateAudioInput,
  generateAndParse,
  type JsonSchema,
  parseJson,
  TEXT_MODEL_CHAIN,
} from "./models";

// Language name mappings
const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

// UI language names for feedback
const uiLanguageNames: Record<string, string> = {
  en: "English",
  ja: "日本語",
  fr: "français",
  zh: "中文",
};

// ============================================
// PLACEMENT TEST QUESTION GENERATION
// ============================================

interface PlacementQuestion {
  questionId: string;
  level: string;
  type: "vocabulary" | "grammar" | "reading" | "listening";
  question: string;
  questionTranslation: string;
  options: string[];
  correctAnswer: string;
  difficulty: number;
  audioUrl?: string; // For listening questions
  audioTranscript?: string; // Transcript of the audio
  isWarmup?: boolean; // Flag for warm-up questions
  modelUsed?: string; // AI model that generated the question
}

// Map difficulty (-3 to +3) to level names
export function difficultyToLevel(difficulty: number, language: string): string {
  if (language === "japanese") {
    if (difficulty < -1.5) return "N5";
    if (difficulty < -0.5) return "N4";
    if (difficulty < 0.5) return "N3";
    if (difficulty < 1.5) return "N2";
    return "N1";
  } else {
    // CEFR for English/French
    if (difficulty < -2.0) return "A1";
    if (difficulty < -1.0) return "A2";
    if (difficulty < 0.0) return "B1";
    if (difficulty < 1.0) return "B2";
    if (difficulty < 2.0) return "C1";
    return "C2";
  }
}

/**
 * Generate a placement test question at a specific difficulty level
 */
export const generatePlacementQuestion = action({
  args: {
    testId: v.id("placementTests"),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    targetDifficulty: v.number(), // -3 to +3 scale
    questionType: v.union(
      v.literal("vocabulary"),
      v.literal("grammar"),
      v.literal("reading"),
      v.literal("listening")
    ),
    previousQuestions: v.optional(v.array(v.string())), // To avoid duplicates
    isWarmup: v.optional(v.boolean()), // Flag for warm-up questions
    uiLanguage: v.optional(
      v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh"))
    ),
  },
  handler: async (ctx, args): Promise<PlacementQuestion> => {
    const languageName = languageNames[args.language];
    const level = difficultyToLevel(args.targetDifficulty, args.language);
    const uiLang = (args.uiLanguage ?? "en") as UILanguage;
    const uiLanguageName = getUILanguageName(uiLang);

    const previousQuestionsNote = args.previousQuestions?.length
      ? `\n\nIMPORTANT: Do NOT generate questions similar to these (already asked):\n${args.previousQuestions.slice(-5).join("\n")}`
      : "";

    // Language mixing directive based on current difficulty
    const langMixing = buildLanguageMixingDirective(
      uiLang,
      args.targetDifficulty,
      args.language as ContentLanguage
    );

    // Distractor and stem variety rules
    const distractorRules = buildDistractorRules(args.language as ContentLanguage, level);
    const stemVariety = buildStemVarietyRules();

    const systemPrompt = `You are a ${languageName} language proficiency test creator. Generate a ${args.questionType} question appropriate for ${level} level learners.

The question should test ${args.questionType} at ${level} level difficulty.

${langMixing}

${
  args.questionType === "vocabulary"
    ? `
For VOCABULARY questions:
- Test recognition/meaning of words at ${level} level
- Use words that are commonly tested at this level
- Include context clues when appropriate`
    : ""
}

${
  args.questionType === "grammar"
    ? `
For GRAMMAR questions:
- Test grammar patterns appropriate for ${level} level
- Use conjugations, particles, or sentence structures at this level
- Provide clear context for the grammar point`
    : ""
}

${
  args.questionType === "reading"
    ? `
For READING questions:
- Provide a short passage (2-3 sentences) at ${level} level
- Ask a comprehension question about the passage
- Test understanding of main ideas or details`
    : ""
}

${
  args.questionType === "listening"
    ? `
For LISTENING questions:
- Create a short passage (1-2 sentences) that would be read aloud at ${level} level
- The passage should be natural spoken ${languageName}
- Include the audioTranscript field with the exact text to be read
- Ask a comprehension question about what was said`
    : ""
}

${distractorRules}

${stemVariety}

Respond ONLY with valid JSON in this exact format:
{
  "question": "the question text",
  "questionTranslation": "translation in ${uiLanguageName}",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": "the exact text of the correct option",
  "explanation": "brief explanation of why this is the correct answer"
}

IMPORTANT:
- The correct answer must EXACTLY match one of the options
- Questions should clearly test ${level} level knowledge${previousQuestionsNote}`;

    const prompt = `Generate a ${args.questionType} question for a ${languageName} placement test at ${level} level (difficulty: ${args.targetDifficulty.toFixed(1)}).`;

    const placementSchema: JsonSchema = {
      name: "placement_question",
      schema: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question text" },
          questionTranslation: {
            type: "string",
            description: "Translation of the question in the user's UI language",
          },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correctAnswer: { type: "string", description: "Must exactly match one of the options" },
          explanation: { type: "string", description: "Brief explanation of the correct answer" },
          audioTranscript: {
            type: "string",
            description: "For listening questions: the text to be read aloud",
          },
        },
        required: ["question", "questionTranslation", "options", "correctAnswer"],
        additionalProperties: false,
      },
    };

    // Helper to parse and fix response
    const parseResponse = (response: string) => {
      if (!response || response.trim() === "") {
        throw new Error("Empty response from AI");
      }

      const parsed = parseJson<{
        question: string;
        questionTranslation: string;
        options: string[];
        correctAnswer: string;
        audioTranscript?: string;
      }>(response);

      // Fix correctAnswer if not in options
      if (!parsed.options.includes(parsed.correctAnswer)) {
        const match = parsed.options.find(
          (o) =>
            o.toLowerCase().includes(parsed.correctAnswer.toLowerCase()) ||
            parsed.correctAnswer.toLowerCase().includes(o.toLowerCase())
        );
        if (match) {
          parsed.correctAnswer = match;
        } else {
          parsed.options[0] = parsed.correctAnswer;
        }
      }

      return parsed;
    };

    const result = await generateAndParse({
      prompt,
      systemPrompt,
      maxTokens: 600,
      jsonSchema: placementSchema,
      models: TEXT_MODEL_CHAIN,
      parse: parseResponse,
      validate: (parsed) => {
        if (!parsed.question || !parsed.options || parsed.options.length !== 4) {
          return "Invalid question format";
        }
        return null;
      },
    });
    const parsed = result.result;

    // Generate audio for listening questions
    let audioUrl: string | undefined;
    let audioTranscript: string | undefined;

    if (args.questionType === "listening" && parsed.audioTranscript) {
      audioTranscript = parsed.audioTranscript;
      try {
        const audioResult = await generateTTSAudio(parsed.audioTranscript, args.language);
        if (audioResult) {
          // Convert to base64 data URL for immediate use
          let binaryString = "";
          for (let i = 0; i < audioResult.audioData.length; i++) {
            binaryString += String.fromCharCode(audioResult.audioData[i]);
          }
          audioUrl = `data:${audioResult.mimeType};base64,${btoa(binaryString)}`;
        }
      } catch (error) {
        console.error("Failed to generate audio for listening question:", error);
      }
    }

    const questionData: PlacementQuestion = {
      questionId: `pq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      type: args.questionType,
      question: parsed.question,
      audioUrl,
      audioTranscript,
      isWarmup: args.isWarmup,
      questionTranslation: parsed.questionTranslation,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      difficulty: args.targetDifficulty,
      modelUsed: result.usage.model,
    };

    // Add the question to the test
    await ctx.runMutation(internal.placementTest.addQuestionFromAI, {
      testId: args.testId,
      question: questionData,
    });

    return questionData;
  },
});

/**
 * Calculate the next optimal difficulty for CAT
 * Now supports adaptive type selection based on per-skill uncertainty
 * and warm-up questions for the first 2 questions
 */
export const getNextQuestionDifficulty = action({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    targetDifficulty: number;
    suggestedType: "vocabulary" | "grammar" | "reading" | "listening";
    shouldContinue: boolean;
    reason?: string;
    isWarmup?: boolean;
  }> => {
    // Get the current test state
    const test = await ctx.runQuery(internal.aiHelpers.getPlacementTest, {
      testId: args.testId,
    });

    if (!test || test.status !== "in_progress") {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Test not found or not in progress",
      };
    }

    // Warm-up phase: first 2 questions are easy
    const WARMUP_QUESTIONS = 2;
    const WARMUP_DIFFICULTY = -2.5; // Very easy (low N5 / A1)

    if (test.questionsAnswered < WARMUP_QUESTIONS) {
      // Fixed easy difficulty, cycle through vocabulary and grammar
      const warmupTypes: Array<"vocabulary" | "grammar"> = ["vocabulary", "grammar"];
      return {
        targetDifficulty: WARMUP_DIFFICULTY,
        suggestedType: warmupTypes[test.questionsAnswered % 2],
        shouldContinue: true,
        isWarmup: true,
      };
    }

    // Check stopping conditions
    const MAX_QUESTIONS = 20;
    const MIN_QUESTIONS = 8;
    const SE_THRESHOLD = 0.4; // Standard error threshold for confidence

    if (test.questionsAnswered >= MAX_QUESTIONS) {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Maximum questions reached",
      };
    }

    if (test.questionsAnswered >= MIN_QUESTIONS && test.abilityStandardError < SE_THRESHOLD) {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Sufficient confidence reached",
      };
    }

    // Calculate optimal difficulty based on current ability
    // Normal CAT behavior: target slightly above current ability
    const targetDifficulty = test.currentAbilityEstimate + 0.3 + (Math.random() * 0.4 - 0.2);
    const clampedDifficulty = Math.max(-3, Math.min(3, targetDifficulty));

    // Adaptive type selection based on per-skill uncertainty
    // Select the skill with highest standard error (most uncertain)
    let suggestedType: "vocabulary" | "grammar" | "reading" | "listening";

    const skillAbilities = test.skillAbilities as
      | Record<string, { estimate: number; se: number }>
      | undefined;
    if (skillAbilities && Object.keys(skillAbilities).length >= 2) {
      // Find skill with highest SE (most uncertain)
      const skills = Object.entries(skillAbilities) as Array<
        [string, { estimate: number; se: number }]
      >;
      skills.sort((a, b) => b[1].se - a[1].se);
      const mostUncertain = skills[0][0] as "vocabulary" | "grammar" | "reading" | "listening";
      suggestedType = mostUncertain;
    } else {
      // Fallback to cycle through question types including listening
      const typeCycle: Array<"vocabulary" | "grammar" | "reading" | "listening"> = [
        "vocabulary",
        "grammar",
        "reading",
        "listening",
        "vocabulary",
        "grammar",
      ];
      suggestedType = typeCycle[test.questionsAnswered % typeCycle.length];
    }

    return {
      targetDifficulty: clampedDifficulty,
      suggestedType,
      shouldContinue: true,
    };
  },
});

// ============================================
// SHADOWING PRACTICE (Audio-to-Audio Evaluation)
// ============================================

interface ShadowingFeedback {
  accuracyScore: number; // 0-100
  feedbackText: string;
  feedbackAudioBase64?: string;
}

/**
 * Evaluate a user's shadowing attempt using gpt-audio-mini
 * Takes the target sentence and user's recorded audio, returns spoken + text feedback
 */
export const evaluateShadowing = action({
  args: {
    targetText: v.string(),
    targetLanguage: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userAudioBase64: v.string(), // Base64 encoded audio (webm or wav)
    feedbackLanguage: v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh")),
  },
  handler: async (ctx, args): Promise<ShadowingFeedback> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Spend credits before evaluation (3 credits for shadowing)
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: identity.subject,
      action: "shadowing",
      metadata: { targetText: args.targetText.substring(0, 50) },
    });

    const languageName = languageNames[args.targetLanguage];
    const feedbackLang = args.feedbackLanguage;
    const feedbackLanguageName = uiLanguageNames[feedbackLang];

    // System prompt for the audio model
    const systemPrompt = `You are an experienced ${languageName} pronunciation coach providing detailed, constructive feedback. The student is serious about improving and needs honest, specific guidance.

CRITICAL: Base your evaluation ONLY on what you actually hear in the audio recording.
- If you hear silence, no speech, or only background noise: accuracyScore = 0, and explain that no speech was detected
- If you can only hear partial or unclear speech: score appropriately low and explain what was unclear
- Do NOT assume or guess what the user might have said based on the target text - evaluate strictly what you hear

IMPORTANT: Provide ALL feedback and explanations in ${feedbackLanguageName}. Do NOT respond in English unless the feedback language is English.

The student is trying to repeat: "${args.targetText}"

Listen carefully and evaluate:
1. **Accuracy** (0-100): Be critical but fair. 90+ = near-native, 70-89 = good with minor issues, 50-69 = understandable but needs work, <50 = significant issues, 0 = no speech detected
2. **Specific issues**: Identify EXACTLY which sounds, words, or syllables need work
3. **Actionable advice**: Give concrete tips on mouth position, tongue placement, or practice techniques

Common issues to listen for:
- Vowel length (long vs short)
- Pitch accent and intonation patterns
- Consonant clarity
- Word boundaries and linking
- Rhythm and timing
- Missing or added sounds`;

    // JSON schema for structured output
    const shadowingSchema = {
      type: "json_schema",
      json_schema: {
        name: "shadowing_feedback",
        strict: true,
        schema: {
          type: "object",
          properties: {
            accuracyScore: {
              type: "number",
              description:
                "Pronunciation accuracy score from 0-100. 0 = no speech detected/silence, 90+ = near-native, 70-89 = good with minor issues, 50-69 = understandable but needs work, <50 = significant issues",
            },
            feedbackText: {
              type: "string",
              description: `Detailed feedback in ${feedbackLanguageName}: what was good, what needs work, and specific tips to improve. Be thorough, 2-4 sentences.`,
            },
            spokenFeedback: {
              type: "string",
              description: `Encouraging but specific feedback in ${feedbackLanguageName}, 2-3 sentences. Mention one thing done well and one thing to focus on.`,
            },
          },
          required: ["accuracyScore", "feedbackText", "spokenFeedback"],
          additionalProperties: false,
        },
      },
    };

    try {
      // Use the centralized audio evaluation function
      const response = await evaluateAudioInput({
        prompt: "Here is my attempt at saying the sentence. Please evaluate my pronunciation.",
        systemPrompt,
        audioBase64: args.userAudioBase64,
        audioFormat: "wav",
        jsonSchema: {
          name: "shadowing_feedback",
          schema: shadowingSchema.json_schema.schema,
        },
      });

      console.log("Shadowing evaluation response:", response.content);

      // Parse structured output
      let parsed;
      try {
        parsed = JSON.parse(cleanJsonResponse(response.content));
      } catch {
        console.error("Failed to parse shadowing feedback JSON:", response.content);
        throw new Error("Failed to parse AI response");
      }

      // Validate required fields - don't fall back to defaults
      if (typeof parsed.accuracyScore !== "number") {
        console.error("Missing accuracyScore in response:", parsed);
        throw new Error("Invalid AI response: missing accuracy score");
      }
      if (typeof parsed.feedbackText !== "string" || !parsed.feedbackText) {
        console.error("Missing feedbackText in response:", parsed);
        throw new Error("Invalid AI response: missing feedback text");
      }

      const accuracyScore = parsed.accuracyScore;
      const feedbackText = parsed.feedbackText;
      const spokenFeedback = parsed.spokenFeedback ?? "";

      // Generate audio feedback using Gemini TTS
      let feedbackAudioBase64: string | undefined;
      if (spokenFeedback) {
        try {
          const audioResult = await generateTTSAudio(spokenFeedback, args.targetLanguage);
          if (audioResult) {
            // Convert Uint8Array to base64
            let binaryString = "";
            for (let i = 0; i < audioResult.audioData.length; i++) {
              binaryString += String.fromCharCode(audioResult.audioData[i]);
            }
            feedbackAudioBase64 = btoa(binaryString);
          }
        } catch (ttsError) {
          console.error("TTS generation failed:", ttsError);
        }
      }

      return {
        accuracyScore,
        feedbackText,
        feedbackAudioBase64,
      };
    } catch (error) {
      console.error("Shadowing evaluation failed:", error);
      // Return a graceful fallback
      return {
        accuracyScore: 0,
        feedbackText: "Unable to evaluate your recording. Please try again.",
      };
    }
  },
});

// ============================================
// EXAM ANSWER GRADING
// ============================================

interface ExamGradingResult {
  score: number; // 0-100
  isCorrect: boolean; // score >= 70
  feedback: string;
  detailedFeedback: {
    strengths: string[];
    improvements: string[];
    grammarErrors: string[];
  };
  suggestedAnswer: string;
}

/**
 * Grade an exam answer using AI
 * Supports multiple choice (simple), short answer, essay, and translation
 */
export const gradeExamAnswer = action({
  args: {
    questionText: v.string(),
    questionType: v.string(), // "multiple_choice" | "short_answer" | "essay" | "translation" | "fill_blank"
    userAnswer: v.string(),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
    rubric: v.optional(v.string()),
    passageText: v.optional(v.string()), // Context for reading questions
    language: v.string(), // "japanese" | "english" | "french"
    examType: v.string(), // "jlpt_n5" | "toefl" | etc.
    maxPoints: v.number(),
    feedbackLanguage: v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh")),
  },
  handler: async (ctx, args): Promise<ExamGradingResult> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const feedbackLang = args.feedbackLanguage;
    const feedbackLanguageName = uiLanguageNames[feedbackLang];

    // For multiple choice, just do simple comparison
    if (args.questionType === "multiple_choice") {
      const isCorrect = args.userAnswer === args.correctAnswer;
      return {
        score: isCorrect ? 100 : 0,
        isCorrect,
        feedback: isCorrect
          ? "Correct!"
          : `Incorrect. The correct answer is: ${args.correctAnswer}`,
        detailedFeedback: {
          strengths: isCorrect ? ["Correct answer selected"] : [],
          improvements: isCorrect ? [] : ["Review this topic"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }

    // For short answer with exact match checking
    if (args.questionType === "short_answer" || args.questionType === "fill_blank") {
      const normalizedAnswer = args.userAnswer.trim().toLowerCase();
      const normalizedCorrect = (args.correctAnswer || "").trim().toLowerCase();
      const acceptableNormalized = (args.acceptableAnswers || []).map((a) =>
        a.trim().toLowerCase()
      );

      if (
        normalizedAnswer === normalizedCorrect ||
        acceptableNormalized.includes(normalizedAnswer)
      ) {
        return {
          score: 100,
          isCorrect: true,
          feedback: "Correct!",
          detailedFeedback: {
            strengths: ["Exact match"],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: args.correctAnswer || "",
        };
      }

      // Fall through to AI grading for partial credit
    }

    // AI grading for essays, translations, and partial credit
    const languageName = languageNames[args.language] || "English";

    let gradingContext = "";
    if (args.correctAnswer) {
      gradingContext += `\nExpected answer: ${args.correctAnswer}`;
    }
    if (args.acceptableAnswers?.length) {
      gradingContext += `\nAlso acceptable: ${args.acceptableAnswers.join(", ")}`;
    }
    if (args.rubric) {
      gradingContext += `\nGrading rubric: ${args.rubric}`;
    }
    if (args.passageText) {
      gradingContext += `\n\nPassage context:\n${args.passageText}`;
    }

    const systemPrompt = `You are a ${languageName} language exam grader for ${args.examType.replace("_", " ").toUpperCase()}.

IMPORTANT: Provide ALL feedback, explanations, strengths, improvements, and grammar errors in ${feedbackLanguageName}. Do NOT respond in English unless the feedback language is English.

Grade the student's answer to this ${args.questionType.replace("_", " ")} question.
${gradingContext}

Respond ONLY with valid JSON in this exact format:
{
  "score": number (0-100),
  "isCorrect": boolean (true if score >= 70),
  "feedback": "Brief overall feedback for the student in ${feedbackLanguageName}",
  "detailedFeedback": {
    "strengths": ["What the student did well - in ${feedbackLanguageName}"],
    "improvements": ["Areas to improve - in ${feedbackLanguageName}"],
    "grammarErrors": ["Specific grammar mistakes if any - in ${feedbackLanguageName}"]
  },
  "suggestedAnswer": "A model answer in ${languageName}"
}

Be fair but rigorous. Consider:
1. Content accuracy and completeness
2. Grammar and language usage
3. Relevance to the question
4. For ${languageName}, check proper use of language-specific features`;

    const prompt = `Question: ${args.questionText}

Student's answer: "${args.userAnswer}"

Grade this answer.`;

    const gradingSchema: JsonSchema = {
      name: "exam_grading",
      schema: {
        type: "object",
        properties: {
          score: { type: "number", minimum: 0, maximum: 100 },
          isCorrect: { type: "boolean" },
          feedback: { type: "string" },
          detailedFeedback: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              grammarErrors: { type: "array", items: { type: "string" } },
            },
            required: ["strengths", "improvements", "grammarErrors"],
            additionalProperties: false,
          },
          suggestedAnswer: { type: "string" },
        },
        required: ["score", "isCorrect", "feedback", "detailedFeedback", "suggestedAnswer"],
        additionalProperties: false,
      },
    };

    try {
      const result = await generateAndParse<ExamGradingResult>({
        prompt,
        systemPrompt,
        maxTokens: 800,
        jsonSchema: gradingSchema,
        models: TEXT_MODEL_CHAIN,
        parse: (response) => parseJson<ExamGradingResult>(response),
        validate: (parsed) => {
          if (typeof parsed.score !== "number") {
            return "Missing score";
          }
          return null;
        },
      });

      // Spend credits after successful AI grading (1 credit for exam answer grading)
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: identity.subject,
        action: "comprehension", // Reuse comprehension credit type for exam grading
        metadata: { examType: args.examType, questionType: args.questionType },
      });

      return result.result;
    } catch (error) {
      console.error("AI grading failed:", error);
      // Return a conservative fallback - no credits charged since AI failed
      return {
        score: 50,
        isCorrect: false,
        feedback: "Unable to fully grade answer. Manual review may be needed.",
        detailedFeedback: {
          strengths: ["Attempted the question"],
          improvements: ["Unable to analyze - please review"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }
  },
});

/**
 * Grade multiple exam answers in batch
 * More efficient for completing exams with many written answers
 */
export const gradeExamAnswersBatch = action({
  args: {
    answers: v.array(
      v.object({
        questionIndex: v.number(),
        questionText: v.string(),
        questionType: v.string(),
        userAnswer: v.string(),
        correctAnswer: v.optional(v.string()),
        acceptableAnswers: v.optional(v.array(v.string())),
        rubric: v.optional(v.string()),
        passageText: v.optional(v.string()),
        maxPoints: v.number(),
      })
    ),
    language: v.string(),
    examType: v.string(),
    feedbackLanguage: v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh")),
  },
  handler: async (ctx, args): Promise<Array<{ questionIndex: number } & ExamGradingResult>> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const results: Array<{ questionIndex: number } & ExamGradingResult> = [];

    // Grade each answer
    for (const answer of args.answers) {
      try {
        const result = await ctx.runAction(internal.ai.gradeExamAnswerInternal, {
          questionText: answer.questionText,
          questionType: answer.questionType,
          userAnswer: answer.userAnswer,
          correctAnswer: answer.correctAnswer,
          acceptableAnswers: answer.acceptableAnswers,
          rubric: answer.rubric,
          passageText: answer.passageText,
          language: args.language,
          examType: args.examType,
          maxPoints: answer.maxPoints,
          feedbackLanguage: args.feedbackLanguage,
        });

        // Spend credits after successful AI grading (skip for multiple choice which doesn't use AI)
        if (answer.questionType !== "multiple_choice") {
          await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
            userId: identity.subject,
            action: "comprehension",
            metadata: { examType: args.examType, questionType: answer.questionType, batch: true },
          });
        }

        results.push({
          questionIndex: answer.questionIndex,
          ...result,
        });
      } catch (error) {
        console.error(`Failed to grade question ${answer.questionIndex}:`, error);
        results.push({
          questionIndex: answer.questionIndex,
          score: 0,
          isCorrect: false,
          feedback: "Grading failed - please review manually",
          detailedFeedback: {
            strengths: [],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: answer.correctAnswer || "",
        });
      }
    }

    return results;
  },
});

// Internal action for batch grading
export const gradeExamAnswerInternal = internalAction({
  args: {
    questionText: v.string(),
    questionType: v.string(),
    userAnswer: v.string(),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
    rubric: v.optional(v.string()),
    passageText: v.optional(v.string()),
    language: v.string(),
    examType: v.string(),
    maxPoints: v.number(),
    feedbackLanguage: v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh")),
  },
  handler: async (_ctx, args): Promise<ExamGradingResult> => {
    // Same logic as gradeExamAnswer
    if (args.questionType === "multiple_choice") {
      const isCorrect = args.userAnswer === args.correctAnswer;
      return {
        score: isCorrect ? 100 : 0,
        isCorrect,
        feedback: isCorrect
          ? "Correct!"
          : `Incorrect. The correct answer is: ${args.correctAnswer}`,
        detailedFeedback: {
          strengths: isCorrect ? ["Correct answer selected"] : [],
          improvements: isCorrect ? [] : ["Review this topic"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }

    if (args.questionType === "short_answer" || args.questionType === "fill_blank") {
      const normalizedAnswer = args.userAnswer.trim().toLowerCase();
      const normalizedCorrect = (args.correctAnswer || "").trim().toLowerCase();
      const acceptableNormalized = (args.acceptableAnswers || []).map((a) =>
        a.trim().toLowerCase()
      );

      if (
        normalizedAnswer === normalizedCorrect ||
        acceptableNormalized.includes(normalizedAnswer)
      ) {
        return {
          score: 100,
          isCorrect: true,
          feedback: "Correct!",
          detailedFeedback: {
            strengths: ["Exact match"],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: args.correctAnswer || "",
        };
      }
    }

    const languageName = languageNames[args.language] || "English";
    const feedbackLanguageName = uiLanguageNames[args.feedbackLanguage];

    let gradingContext = "";
    if (args.correctAnswer) {
      gradingContext += `\nExpected answer: ${args.correctAnswer}`;
    }
    if (args.acceptableAnswers?.length) {
      gradingContext += `\nAlso acceptable: ${args.acceptableAnswers.join(", ")}`;
    }
    if (args.rubric) {
      gradingContext += `\nGrading rubric: ${args.rubric}`;
    }
    if (args.passageText) {
      gradingContext += `\n\nPassage context:\n${args.passageText}`;
    }

    const systemPrompt = `You are a ${languageName} language exam grader for ${args.examType.replace("_", " ").toUpperCase()}.

IMPORTANT: Provide ALL feedback, explanations, strengths, improvements, and grammar errors in ${feedbackLanguageName}. Do NOT respond in English unless the feedback language is English.

Grade the student's answer to this ${args.questionType.replace("_", " ")} question.
${gradingContext}

Respond ONLY with valid JSON in this exact format:
{
  "score": number (0-100),
  "isCorrect": boolean (true if score >= 70),
  "feedback": "Brief overall feedback for the student in ${feedbackLanguageName}",
  "detailedFeedback": {
    "strengths": ["What the student did well - in ${feedbackLanguageName}"],
    "improvements": ["Areas to improve - in ${feedbackLanguageName}"],
    "grammarErrors": ["Specific grammar mistakes if any - in ${feedbackLanguageName}"]
  },
  "suggestedAnswer": "A model answer in ${languageName}"
}

Be fair but rigorous. Consider:
1. Content accuracy and completeness
2. Grammar and language usage
3. Relevance to the question
4. For ${languageName}, check proper use of language-specific features`;

    const prompt = `Question: ${args.questionText}
Student's answer: "${args.userAnswer}"`;

    const gradingSchema: JsonSchema = {
      name: "exam_grading",
      schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          isCorrect: { type: "boolean" },
          feedback: { type: "string" },
          detailedFeedback: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              grammarErrors: { type: "array", items: { type: "string" } },
            },
            required: ["strengths", "improvements", "grammarErrors"],
          },
          suggestedAnswer: { type: "string" },
        },
        required: ["score", "isCorrect", "feedback", "detailedFeedback", "suggestedAnswer"],
      },
    };

    try {
      const result = await generateAndParse<ExamGradingResult>({
        prompt,
        systemPrompt,
        maxTokens: 600,
        jsonSchema: gradingSchema,
        models: TEXT_MODEL_CHAIN,
        parse: (response) => parseJson<ExamGradingResult>(response),
        validate: (parsed) => {
          if (typeof parsed.score !== "number") return "Missing score";
          return null;
        },
      });
      return result.result;
    } catch {
      return {
        score: 50,
        isCorrect: false,
        feedback: "Unable to grade - manual review needed",
        detailedFeedback: { strengths: [], improvements: [], grammarErrors: [] },
        suggestedAnswer: args.correctAnswer || "",
      };
    }
  },
});

"use node";

import { v } from "convex/values";
import { YoutubeTranscript } from "youtube-transcript";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { TEXT_MODEL_CHAIN } from "../lib/models";
import {
  buildLanguageMixingDirective,
  type ContentLanguage,
  getUILanguageName,
  type UILanguage,
} from "../lib/promptHelpers";
import { callWithRetry, type JsonSchema, languageNames, parseJson } from "./core";

/** Fisher-Yates shuffle (returns a new array) */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================
// STORY COMPREHENSION QUESTIONS
// ============================================

interface ComprehensionQuestion {
  questionId: string;
  type:
    | "multiple_choice"
    | "translation"
    | "short_answer"
    | "inference"
    | "prediction"
    | "grammar"
    | "opinion";
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  relatedChapter?: number;
  points: number;
}

/**
 * Generate comprehension questions for a story
 * Questions are cached per story/difficulty in storyQuestions table
 */
export const generateComprehensionQuestions = action({
  args: {
    storyId: v.string(),
    storyTitle: v.string(),
    storyContent: v.string(), // Full story text (plain text, not JSON)
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userId: v.string(),
    difficulty: v.number(), // 1-6 scale (required for caching)
    userLevel: v.optional(v.string()), // User's proficiency level (N3, B2, etc.) for display
    uiLanguage: v.optional(
      v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ comprehensionId: string; questions: ComprehensionQuestion[] }> => {
    // First, check if questions are cached for this story/difficulty
    const cachedQuestions = await ctx.runQuery(internal.storyQuestions.getForStoryInternal, {
      storyId: args.storyId,
      difficulty: args.difficulty,
    });

    if (cachedQuestions) {
      // Questions exist - create user's comprehension quiz from cached questions
      const questionsWithIds = cachedQuestions.questions.map(
        (q: (typeof cachedQuestions.questions)[number], index: number) => ({
          ...q,
          questionId: `q_${Date.now()}_${index}`,
        })
      );

      const comprehensionId = await ctx.runMutation(internal.storyComprehension.createFromAI, {
        userId: args.userId,
        storyId: args.storyId,
        storyTitle: args.storyTitle,
        language: args.language,
        questions: questionsWithIds,
      });

      return { comprehensionId: comprehensionId as string, questions: questionsWithIds };
    }

    // No cached questions - generate new ones
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The learner is at ${args.userLevel} level.` : "";
    const uiLang = (args.uiLanguage ?? "en") as UILanguage;
    const uiLanguageName = getUILanguageName(uiLang);

    // Compute ability estimate from difficulty (1-6 scale → -3 to +3)
    const abilityFromDifficulty = args.difficulty - 3.5; // Maps 1→-2.5, 3→-0.5, 6→2.5
    const langMixing = buildLanguageMixingDirective(
      uiLang,
      abilityFromDifficulty,
      args.language as ContentLanguage
    );

    // Grammar examples for Japanese
    const grammarExamples =
      args.language === "japanese"
        ? `
- Grammar implication questions: Test understanding of nuances like:
  - 〜たい (want to do)
  - はず (expectation/should be)
  - 〜てしまう (completion/regret)
  - 〜ようにする (try to/make sure to)
  - Passive vs causative forms
  - Conditional forms (〜たら, 〜ば, 〜なら)`
        : "";

    // Work budget system: aim for ~6 work units total
    // This creates variety - could be 6 easy questions or 2 hard ones
    const workBudget = 6;

    const systemPrompt = `You are a language learning assistant creating comprehension questions for a ${languageName} reading passage.${levelInfo}

${langMixing}

Create questions with a MIX of difficulty levels. Each question type has a "work cost":
- multiple_choice: 1 work (quick to answer)
- translation: 2 work (requires writing)
- short_answer: 2 work (requires brief written response)
- inference: 2 work (requires thinking + brief answer)
- prediction: 2 work (creative thinking + brief answer)
- grammar: 2 work (analyze grammar usage)
- opinion: 3 work (requires longer thoughtful response)

Your TOTAL work must equal approximately ${workBudget}. Examples:
- 6 multiple choice (6 work)
- 3 multiple choice + 1 opinion (6 work)
- 2 multiple choice + 2 translation (6 work)
- 1 multiple choice + 1 translation + 1 opinion (6 work)

Question type details:
1. multiple_choice: Facts, details, or sequence of events (4 options)
2. translation: Translate a sentence/phrase from the story
3. short_answer: Brief response about meaning or context
4. inference: What can we infer about a character or situation?
5. prediction: What happens next? What would character do if...?
6. grammar: How does a grammar pattern affect meaning?${grammarExamples}
7. opinion: Learner's opinion about character decision or theme

CRITICAL RULES - FOLLOW EXACTLY:
1. Output ONLY the JSON object - nothing else
2. For multiple_choice: MUST include correctAnswer (the exact text of one option), and options array with 4 choices
3. For multiple_choice: Do NOT include rubric field at all
4. For opinion/short_answer: rubric must be under 50 characters (e.g. "clear opinion, evidence")
5. correctAnswer must be under 100 characters
6. NEVER put explanations, reasoning, or thoughts in ANY field
7. Vary question types

JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question in ${languageName}",
      "questionTranslation": "translation in ${uiLanguageName}",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "points": 10
    },
    {
      "type": "opinion",
      "question": "What do you think?",
      "questionTranslation": "translation in ${uiLanguageName}",
      "rubric": "opinion, evidence, clarity",
      "points": 25
    }
  ]
}`;

    const prompt = `Story Title: ${args.storyTitle}

${args.storyContent}

---
Create comprehension questions for the story above, aiming for a total of ${workBudget} work units.`;

    const comprehensionSchema: JsonSchema = {
      name: "comprehension_questions",
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "multiple_choice",
                    "translation",
                    "short_answer",
                    "inference",
                    "prediction",
                    "grammar",
                    "opinion",
                  ],
                },
                question: { type: "string", maxLength: 500 },
                questionTranslation: { type: ["string", "null"], maxLength: 500 },
                options: { type: ["array", "null"], items: { type: "string", maxLength: 100 } },
                correctAnswer: { type: ["string", "null"], maxLength: 500 },
                rubric: { type: ["string", "null"], maxLength: 150 },
                points: { type: "number" },
              },
              required: [
                "type",
                "question",
                "questionTranslation",
                "options",
                "correctAnswer",
                "rubric",
                "points",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    };

    // Helper to sanitize and process questions
    const processQuestions = (parsed: {
      questions: Omit<ComprehensionQuestion, "questionId">[];
    }): ComprehensionQuestion[] => {
      return parsed.questions.map((q, index) => ({
        ...q,
        questionId: `q_${Date.now()}_${index}`,
        options: q.type === "multiple_choice" && q.options ? shuffleArray(q.options) : q.options,
        // For multiple_choice, rubric is not needed - remove it entirely
        // For other types, keep it short
        rubric:
          q.type === "multiple_choice" ? undefined : q.rubric ? q.rubric.slice(0, 150) : undefined,
        // Truncate answer fields
        correctAnswer: q.correctAnswer ? q.correctAnswer.slice(0, 300) : undefined,
      }));
    };

    const parsed = await callWithRetry<{ questions: Omit<ComprehensionQuestion, "questionId">[] }>({
      prompt,
      systemPrompt,
      maxTokens: 1500,
      jsonSchema: comprehensionSchema,
      parse: (response) => parseJson(response),
      validate: (parsed) => {
        if (!parsed.questions || parsed.questions.length === 0) {
          return "No questions generated";
        }
        // Check for corrupted fields (AI dumping chain of thought)
        const corrupted = parsed.questions.some(
          (q) =>
            (q.rubric && q.rubric.length > 200) || (q.correctAnswer && q.correctAnswer.length > 300)
        );
        if (corrupted) {
          return "Response contains corrupted fields (overly long rubric or correctAnswer)";
        }
        // Validate multiple_choice questions have required fields
        const invalidMC = parsed.questions.some(
          (q) =>
            q.type === "multiple_choice" &&
            (!q.correctAnswer ||
              q.correctAnswer.trim() === "" ||
              !q.options ||
              q.options.length < 2)
        );
        if (invalidMC) {
          return "Multiple choice questions must have correctAnswer and options";
        }
        return null;
      },
    });

    const questionsWithIds = processQuestions(parsed);

    // Save questions to cache (storyQuestions table)
    await ctx.runMutation(internal.storyQuestions.createFromAI, {
      storyId: args.storyId,
      difficulty: args.difficulty,
      language: args.language,
      questions: questionsWithIds,
    });

    // Charge credits for question generation (only for new AI-generated questions, not cache hits)
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: args.userId,
      action: "question",
      metadata: { storyId: args.storyId, questionCount: questionsWithIds.length },
    });

    // Create the comprehension quiz for this user
    const comprehensionId = await ctx.runMutation(internal.storyComprehension.createFromAI, {
      userId: args.userId,
      storyId: args.storyId,
      storyTitle: args.storyTitle,
      language: args.language,
      questions: questionsWithIds,
    });

    return { comprehensionId: comprehensionId as string, questions: questionsWithIds };
  },
});

/**
 * Grade a free-form comprehension answer (short answer, essay, translation, inference, etc.)
 */
export const gradeComprehensionAnswer = action({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    userAnswer: v.string(),
    question: v.string(),
    questionType: v.union(
      v.literal("short_answer"),
      v.literal("essay"),
      v.literal("translation"),
      v.literal("inference"),
      v.literal("prediction"),
      v.literal("grammar"),
      v.literal("opinion")
    ),
    expectedAnswer: v.optional(v.string()), // For short answer, translation, grammar
    rubric: v.optional(v.string()), // For essay, inference, prediction, opinion
    storyContext: v.string(), // Relevant story content for context
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userLevel: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    aiScore: number;
    aiFeedback: string;
    isCorrect: boolean;
    possibleAnswer: string;
  }> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Spend credits before grading (1 credit for comprehension)
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: identity.subject,
      action: "comprehension",
      metadata: { comprehensionId: args.comprehensionId, questionIndex: args.questionIndex },
    });

    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The student is at ${args.userLevel} level.` : "";

    let gradingInstructions = "";
    const questionTypeLabels: Record<string, string> = {
      short_answer: "short answer",
      essay: "essay",
      translation: "translation",
      inference: "inference",
      prediction: "prediction",
      grammar: "grammar",
      opinion: "opinion",
    };
    const typeLabel = questionTypeLabels[args.questionType] || args.questionType;

    if (
      (args.questionType === "short_answer" ||
        args.questionType === "translation" ||
        args.questionType === "grammar") &&
      args.expectedAnswer
    ) {
      gradingInstructions = `Expected answer (or key points): ${args.expectedAnswer}

Grade based on:
- Accuracy of content (does it match the expected answer?)
- Completeness (are all key points addressed?)
- Language quality (for the student's level)`;
    } else if (
      (args.questionType === "essay" ||
        args.questionType === "inference" ||
        args.questionType === "prediction" ||
        args.questionType === "opinion") &&
      args.rubric
    ) {
      gradingInstructions = `Grading rubric: ${args.rubric}`;
    } else if (args.expectedAnswer) {
      gradingInstructions = `Expected answer (or key points): ${args.expectedAnswer}`;
    } else if (args.rubric) {
      gradingInstructions = `Grading rubric: ${args.rubric}`;
    }

    const systemPrompt = `You are a ${languageName} language teacher grading a student's comprehension answer.${levelInfo}

${gradingInstructions}

IMPORTANT LANGUAGE REQUIREMENT:
- Students MUST respond in ${languageName}
- If the student answers in a different language (e.g., English instead of ${languageName}), deduct 20-30 points from their score
- In your feedback, remind them to answer in ${languageName} next time

Respond ONLY with valid JSON in this exact format:
{
  "aiScore": number (0-100),
  "aiFeedback": "detailed feedback IN ENGLISH for the student including what they did well and how to improve",
  "isCorrect": boolean (true if score >= 70),
  "possibleAnswer": "a sample correct answer written IN ${languageName.toUpperCase()} at the student's level"
}

Be encouraging but accurate. Consider:
1. Language used - did they respond in ${languageName}? (Major penalty if not)
2. Content accuracy - does the answer demonstrate understanding?
3. Completeness - are key points addressed?
4. Language quality - grammar, vocabulary appropriate for the student's level`;

    const prompt = `Grade this ${typeLabel} answer:

Question: ${args.question}

Student's answer: "${args.userAnswer}"

Story context (for reference):
${args.storyContext}

Provide a score (0-100), detailed feedback in English, and a possible answer in ${languageName}.`;

    const gradingSchema: JsonSchema = {
      name: "comprehension_grading",
      schema: {
        type: "object",
        properties: {
          aiScore: { type: "number", minimum: 0, maximum: 100 },
          aiFeedback: {
            type: "string",
            description: "Detailed feedback for the student in English",
          },
          isCorrect: { type: "boolean", description: "True if score >= 70" },
          possibleAnswer: {
            type: "string",
            description: `A sample correct answer written in ${languageName}`,
          },
        },
        required: ["aiScore", "aiFeedback", "isCorrect", "possibleAnswer"],
        additionalProperties: false,
      },
    };

    try {
      const parsed = await callWithRetry<{
        aiScore: number;
        aiFeedback: string;
        isCorrect: boolean;
        possibleAnswer: string;
      }>({
        prompt,
        systemPrompt,
        maxTokens: 500,
        jsonSchema: gradingSchema,
        models: TEXT_MODEL_CHAIN,
        parse: (response) => parseJson(response),
        validate: (parsed) => {
          if (typeof parsed.aiScore !== "number") {
            return "Missing aiScore";
          }
          return null;
        },
      });

      // Update the comprehension quiz with the grading
      await ctx.runMutation(internal.storyComprehension.updateGradingFromAI, {
        comprehensionId: args.comprehensionId,
        questionIndex: args.questionIndex,
        aiScore: parsed.aiScore,
        aiFeedback: parsed.aiFeedback,
        isCorrect: parsed.isCorrect,
        possibleAnswer: parsed.possibleAnswer,
      });

      return parsed;
    } catch (error) {
      console.error("Failed to grade answer after retries:", error);
      return {
        aiScore: 0,
        aiFeedback: "Unable to grade answer. Please try again.",
        isCorrect: false,
        possibleAnswer: "",
      };
    }
  },
});

// ============================================
// YOUTUBE VIDEO TRANSCRIPT & QUESTIONS
// ============================================

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface VideoQuestion {
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string;
  timestamp?: number;
}

/**
 * Fetch YouTube video transcript
 * Uses youtube-transcript library to get subtitles/captions
 */
export const fetchYoutubeTranscript = action({
  args: {
    videoId: v.string(),
    youtubeContentId: v.optional(v.id("youtubeContent")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; segmentCount: number; error?: string }> => {
    try {
      // Fetch transcript from YouTube
      const transcriptItems = await YoutubeTranscript.fetchTranscript(args.videoId);

      if (!transcriptItems || transcriptItems.length === 0) {
        return {
          success: false,
          segmentCount: 0,
          error: "No transcript available for this video",
        };
      }

      // Convert to our format
      const transcript: TranscriptSegment[] = transcriptItems.map((item) => ({
        text: item.text,
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000,
      }));

      // Update the video with transcript if ID provided
      if (args.youtubeContentId) {
        await ctx.runMutation(internal.youtubeContent.updateTranscriptInternal, {
          id: args.youtubeContentId,
          transcript,
        });
      }

      return {
        success: true,
        segmentCount: transcript.length,
      };
    } catch (error) {
      console.error("Error fetching YouTube transcript:", error);
      return {
        success: false,
        segmentCount: 0,
        error: error instanceof Error ? error.message : "Failed to fetch transcript",
      };
    }
  },
});

/**
 * Generate comprehension questions for a YouTube video based on its transcript
 */
export const generateVideoQuestions = action({
  args: {
    youtubeContentId: v.id("youtubeContent"),
    transcriptText: v.string(), // Full transcript text
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    videoTitle: v.string(),
    userLevel: v.optional(v.string()),
    uiLanguage: v.optional(
      v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; questionCount: number; error?: string }> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The learner is at ${args.userLevel} level.` : "";
    const uiLang = (args.uiLanguage ?? "en") as UILanguage;

    // Work budget system for video questions (slightly smaller than stories since videos are shorter)
    const workBudget = 4;

    // Estimate ability from user level string (rough mapping)
    const videoAbility = args.userLevel
      ? ["N5", "A1"].includes(args.userLevel)
        ? -2
        : ["N4", "A2"].includes(args.userLevel)
          ? -1
          : ["N3", "B1"].includes(args.userLevel)
            ? 0
            : ["N2", "B2"].includes(args.userLevel)
              ? 1
              : 2
      : 0;
    const videoLangMixing = buildLanguageMixingDirective(
      uiLang,
      videoAbility,
      args.language as ContentLanguage
    );

    const systemPrompt = `You are a language learning assistant creating comprehension questions for a ${languageName} video transcript.${levelInfo}

${videoLangMixing}

This is a listening comprehension exercise. Create questions that test understanding of the video content.

Each question type has a "work cost":
- multiple_choice: 1 work (quick to answer)
- short_answer: 2 work (requires brief written response)
- inference: 2 work (requires thinking about what was said)

Your TOTAL work must equal approximately ${workBudget}. Examples:
- 4 multiple choice (4 work)
- 2 multiple choice + 1 short_answer (4 work)
- 2 short_answer (4 work)

CRITICAL RULES:
1. Output ONLY valid JSON
2. For multiple_choice: MUST include correctAnswer and options array with 4 choices
3. Base questions on specific parts of the transcript
4. Include timestamp (in seconds) for relevant video section

JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question in ${languageName}",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "timestamp": 30
    }
  ]
}`;

    const prompt = `Video Title: ${args.videoTitle}

Transcript:
${args.transcriptText}

---
Create comprehension questions for the video above, aiming for ${workBudget} work units total.`;

    const videoQuestionSchema: JsonSchema = {
      name: "video_questions",
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["multiple_choice", "short_answer", "inference"] },
                question: { type: "string", maxLength: 500 },
                options: { type: ["array", "null"], items: { type: "string", maxLength: 100 } },
                correctAnswer: { type: ["string", "null"], maxLength: 200 },
                timestamp: { type: ["number", "null"] },
              },
              required: ["type", "question", "options", "correctAnswer", "timestamp"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    };

    try {
      const parsed = await callWithRetry<{ questions: VideoQuestion[] }>({
        prompt,
        systemPrompt,
        maxTokens: 1000,
        jsonSchema: videoQuestionSchema,
        parse: (response) => parseJson(response),
        validate: (parsed) => {
          if (!parsed.questions || parsed.questions.length === 0) {
            return "No questions generated";
          }
          // Validate multiple_choice questions
          const invalidMC = parsed.questions.some(
            (q) =>
              q.type === "multiple_choice" &&
              (!q.correctAnswer || !q.options || q.options.length < 2)
          );
          if (invalidMC) {
            return "Multiple choice questions must have correctAnswer and options";
          }
          return null;
        },
      });

      // Shuffle MCQ options so the correct answer isn't always first
      const shuffledQuestions = parsed.questions.map((q) => ({
        ...q,
        options: q.type === "multiple_choice" && q.options ? shuffleArray(q.options) : q.options,
      }));

      // Update the video with questions
      await ctx.runMutation(internal.youtubeContent.updateQuestionsInternal, {
        id: args.youtubeContentId,
        questions: shuffledQuestions,
      });

      // Charge credits for video question generation
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: identity.subject,
        action: "question",
        metadata: {
          youtubeContentId: args.youtubeContentId,
          questionCount: shuffledQuestions.length,
        },
      });

      return {
        success: true,
        questionCount: shuffledQuestions.length,
      };
    } catch (error) {
      console.error("Error generating video questions:", error);
      return {
        success: false,
        questionCount: 0,
        error: error instanceof Error ? error.message : "Failed to generate questions",
      };
    }
  },
});

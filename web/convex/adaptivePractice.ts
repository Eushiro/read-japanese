"use node";

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { generateAndParse, type JsonSchema, parseJson, TEXT_MODEL_CHAIN } from "./ai/models";
import { adaptiveContentTypeValidator, languageValidator, type SkillType } from "./schema";

// ============================================
// TYPES
// ============================================

type PracticeQuestionType =
  | "mcq_vocabulary"
  | "mcq_grammar"
  | "mcq_comprehension"
  | "fill_blank"
  | "translation"
  | "listening_mcq"
  | "free_input";

interface PracticeQuestion {
  questionId: string;
  type: PracticeQuestionType;
  targetSkill: SkillType;
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  audioUrl?: string;
  points: number;
}

interface PracticeContent {
  contentId: string;
  contentType: "dialogue" | "micro_story";
  title: string;
  content: string;
  translation: string;
  vocabulary: Array<{ word: string; reading?: string; meaning: string }>;
  audioUrl?: string;
}

interface PracticeSet {
  practiceId: string;
  content: PracticeContent;
  questions: PracticeQuestion[];
  targetSkills: SkillType[];
  difficulty: number;
  generatedAt: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Identify weak skills from learner profile (lowest scoring skills)
 */
function identifyWeakSkills(skills: Record<string, number>, count: number = 3): SkillType[] {
  const skillEntries = Object.entries(skills)
    .filter(([skill]) =>
      ["vocabulary", "grammar", "reading", "listening", "writing", "speaking"].includes(skill)
    )
    .sort((a, b) => a[1] - b[1]);

  return skillEntries.slice(0, count).map(([skill]) => skill as SkillType);
}

/**
 * Select question types based on weak skills
 */
function selectQuestionTypes(weakSkills: SkillType[]): PracticeQuestionType[] {
  const typeMap: Record<SkillType, PracticeQuestionType[]> = {
    vocabulary: ["mcq_vocabulary", "fill_blank"],
    grammar: ["mcq_grammar", "fill_blank"],
    reading: ["mcq_comprehension", "translation"],
    listening: ["listening_mcq"],
    writing: ["free_input", "translation"],
    speaking: [], // Handled separately via shadowing
  };

  const types: PracticeQuestionType[] = [];
  for (const skill of weakSkills) {
    const skillTypes = typeMap[skill] || [];
    for (const type of skillTypes) {
      if (!types.includes(type)) {
        types.push(type);
      }
    }
  }

  // Ensure we have at least MCQ comprehension
  if (!types.includes("mcq_comprehension")) {
    types.push("mcq_comprehension");
  }

  return types.slice(0, 5); // Max 5 question types
}

/**
 * Select content type based on weak skills
 */
function selectContentType(weakSkills: SkillType[]): "dialogue" | "micro_story" {
  // Dialogues are better for listening/speaking practice
  if (weakSkills.includes("listening") || weakSkills.includes("speaking")) {
    return "dialogue";
  }
  // Stories are better for reading/vocabulary
  return "micro_story";
}

// ============================================
// ACTIONS
// ============================================

/**
 * Get next practice set for user
 * Generates personalized content + questions based on weak skills
 */
export const getNextPractice = action({
  args: {
    userId: v.string(),
    language: languageValidator,
    preferredContentType: v.optional(adaptiveContentTypeValidator),
  },
  handler: async (ctx, args): Promise<PracticeSet> => {
    const practiceId = crypto.randomUUID();

    // 1. Get learner profile
    const profile = await ctx.runQuery(internal.learnerModel.getProfileInternal, {
      userId: args.userId,
      language: args.language,
    });

    // 2. Determine weak skills
    const skills = profile?.skills ?? {
      vocabulary: 50,
      grammar: 50,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 50,
    };
    const weakSkills = identifyWeakSkills(skills);

    // 3. Get adaptive content
    const contentType = args.preferredContentType ?? selectContentType(weakSkills);
    const contentResult = await ctx.runAction(api.contentEngine.getBestContent, {
      userId: args.userId,
      language: args.language,
      contentType,
    });

    // 4. Fetch the content payload
    const contentUrl = contentResult.contentUrl;
    let contentPayload: PracticeContent;

    try {
      const response = await fetch(contentUrl);
      const data = await response.json();
      contentPayload = {
        contentId: contentResult.contentId,
        contentType: contentResult.contentType,
        title: data.title,
        content: data.content,
        translation: data.translation,
        vocabulary: data.vocabulary || [],
        audioUrl: data.audioUrl,
      };
    } catch (error) {
      console.error("Failed to fetch content:", error);
      throw new Error("Failed to fetch practice content");
    }

    // 5. Generate questions based on weak skills
    const questionTypes = selectQuestionTypes(weakSkills);
    const questions = await generateQuestionsFromContent(
      contentPayload,
      weakSkills,
      questionTypes,
      args.language
    );

    return {
      practiceId,
      content: contentPayload,
      questions,
      targetSkills: weakSkills,
      difficulty: profile?.abilityEstimate ?? 0,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Generate questions from adaptive content
 */
async function generateQuestionsFromContent(
  content: PracticeContent,
  targetSkills: SkillType[],
  questionTypes: PracticeQuestionType[],
  language: string
): Promise<PracticeQuestion[]> {
  const languageNames: Record<string, string> = {
    japanese: "Japanese",
    english: "English",
    french: "French",
  };
  const languageName = languageNames[language] || "English";

  const systemPrompt = `You are a language learning question generator. Create practice questions for ${languageName} learners based on the provided content.

Generate questions that test: ${targetSkills.join(", ")}
Question types to include: ${questionTypes.join(", ")}

For each question:
- MCQ should have 4 options with plausible distractors
- Fill-in-blank should test vocabulary or grammar patterns from the content
- Comprehension questions should test understanding of the main ideas
- Translation questions should be from ${languageName} to English

IMPORTANT: All questions must be directly based on the provided content.`;

  const prompt = `Generate practice questions for this ${content.contentType}:

Title: ${content.title}
Content: ${content.content}
Translation: ${content.translation}
Vocabulary: ${content.vocabulary.map((v) => `${v.word} - ${v.meaning}`).join(", ")}

Create 3-5 questions of varied types based on the weak skills: ${targetSkills.join(", ")}

Return JSON with an array of questions.`;

  const questionSchema: JsonSchema = {
    name: "practice_questions",
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
                  "mcq_vocabulary",
                  "mcq_grammar",
                  "mcq_comprehension",
                  "fill_blank",
                  "translation",
                  "free_input",
                ],
              },
              targetSkill: {
                type: "string",
                enum: ["vocabulary", "grammar", "reading", "listening", "writing"],
              },
              question: { type: "string" },
              questionTranslation: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
              points: { type: "number" },
            },
            required: ["type", "targetSkill", "question", "correctAnswer", "points"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  };

  try {
    const result = await generateAndParse<{ questions: PracticeQuestion[] }>({
      prompt,
      systemPrompt,
      maxTokens: 1500,
      jsonSchema: questionSchema,
      models: TEXT_MODEL_CHAIN,
      parse: (response) => parseJson<{ questions: PracticeQuestion[] }>(response),
      validate: (parsed) => {
        if (!parsed.questions || parsed.questions.length === 0) {
          return "No questions generated";
        }
        return null;
      },
    });

    // Add unique IDs to questions
    return result.result.questions.map((q, index) => ({
      ...q,
      questionId: `pq_${Date.now()}_${index}`,
    }));
  } catch (error) {
    console.error("Failed to generate questions:", error);
    // Return a fallback comprehension question
    return [
      {
        questionId: `pq_${Date.now()}_fallback`,
        type: "mcq_comprehension",
        targetSkill: "reading",
        question: `What is the main topic of "${content.title}"?`,
        options: [
          "The main idea of the story",
          "A different topic",
          "Something unrelated",
          "None of the above",
        ],
        correctAnswer: "The main idea of the story",
        points: 10,
      },
    ];
  }
}

/**
 * Grade a free-form answer using AI
 */
export const gradeFreeAnswer = action({
  args: {
    question: v.string(),
    userAnswer: v.string(),
    language: languageValidator,
    expectedConcepts: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args): Promise<{ score: number; feedback: string; isCorrect: boolean }> => {
    const languageNames: Record<string, string> = {
      japanese: "Japanese",
      english: "English",
      french: "French",
    };
    const languageName = languageNames[args.language] || "English";

    const systemPrompt = `You are a ${languageName} language teacher grading student responses.
Score the answer from 0-100 and provide brief, encouraging feedback.
Consider: grammar accuracy, vocabulary usage, and relevance to the question.`;

    const prompt = `Question: ${args.question}
Student's answer: "${args.userAnswer}"
${args.expectedConcepts ? `Expected concepts: ${args.expectedConcepts.join(", ")}` : ""}

Grade this answer.`;

    const gradingSchema: JsonSchema = {
      name: "grading_result",
      schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          feedback: { type: "string" },
          isCorrect: { type: "boolean" },
        },
        required: ["score", "feedback", "isCorrect"],
        additionalProperties: false,
      },
    };

    try {
      const result = await generateAndParse<{
        score: number;
        feedback: string;
        isCorrect: boolean;
      }>({
        prompt,
        systemPrompt,
        maxTokens: 300,
        jsonSchema: gradingSchema,
        models: TEXT_MODEL_CHAIN,
        parse: (response) =>
          parseJson<{ score: number; feedback: string; isCorrect: boolean }>(response),
      });

      return result.result;
    } catch (error) {
      console.error("Failed to grade answer:", error);
      return {
        score: 50,
        feedback: "Unable to grade automatically. Please review.",
        isCorrect: false,
      };
    }
  },
});

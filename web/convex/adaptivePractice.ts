"use node";

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  generateAndParse,
  generateAndParseRace,
  GRADING_MODEL_CHAIN,
  type JsonSchema,
  parseJson,
  TEXT_MODEL_RACE_CONFIG,
} from "./ai/models";
import { isAdminEmail } from "./lib/admin";
import type { ModelConfig, ProviderType } from "./lib/models";
import {
  buildDistractorRules,
  buildInterestTheming,
  buildLanguageMixingDirective,
  buildLearnerContextBlock,
  buildStemVarietyRules,
  buildWeakAreaTargeting,
  type ContentLanguage,
  getContentLanguageName,
  getUILanguageName,
  type LearnerContext,
  type UILanguage,
} from "./lib/promptHelpers";
import {
  adaptiveContentTypeValidator,
  languageValidator,
  type SkillType,
  uiLanguageValidator,
} from "./schema";

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
  | "free_input"
  | "dictation"
  | "shadow_record";

interface PracticeQuestion {
  questionId: string;
  type: PracticeQuestionType;
  targetSkill: SkillType;
  difficulty?: "easy" | "medium" | "hard";
  question: string;
  passageText?: string;
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
  isDiagnostic: boolean;
  content?: PracticeContent;
  questions: PracticeQuestion[];
  targetSkills: SkillType[];
  difficulty: number;
  generatedAt: number;
  modelUsed?: string;
  systemPrompt?: string;
  prompt?: string;
  profileSnapshot: {
    abilityEstimate: number;
    abilityConfidence: number;
    skillScores: Record<string, number>;
  };
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
    listening: ["listening_mcq", "dictation"],
    writing: ["free_input", "translation"],
    speaking: ["shadow_record"],
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
// SHARED SCHEMA & VALIDATION HELPERS
// ============================================

const MCQ_TYPES: PracticeQuestionType[] = [
  "mcq_vocabulary",
  "mcq_grammar",
  "mcq_comprehension",
  "fill_blank",
  "listening_mcq",
];

/**
 * Build the JSON schema for AI question generation.
 * Shared between diagnostic, content-based, and incremental generation.
 */
function buildQuestionSchema(name: string): JsonSchema {
  return {
    name,
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
                  "listening_mcq",
                  "free_input",
                  "dictation",
                  "shadow_record",
                ],
              },
              targetSkill: {
                type: "string",
                enum: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking"],
              },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              question: { type: "string" },
              passageText: { type: "string" },
              questionTranslation: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
              acceptableAnswers: { type: "array", items: { type: "string" } },
              points: { type: "number" },
            },
            required: ["type", "targetSkill", "difficulty", "question", "correctAnswer", "points"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  };
}

/**
 * Filter out broken MCQ questions and assign unique IDs.
 */
function filterAndAssignIds(questions: PracticeQuestion[], prefix: string): PracticeQuestion[] {
  const validQuestions = questions.filter((q) => {
    if (MCQ_TYPES.includes(q.type) && (!q.options || q.options.length < 2)) {
      console.warn(`Dropping ${q.type} question with insufficient options`);
      return false;
    }
    return true;
  });

  return validQuestions.map((q, index) => ({
    ...q,
    options: MCQ_TYPES.includes(q.type) && q.options ? shuffleArray(q.options) : q.options,
    questionId: `${prefix}_${Date.now()}_${index}`,
  }));
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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
    uiLanguage: v.optional(uiLanguageValidator),
  },
  handler: async (ctx, args): Promise<PracticeSet> => {
    const practiceId = crypto.randomUUID();
    const uiLang = (args.uiLanguage ?? "en") as UILanguage;

    // 1. Get learner profile
    const profile = await ctx.runQuery(internal.learnerModel.getProfileInternal, {
      userId: args.userId,
      language: args.language,
    });

    // 2. Build profile snapshot for client
    const skills = profile?.skills ?? {
      vocabulary: 50,
      grammar: 50,
      reading: 50,
      listening: 50,
      writing: 50,
      speaking: 50,
    };
    const profileSnapshot = {
      abilityEstimate: profile?.abilityEstimate ?? 0,
      abilityConfidence: profile?.abilityConfidence ?? 1.0,
      skillScores: skills as Record<string, number>,
    };

    // 3. Determine weak skills
    const weakSkills = identifyWeakSkills(skills);

    // 4. Diagnostic vs Normal mode
    // High SE (> 0.5) means uncertain about ability → diagnostic mode
    const isDiagnostic = (profile?.abilityConfidence ?? 1.0) > 0.5;

    if (isDiagnostic) {
      // ===== DIAGNOSTIC MODE =====
      // Skip content generation, generate standalone questions
      const learnerContext: LearnerContext = {
        abilityEstimate: profile?.abilityEstimate ?? 0,
        weakAreas: profile?.weakAreas,
        interestWeights: profile?.interestWeights ?? undefined,
        examType: profile?.examType ?? undefined,
        vocabCoverage: profile?.vocabCoverage,
        difficultyCalibration: profile?.difficultyCalibration ?? undefined,
        skills: skills as Record<string, number>,
      };
      const diagnosticResult = await generateDiagnosticQuestions(
        args.language,
        profile?.abilityEstimate ?? 0,
        uiLang,
        learnerContext
      );

      // Generate TTS audio for audio-based question types (max 1-2)
      const audioTypes: PracticeQuestionType[] = ["listening_mcq", "dictation", "shadow_record"];
      const questionsWithAudio = await Promise.all(
        diagnosticResult.questions.map(async (q) => {
          if (audioTypes.includes(q.type) && !q.audioUrl) {
            try {
              const result = await ctx.runAction(internal.ai.generateTTSAudioAction, {
                text: q.question,
                language: args.language,
              });
              if (result.success && result.audioUrl) {
                return { ...q, audioUrl: result.audioUrl };
              }
            } catch (error) {
              console.error(`Failed to generate TTS for question ${q.questionId}:`, error);
            }
          }
          return q;
        })
      );

      return {
        practiceId,
        isDiagnostic: true,
        questions: questionsWithAudio,
        targetSkills: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking"],
        difficulty: profile?.abilityEstimate ?? 0,
        generatedAt: Date.now(),
        modelUsed: diagnosticResult.modelUsed,
        systemPrompt: diagnosticResult.systemPrompt,
        prompt: diagnosticResult.prompt,
        profileSnapshot,
      };
    }

    // ===== NORMAL MODE =====
    // 5. Get adaptive content
    const contentType = args.preferredContentType ?? selectContentType(weakSkills);
    const contentResult = await ctx.runAction(api.contentEngine.getBestContent, {
      userId: args.userId,
      language: args.language,
      contentType,
    });

    // 6. Fetch the content payload
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

    // 7. Generate questions based on weak skills (8-10 questions)
    const questionTypes = selectQuestionTypes(weakSkills);
    const generatedResult = await generateQuestionsFromContent(
      contentPayload,
      weakSkills,
      questionTypes,
      args.language,
      uiLang,
      profile?.abilityEstimate ?? 0,
      profile?.weakAreas
    );

    // 8. Generate TTS audio for audio-based question types
    const audioTypes: PracticeQuestionType[] = ["listening_mcq", "dictation", "shadow_record"];
    const questionsWithAudio = await Promise.all(
      generatedResult.questions.map(async (q) => {
        if (audioTypes.includes(q.type) && !q.audioUrl) {
          try {
            const ttsText = q.type === "listening_mcq" ? contentPayload.content : q.question;
            const result = await ctx.runAction(internal.ai.generateTTSAudioAction, {
              text: ttsText,
              language: args.language,
            });
            if (result.success && result.audioUrl) {
              return { ...q, audioUrl: result.audioUrl };
            }
          } catch (error) {
            console.error(`Failed to generate TTS for question ${q.questionId}:`, error);
          }
        }
        return q;
      })
    );

    return {
      practiceId,
      isDiagnostic: false,
      content: contentPayload,
      questions: questionsWithAudio,
      targetSkills: weakSkills,
      difficulty: profile?.abilityEstimate ?? 0,
      generatedAt: Date.now(),
      modelUsed: generatedResult.modelUsed,
      profileSnapshot,
    };
  },
});

interface GeneratedQuestionsResult {
  questions: PracticeQuestion[];
  modelUsed?: string;
  systemPrompt?: string;
  prompt?: string;
}

/**
 * Generate questions from adaptive content
 */
async function generateQuestionsFromContent(
  content: PracticeContent,
  targetSkills: SkillType[],
  questionTypes: PracticeQuestionType[],
  language: string,
  uiLanguage: UILanguage = "en",
  abilityEstimate: number = 0,
  weakAreas?: Array<{ skill: string; topic: string; score: number }>,
  modelOverride?: ModelConfig[]
): Promise<GeneratedQuestionsResult> {
  const languageName = getContentLanguageName(language as ContentLanguage);
  const uiLanguageName = getUILanguageName(uiLanguage);

  // Build prompt enhancement blocks
  const langMixing = buildLanguageMixingDirective(
    uiLanguage,
    abilityEstimate,
    language as ContentLanguage
  );
  const distractorRules = buildDistractorRules(language as ContentLanguage, "current level");
  const stemVariety = buildStemVarietyRules();
  const weakAreaBlock = weakAreas ? buildWeakAreaTargeting(weakAreas) : "";

  const systemPrompt = `You are a language learning question generator. Create practice questions for ${languageName} learners based on the provided content.

${langMixing}

Generate questions that test: ${targetSkills.join(", ")}
Question types to include: ${questionTypes.join(", ")}

For each question:
- MCQ should have exactly 4 options
- Fill-in-blank: use "___" in the question field to mark the blank (e.g. "毎朝___を食べます"). The correctAnswer is the word that fills the blank. Provide exactly 4 options (like MCQ) — one correct answer and 3 plausible distractors.
- Comprehension questions should test understanding of the main ideas
- For mcq_comprehension, do NOT set "passageText" — the passage is the provided content.
- Translation questions should be from ${languageName} to ${uiLanguageName}. Set questionTranslation to a short prompt like "Translate:".
- listening_mcq: provide a question about audio content with 4 MCQ options. The audio will be generated from the content.
- dictation: set question to a sentence from the content that the user will hear and type. The correctAnswer is the exact sentence.
- shadow_record: set question to a sentence for pronunciation practice. Set questionTranslation to the ${uiLanguageName} translation. The correctAnswer is the sentence itself.
- Include at least 2 inferential questions (not just surface-level recall)

Each question MUST have a "difficulty" field: "easy", "medium", or "hard".
- easy: basic recognition, common words, simple patterns
- medium: sentence-level understanding, grammar patterns
- hard: inference, production, complex structures

Include at least 4 different question types. Aim for a mix: 3 easy, 3-4 medium, 2-3 hard.

${distractorRules}

For vocabulary MCQs, distractors should be other words from the content when possible.

${stemVariety}

${weakAreaBlock}

IMPORTANT: All questions must be directly based on the provided content.`;

  const prompt = `Generate practice questions for this ${content.contentType}:

Title: ${content.title}
Content: ${content.content}
Translation: ${content.translation}
Vocabulary: ${content.vocabulary.map((v) => `${v.word} - ${v.meaning}`).join(", ")}

Create 8-10 questions of varied types based on the weak skills: ${targetSkills.join(", ")}
Include at least 4 different question types. Tag each question with difficulty: "easy", "medium", or "hard".

Return JSON with an array of questions.`;

  const questionSchema = buildQuestionSchema("practice_questions");

  const sharedOpts = {
    prompt,
    systemPrompt,
    maxTokens: 3000,
    jsonSchema: questionSchema,
    parse: (response: string) => parseJson<{ questions: PracticeQuestion[] }>(response),
    validate: (parsed: { questions: PracticeQuestion[] }) => {
      if (!parsed.questions || parsed.questions.length === 0) {
        return "No questions generated";
      }
      return null;
    },
  };

  try {
    const result = modelOverride
      ? await generateAndParse<{ questions: PracticeQuestion[] }>({
          ...sharedOpts,
          models: modelOverride,
        })
      : await generateAndParseRace<{ questions: PracticeQuestion[] }>({
          ...sharedOpts,
          raceModel: TEXT_MODEL_RACE_CONFIG.raceModel,
          fallbackChain: TEXT_MODEL_RACE_CONFIG.fallbackChain,
        });

    return {
      questions: filterAndAssignIds(result.result.questions, "pq"),
      modelUsed: result.usage.model,
    };
  } catch (error) {
    console.error("Failed to generate questions:", error);
    // Return a fallback comprehension question
    return {
      questions: [
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
      ],
      modelUsed: undefined,
    };
  }
}

/**
 * Generate standalone diagnostic questions (no content piece)
 * Used for first-time users or when ability confidence is low.
 * Covers all 6 skills with varied difficulty.
 */
async function generateDiagnosticQuestions(
  language: string,
  abilityEstimate: number,
  uiLanguage: UILanguage = "en",
  learnerContext?: LearnerContext,
  modelOverride?: ModelConfig[]
): Promise<GeneratedQuestionsResult> {
  const languageName = getContentLanguageName(language as ContentLanguage);
  const uiLanguageName = getUILanguageName(uiLanguage);

  // Determine approximate level for context
  const levelHint =
    abilityEstimate <= -2
      ? "beginner"
      : abilityEstimate <= 0
        ? "elementary to intermediate"
        : abilityEstimate <= 1.5
          ? "intermediate to advanced"
          : "advanced";

  // Build prompt enhancement blocks
  const langMixing = buildLanguageMixingDirective(
    uiLanguage,
    abilityEstimate,
    language as ContentLanguage
  );
  const distractorRules = buildDistractorRules(language as ContentLanguage, levelHint);
  const stemVariety = buildStemVarietyRules();

  // Learner context block (if available)
  const learnerBlock = learnerContext
    ? buildLearnerContextBlock(learnerContext, levelHint)
    : `LEARNER PROFILE:\n- Estimated level: ${levelHint} (ability: ${abilityEstimate.toFixed(1)})`;

  // Weak area targeting
  const weakAreaBlock = learnerContext?.weakAreas
    ? buildWeakAreaTargeting(learnerContext.weakAreas)
    : "";

  // Interest theming
  const interests =
    learnerContext?.interestWeights
      ?.filter((iw) => iw.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((iw) => iw.tag) ?? [];
  const interestBlock = buildInterestTheming(interests);

  const systemPrompt = `You are a ${languageName} diagnostic assessment generator.
Create standalone practice questions that do NOT reference any reading passage — each question must be self-contained.

${learnerBlock}

${langMixing}

DIAGNOSTIC STRATEGY:
- 1 question BELOW estimated level (confirm strengths)
- 2 questions AT estimated level (calibrate precisely)
- 1 question ABOVE estimated level (probe ceiling)

Generate questions covering ALL of these skills:
- vocabulary (mcq_vocabulary, fill_blank)
- grammar (mcq_grammar)
- reading (mcq_comprehension — provide a SHORT 1-2 sentence passage in "passageText", and keep "question" as the question only)
- writing (free_input, translation)
- listening (listening_mcq, dictation — keep to max 1)
- speaking (shadow_record — keep to max 1)

${weakAreaBlock}

${interestBlock}

For each question:
- MCQ: exactly 4 options
- fill_blank: use "___" in the question to mark the blank. Provide exactly 4 options (like MCQ) — one correct answer and 3 plausible distractors.
- translation: ask the learner to translate a sentence. Set questionTranslation to "Translate:"
- free_input: ask the learner to write a short response in ${languageName}
- mcq_comprehension: set "passageText" to a short ${languageName} text (1-2 sentences) and use "question" for the question itself
- listening_mcq: provide a question about what was heard (audio will be generated from the question text)
- dictation: set question to a ${languageName} sentence the user will type after hearing
- shadow_record: set question to a ${languageName} sentence for pronunciation. Set questionTranslation to the ${uiLanguageName} translation

${distractorRules}

${stemVariety}

IMPORTANT: Questions must be standalone — no external reading passage.
Each question MUST have a "difficulty" field: "easy", "medium", or "hard".`;

  const prompt = `Generate 4 standalone diagnostic ${languageName} practice questions.
Cover at least 3 different skills. Use at least 3 different question types.
Maximum 1 listening/dictation question and 1 shadow_record question.
Return JSON.`;

  const questionSchema = buildQuestionSchema("diagnostic_questions");

  const diagSharedOpts = {
    prompt,
    systemPrompt,
    maxTokens: 2000,
    jsonSchema: questionSchema,
    parse: (response: string) => parseJson<{ questions: PracticeQuestion[] }>(response),
    validate: (parsed: { questions: PracticeQuestion[] }) => {
      if (!parsed.questions || parsed.questions.length < 2) {
        return "Not enough questions generated";
      }
      return null;
    },
  };

  try {
    const result = modelOverride
      ? await generateAndParse<{ questions: PracticeQuestion[] }>({
          ...diagSharedOpts,
          models: modelOverride,
        })
      : await generateAndParseRace<{ questions: PracticeQuestion[] }>({
          ...diagSharedOpts,
          raceModel: TEXT_MODEL_RACE_CONFIG.raceModel,
          fallbackChain: TEXT_MODEL_RACE_CONFIG.fallbackChain,
        });

    return {
      questions: filterAndAssignIds(result.result.questions, "diag"),
      modelUsed: result.usage.model,
      systemPrompt,
      prompt,
    };
  } catch (error) {
    console.error("Failed to generate diagnostic questions:", error);
    // Fallback with basic questions
    return {
      questions: [
        {
          questionId: `diag_${Date.now()}_0`,
          type: "mcq_vocabulary",
          targetSkill: "vocabulary",
          difficulty: "easy",
          question:
            language === "japanese"
              ? "「ありがとう」の意味は？"
              : language === "french"
                ? "Que signifie « bonjour » ?"
                : "What does 'hello' mean?",
          options:
            language === "japanese"
              ? ["Thank you", "Hello", "Goodbye", "Sorry"]
              : language === "french"
                ? ["Good morning", "Goodbye", "Thank you", "Sorry"]
                : ["A greeting", "A farewell", "An apology", "A question"],
          correctAnswer:
            language === "japanese"
              ? "Thank you"
              : language === "french"
                ? "Good morning"
                : "A greeting",
          points: 10,
        },
      ],
      modelUsed: undefined,
      systemPrompt,
      prompt,
    };
  }
}

/**
 * Generate diagnostic questions for a single model (used by frontend model test mode).
 * The frontend calls this per-model in parallel so results stream in as each resolves.
 */
export const generateForModel = action({
  args: {
    language: languageValidator,
    abilityEstimate: v.number(),
    modelId: v.string(),
    modelProvider: v.union(v.literal("google"), v.literal("openrouter")),
  },
  handler: async (ctx, args) => {
    // Admin-only: verify caller is an admin
    const identity = await ctx.auth.getUserIdentity();
    if (!isAdminEmail(identity?.email)) {
      throw new Error("Unauthorized: admin access required");
    }

    const startTime = Date.now();
    try {
      const modelConfig: ModelConfig = {
        model: args.modelId,
        provider: args.modelProvider as ProviderType,
      };
      const result = await generateDiagnosticQuestions(
        args.language,
        args.abilityEstimate,
        "en",
        undefined,
        [modelConfig]
      );
      return {
        model: args.modelId,
        questions: result.questions,
        latencyMs: Date.now() - startTime,
        systemPrompt: result.systemPrompt,
        prompt: result.prompt,
      };
    } catch (error) {
      return {
        model: args.modelId,
        questions: [],
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Generate 2 incremental diagnostic questions for dynamic session extension.
 * Called during diagnostic mode when the pool of unanswered questions runs low.
 */
export const generateIncrementalQuestions = action({
  args: {
    language: languageValidator,
    abilityEstimate: v.number(),
    targetDifficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    recentPerformance: v.array(
      v.object({
        skill: v.string(),
        type: v.string(),
        difficulty: v.string(),
        isCorrect: v.boolean(),
      })
    ),
    excludeSkills: v.array(v.string()),
    excludeTypes: v.array(v.string()),
    uiLanguage: v.optional(uiLanguageValidator),
  },
  handler: async (ctx, args) => {
    // Verify user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const uiLang = (args.uiLanguage ?? "en") as UILanguage;
    const languageName = getContentLanguageName(args.language as ContentLanguage);
    const uiLanguageName = getUILanguageName(uiLang);

    const levelHint =
      args.abilityEstimate <= -2
        ? "beginner"
        : args.abilityEstimate <= 0
          ? "elementary to intermediate"
          : args.abilityEstimate <= 1.5
            ? "intermediate to advanced"
            : "advanced";

    const langMixing = buildLanguageMixingDirective(
      uiLang,
      args.abilityEstimate,
      args.language as ContentLanguage
    );
    const distractorRules = buildDistractorRules(args.language as ContentLanguage, levelHint);
    const stemVariety = buildStemVarietyRules();

    // Build recent performance context
    const perfSummary = args.recentPerformance
      .map((p) => `${p.skill}/${p.type} (${p.difficulty}): ${p.isCorrect ? "correct" : "wrong"}`)
      .join("\n");

    const excludeSkillsNote =
      args.excludeSkills.length > 0
        ? `AVOID these skills (recently used): ${args.excludeSkills.join(", ")}`
        : "";
    const excludeTypesNote =
      args.excludeTypes.length > 0
        ? `AVOID these question types (recently used): ${args.excludeTypes.join(", ")}`
        : "";

    const systemPrompt = `You are a ${languageName} diagnostic assessment generator.
Create standalone practice questions that do NOT reference any reading passage — each question must be self-contained.

LEARNER PROFILE:
- Estimated level: ${levelHint} (ability: ${args.abilityEstimate.toFixed(1)})

${langMixing}

RECENT PERFORMANCE:
${perfSummary || "No recent answers yet."}

TARGET DIFFICULTY: ${args.targetDifficulty}
Generate questions at the "${args.targetDifficulty}" difficulty level.

${excludeSkillsNote}
${excludeTypesNote}

For each question:
- MCQ: exactly 4 options
- fill_blank: use "___" in the question to mark the blank. Provide exactly 4 options.
- translation: set questionTranslation to "Translate:"
- free_input: ask the learner to write a short response in ${languageName}
- mcq_comprehension: set "passageText" to a short ${languageName} text (1-2 sentences) and use "question" for the question itself
- listening_mcq / dictation: max 1 total
- shadow_record: set questionTranslation to the ${uiLanguageName} translation. Max 1.

${distractorRules}

${stemVariety}

IMPORTANT: Questions must be standalone — no external reading passage.
Each question MUST have a "difficulty" field: "easy", "medium", or "hard".`;

    const prompt = `Generate exactly 2 standalone diagnostic ${languageName} practice questions.
Target difficulty: ${args.targetDifficulty}.
Use different skills and question types from each other.
Return JSON.`;

    const questionSchema = buildQuestionSchema("incremental_diagnostic_questions");

    try {
      const result = await generateAndParseRace<{ questions: PracticeQuestion[] }>({
        prompt,
        systemPrompt,
        maxTokens: 800,
        jsonSchema: questionSchema,
        raceModel: TEXT_MODEL_RACE_CONFIG.raceModel,
        fallbackChain: TEXT_MODEL_RACE_CONFIG.fallbackChain,
        parse: (response) => parseJson<{ questions: PracticeQuestion[] }>(response),
        validate: (parsed) => {
          if (!parsed.questions || parsed.questions.length === 0) {
            return "No questions generated";
          }
          return null;
        },
      });

      return {
        questions: filterAndAssignIds(result.result.questions, "incr"),
        modelUsed: result.usage.model,
        systemPrompt,
        prompt,
      };
    } catch (error) {
      console.error("Failed to generate incremental questions:", error);
      return {
        questions: [],
        modelUsed: undefined,
        systemPrompt,
        prompt,
      };
    }
  },
});

/**
 * Grade a free-form answer using AI
 */
export const gradeFreeAnswer = action({
  args: {
    question: v.string(),
    userAnswer: v.string(),
    language: languageValidator,
    expectedConcepts: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
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
${args.correctAnswer ? `Reference answer: ${args.correctAnswer}` : ""}
${args.acceptableAnswers?.length ? `Also acceptable: ${args.acceptableAnswers.join(", ")}` : ""}
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
        models: GRADING_MODEL_CHAIN,
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

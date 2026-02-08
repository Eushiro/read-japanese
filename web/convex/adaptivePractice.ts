"use node";

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { generateAndParse, type JsonSchema, parseJson } from "./ai/models";
import { isAdminEmail } from "./lib/admin";
import { estimateQuestionDifficulty } from "./lib/difficultyEstimator";
import type { ModelConfig, ProviderType } from "./lib/models";
import { TEXT_MODEL_CHAIN } from "./lib/models";
import {
  buildDifficultyAnchors,
  buildDistractorRules,
  buildFormattingRules,
  buildGoalDirective,
  buildInterestTheming,
  buildLanguageMixingDirective,
  buildLearnerContextBlock,
  buildStemVarietyRules,
  buildTargetDifficultyBlock,
  buildWeakAreaTargeting,
  type ContentLanguage,
  getContentLanguageName,
  getUILanguageName,
  type LearnerContext,
  SUPPORTED_UI_LANGUAGES,
  type UILanguage,
} from "./lib/promptHelpers";
import { hashQuestionContent } from "./lib/questionPoolHelpers";
import {
  adaptiveContentTypeValidator,
  type DifficultyLevel,
  difficultyLevelValidator,
  languageValidator,
  type PracticeQuestionType,
  type SkillType,
  uiLanguageValidator,
} from "./schema";

// ============================================
// TYPES
// ============================================

interface PracticeQuestion {
  questionId: string;
  type: PracticeQuestionType;
  targetSkill: SkillType;
  difficulty?: DifficultyLevel;
  difficultyNumeric?: number;
  question: string;
  passageText?: string;
  /** @deprecated Use translations[uiLanguage] instead */
  questionTranslation?: string;
  /** Question text translated into each UI language */
  translations: Record<UILanguage, string>;
  /** MCQ option translations into each UI language (null for non-MCQ) */
  optionTranslations: Record<UILanguage, string[]> | null;
  /** Whether MCQ options are in the target language (true) or UI language (false) */
  showOptionsInTargetLanguage: boolean;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  audioUrl?: string;
  points: number;
  // Metadata tags for question pool
  grammarTags?: string[];
  vocabTags?: string[];
  topicTags?: string[];
  // Pool tracking (SHA-256 of canonical content, for pool stat updates)
  questionHash: string;
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

const LISTENING_TYPES: PracticeQuestionType[] = ["listening_mcq", "dictation"];
const SPEAKING_TYPES: PracticeQuestionType[] = ["shadow_record"];

function getAudioCaps(isDiagnostic: boolean): { listening: number; speaking: number } {
  return isDiagnostic ? { listening: 1, speaking: 1 } : { listening: 2, speaking: 1 };
}

function applyAudioCaps(
  questions: PracticeQuestion[],
  existing: { listening: number; speaking: number },
  caps: { listening: number; speaking: number }
): {
  accepted: PracticeQuestion[];
  dropped: PracticeQuestion[];
  counts: { listening: number; speaking: number };
} {
  const accepted: PracticeQuestion[] = [];
  const dropped: PracticeQuestion[] = [];
  const counts = { listening: existing.listening, speaking: existing.speaking };

  for (const q of questions) {
    if (LISTENING_TYPES.includes(q.type)) {
      if (counts.listening >= caps.listening) {
        dropped.push(q);
        continue;
      }
      counts.listening += 1;
    }
    if (SPEAKING_TYPES.includes(q.type)) {
      if (counts.speaking >= caps.speaking) {
        dropped.push(q);
        continue;
      }
      counts.speaking += 1;
    }
    accepted.push(q);
  }

  return { accepted, dropped, counts };
}

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
 * Apply goal-based bias to skill scores before identifying weak skills.
 * Lowers scores for goal-relevant skills so they're more likely to appear in
 * the "weakest N" selection without completely overriding actual weakness detection.
 */
function applyGoalBias(skills: Record<string, number>, goal?: string): Record<string, number> {
  if (!goal) return skills;

  // Skill importance weights per goal (negative offset = more important = biased weaker)
  const goalBias: Record<string, Partial<Record<string, number>>> = {
    travel: { listening: -15, speaking: -15, vocabulary: -5 },
    professional: { reading: -10, writing: -15, grammar: -10 },
    media: { listening: -15, reading: -10, vocabulary: -5 },
    exam: {}, // No bias — exam prep should fix weakest skills
    casual: {}, // No bias — balanced approach
  };

  const bias = goalBias[goal] ?? {};
  const adjusted = { ...skills };
  for (const [skill, offset] of Object.entries(bias)) {
    if (offset !== undefined) {
      adjusted[skill] = Math.max(0, (adjusted[skill] ?? 50) + offset);
    }
  }
  return adjusted;
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
 * Select content type based on weak skills and learning goal
 */
function selectContentType(
  weakSkills: SkillType[],
  learningGoal?: string
): "dialogue" | "micro_story" {
  // Goal-based override
  if (learningGoal === "travel" || learningGoal === "professional") {
    return "dialogue"; // Conversation practice
  }
  if (learningGoal === "media") {
    return "micro_story"; // Reading/comprehension
  }
  // Default: skill-based selection
  if (weakSkills.includes("listening") || weakSkills.includes("speaking")) {
    return "dialogue";
  }
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
const REQUIRED_SKILLS: SkillType[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "writing",
  "speaking",
];

/**
 * Build the JSON schema for AI question generation.
 * Shared between diagnostic, content-based, and incremental generation.
 */
function buildQuestionSchema(name: string): JsonSchema {
  // Build translations and optionTranslations schema dynamically from SUPPORTED_UI_LANGUAGES
  const translationProps: Record<string, { type: string }> = {};
  for (const lang of SUPPORTED_UI_LANGUAGES) {
    translationProps[lang] = { type: "string" };
  }

  const optionTranslationProps: Record<string, { type: string; items: { type: string } }> = {};
  for (const lang of SUPPORTED_UI_LANGUAGES) {
    optionTranslationProps[lang] = { type: "array", items: { type: "string" } };
  }

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
              difficulty: {
                type: "string",
                enum: ["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"],
              },
              question: { type: "string" },
              passageText: { type: ["string", "null"] },
              translations: {
                type: "object",
                properties: translationProps,
                required: [...SUPPORTED_UI_LANGUAGES],
                additionalProperties: false,
              },
              optionTranslations: {
                type: ["object", "null"],
                properties: optionTranslationProps,
                required: [...SUPPORTED_UI_LANGUAGES],
                additionalProperties: false,
              },
              showOptionsInTargetLanguage: { type: "boolean" },
              options: { type: ["array", "null"], items: { type: "string" } },
              correctAnswer: { type: "string" },
              acceptableAnswers: { type: ["array", "null"], items: { type: "string" } },
              points: { type: "number" },
              grammarTags: { type: ["array", "null"], items: { type: "string" } },
              vocabTags: { type: ["array", "null"], items: { type: "string" } },
              topicTags: { type: ["array", "null"], items: { type: "string" } },
            },
            required: [
              "type",
              "targetSkill",
              "difficulty",
              "question",
              "passageText",
              "translations",
              "optionTranslations",
              "showOptionsInTargetLanguage",
              "options",
              "correctAnswer",
              "acceptableAnswers",
              "points",
              "grammarTags",
              "vocabTags",
              "topicTags",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  };
}

type QuestionSetMode = "diagnostic" | "content" | "incremental";

type QuestionSetContext = {
  mode: QuestionSetMode;
  minCount: number;
  maxCount: number;
  requireAllSkills?: boolean;
  requireTypeVariety?: number;
};

function isMCQType(type: PracticeQuestionType): boolean {
  return MCQ_TYPES.includes(type);
}

function hasBlankToken(question: string): boolean {
  return question.includes("___");
}

function uniqueCount(items: string[]): number {
  return new Set(items).size;
}

function validateQuestionSet(
  questions: PracticeQuestion[],
  context: QuestionSetContext
): { errors: string[]; failureCount: number } {
  const errors: string[] = [];

  if (!questions || questions.length === 0) {
    return { errors: ["No questions generated"], failureCount: 1 };
  }

  if (questions.length < context.minCount || questions.length > context.maxCount) {
    errors.push(
      `Question count ${questions.length} not in range ${context.minCount}-${context.maxCount}`
    );
  }

  const skillSet = new Set<SkillType>();
  const typeSet = new Set<PracticeQuestionType>();
  const difficultySet = new Set<string>();

  questions.forEach((q, idx) => {
    if (!q.type || !q.targetSkill || !q.question || !q.correctAnswer) {
      errors.push(`Q${idx}: missing required fields`);
      return;
    }

    typeSet.add(q.type);
    skillSet.add(q.targetSkill);
    if (q.difficulty) difficultySet.add(q.difficulty);

    if (!q.points || q.points <= 0) {
      errors.push(`Q${idx}: points must be positive`);
    }

    if (isMCQType(q.type)) {
      if (!q.options || q.options.length !== 4) {
        errors.push(`Q${idx}: MCQ must have exactly 4 options`);
      } else {
        if (uniqueCount(q.options) !== 4) {
          errors.push(`Q${idx}: MCQ options must be unique`);
        }
        if (!q.options.includes(q.correctAnswer)) {
          errors.push(`Q${idx}: correctAnswer must match one of the options`);
        }
      }
    }

    if (q.type === "fill_blank" && !hasBlankToken(q.question)) {
      errors.push(`Q${idx}: fill_blank must include "___"`);
    }

    if (q.type === "translation" || q.type === "shadow_record") {
      // Check that translations object has at least one non-empty value
      const hasTranslation =
        q.translations &&
        Object.values(q.translations).some((v) => typeof v === "string" && v.trim().length > 0);
      if (!hasTranslation) {
        errors.push(`Q${idx}: ${q.type} must include translations`);
      }
    }

    if (q.type === "mcq_comprehension") {
      if (context.mode === "content" && q.passageText) {
        errors.push(`Q${idx}: mcq_comprehension in content mode must omit passageText`);
      }
      if ((context.mode === "diagnostic" || context.mode === "incremental") && !q.passageText) {
        errors.push(`Q${idx}: mcq_comprehension in diagnostic must include passageText`);
      }
    }

    if (
      q.difficulty &&
      !["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"].includes(q.difficulty)
    ) {
      errors.push(`Q${idx}: invalid difficulty`);
    }
  });

  if (context.requireAllSkills && REQUIRED_SKILLS.some((s) => !skillSet.has(s))) {
    errors.push("Question set must cover all 6 skills");
  }

  if (context.requireTypeVariety && typeSet.size < context.requireTypeVariety) {
    errors.push(`Question set must include at least ${context.requireTypeVariety} types`);
  }

  return { errors, failureCount: errors.length };
}

/**
 * Filter out broken MCQ questions, assign unique IDs, and compute heuristic difficulty.
 */
function filterAndAssignIds(
  questions: PracticeQuestion[],
  prefix: string,
  language?: string
): PracticeQuestion[] {
  const validQuestions = questions.filter((q) => {
    if (MCQ_TYPES.includes(q.type) && (!q.options || q.options.length < 2)) {
      console.warn(`Dropping ${q.type} question with insufficient options`);
      return false;
    }
    return true;
  });

  return validQuestions.map((q, index) => {
    let options = q.options;
    let optionTranslations = q.optionTranslations;

    if (MCQ_TYPES.includes(q.type) && q.options) {
      // Shuffle indices so we can reorder both options and translations in sync
      const indices = q.options.map((_, i) => i);
      const shuffledIndices = shuffleArray(indices);
      options = shuffledIndices.map((i) => q.options![i]);

      if (q.optionTranslations) {
        optionTranslations = Object.fromEntries(
          Object.entries(q.optionTranslations).map(([lang, translations]) => [
            lang,
            shuffledIndices.map((i) => (translations as string[])[i]),
          ])
        ) as Record<UILanguage, string[]>;
      }
    }

    return {
      ...q,
      options,
      optionTranslations,
      questionId: `${prefix}_${Date.now()}_${index}`,
      difficultyNumeric: language ? estimateQuestionDifficulty(q, language) : undefined,
      questionHash: hashQuestionContent({
        questionType: q.type,
        question: q.question,
        passageText: q.passageText,
        correctAnswer: q.correctAnswer,
        options: q.options, // hash from pre-shuffle options for stable dedup
      }),
    };
  });
}

type QuestionGenerationMeta = {
  modelUsed?: string;
  systemPrompt?: string;
  prompt?: string;
  validationFailures?: number;
  repairAttempts?: number;
  generationLatencyMs?: number;
  qualityScore?: number;
};

function buildRepairPrompt(
  originalQuestions: PracticeQuestion[],
  violations: string[],
  context: QuestionSetContext
): { systemPrompt: string; prompt: string } {
  const systemPrompt = `You are a strict JSON editor for language learning questions.
Fix the issues and return ONLY valid JSON that matches the schema. Do not include explanations.`;

  const prompt = `The following question set has validation errors.
Fix the questions to satisfy all constraints. Keep the number of questions between ${context.minCount} and ${context.maxCount}.

Violations:
${violations.join("\n")}

Original questions JSON:
${JSON.stringify({ questions: originalQuestions }, null, 2)}

Return corrected JSON with a "questions" array.`;

  return { systemPrompt, prompt };
}

async function generateQuestionsWithRepair(
  args: {
    prompt: string;
    systemPrompt: string;
    maxTokens: number;
    jsonSchema: JsonSchema;
    parse: (response: string) => { questions: PracticeQuestion[] };
    context: QuestionSetContext;
    modelOverride?: ModelConfig[];
    language?: string;
  },
  prefix: string
): Promise<{ questions: PracticeQuestion[] } & QuestionGenerationMeta> {
  const start = Date.now();
  const runGenerate = () =>
    generateAndParse<{ questions: PracticeQuestion[] }>({
      prompt: args.prompt,
      systemPrompt: args.systemPrompt,
      maxTokens: args.maxTokens,
      jsonSchema: args.jsonSchema,
      parse: args.parse,
      models: args.modelOverride,
    });

  let repairAttempts = 0;
  let validationFailures = 0;
  let modelUsed: string | undefined;

  const initial = await runGenerate();
  modelUsed = initial.usage.model;
  const initialValidation = validateQuestionSet(initial.result.questions, args.context);
  validationFailures = initialValidation.failureCount;

  let finalQuestions = initial.result.questions;
  let finalValidation = initialValidation;

  if (initialValidation.errors.length > 0) {
    repairAttempts += 1;
    try {
      const repair = buildRepairPrompt(
        initial.result.questions,
        initialValidation.errors,
        args.context
      );
      const repaired = await generateAndParse<{ questions: PracticeQuestion[] }>({
        prompt: repair.prompt,
        systemPrompt: repair.systemPrompt,
        maxTokens: Math.min(args.maxTokens, 2000),
        jsonSchema: args.jsonSchema,
        parse: args.parse,
        models: args.modelOverride,
      });
      modelUsed = repaired.usage.model;
      finalQuestions = repaired.result.questions;
      finalValidation = validateQuestionSet(finalQuestions, args.context);
    } catch (error) {
      console.error("Repair attempt failed:", error);
    }
  }

  if (finalValidation.errors.length > 0) {
    try {
      const regen = await runGenerate();
      modelUsed = regen.usage.model;
      finalQuestions = regen.result.questions;
      finalValidation = validateQuestionSet(finalQuestions, args.context);
    } catch (error) {
      console.error("Regeneration attempt failed:", error);
    }
  }

  if (finalValidation.errors.length > 0) {
    console.error("Final question validation failed:", finalValidation.errors);
  }

  const generationLatencyMs = Date.now() - start;
  const qualityScore =
    finalValidation.errors.length === 0
      ? 100
      : Math.max(40, 100 - 5 * finalValidation.errors.length);

  return {
    questions: filterAndAssignIds(finalQuestions, prefix, args.language),
    modelUsed,
    systemPrompt: args.systemPrompt,
    prompt: args.prompt,
    validationFailures,
    repairAttempts,
    generationLatencyMs,
    qualityScore,
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Compute a 4-question difficulty spread that stays at or below the target level.
 * Returns [warmup, warmup, target, target] — no questions above the estimated level.
 * The incremental generation system handles upward escalation based on performance.
 */
function getDiagnosticSpread(target: DifficultyLevel): [string, string, string, string] {
  const levels = ["level_1", "level_2", "level_3", "level_4", "level_5", "level_6"];
  const idx = levels.indexOf(target);
  const low = Math.max(0, idx - 1);
  return [levels[low], levels[low], levels[idx], levels[idx]];
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

    // Fetch user's learning goal
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: args.userId });
    const learningGoal = user?.learningGoal;

    // Beginner detection: mirror contentEngine logic for appropriate starting difficulty
    const isBeginner = !profile || profile.totalStudyMinutes === 0;
    const storedAbility = profile?.abilityEstimate ?? 0;

    // Ability mapping from self-assessment (biased lower so users start strong)
    const selfAssessedAbility: Record<string, number> = {
      complete_beginner: -2.0, // level_1 territory
      some_basics: -1.2, // level_2 territory
      intermediate: -0.3, // level_3 territory (not level_4)
      advanced: 0.8, // level_4 territory (not level_5/6)
    };

    const effectiveAbility =
      isBeginner && storedAbility === 0
        ? (selfAssessedAbility[user?.selfAssessedLevel ?? "complete_beginner"] ?? -2.0)
        : storedAbility;

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
      abilityEstimate: effectiveAbility,
      abilityConfidence: profile?.abilityConfidence ?? 1.0,
      skillScores: skills as Record<string, number>,
    };

    // 3. Determine weak skills (with goal bias applied)
    const biasedSkills = applyGoalBias(skills, learningGoal);
    const weakSkills = identifyWeakSkills(biasedSkills);

    // 4. Diagnostic vs Normal mode
    // High SE (> 0.5) means uncertain about ability → diagnostic mode
    const isDiagnostic = (profile?.abilityConfidence ?? 1.0) > 0.5;

    if (isDiagnostic) {
      // ===== DIAGNOSTIC MODE =====
      // Hybrid flow: search pool first, generate fresh to fill gaps
      const targetCount = 4;
      const learnerContext: LearnerContext = {
        abilityEstimate: effectiveAbility,
        weakAreas: profile?.weakAreas,
        interestWeights: profile?.interestWeights ?? undefined,
        examType: profile?.examType ?? undefined,
        learningGoal,
        vocabCoverage: profile?.vocabCoverage,
        difficultyCalibration: profile?.difficultyCalibration ?? undefined,
        skills: skills as Record<string, number>,
      };

      // Determine target difficulty based on ability
      const targetDifficulty: DifficultyLevel =
        effectiveAbility <= -2
          ? "level_1"
          : effectiveAbility <= -1
            ? "level_2"
            : effectiveAbility <= 0
              ? "level_3"
              : effectiveAbility <= 1
                ? "level_4"
                : effectiveAbility <= 2
                  ? "level_5"
                  : "level_6";

      // Search the question pool for matching questions
      let poolQuestions: PracticeQuestion[] = [];
      let poolSize = 0;
      try {
        const interests =
          profile?.interestWeights?.filter((iw) => iw.weight > 0).map((iw) => iw.tag) ?? [];

        const poolResult = await ctx.runAction(internal.questionPool.searchQuestionPool, {
          userId: args.userId,
          language: args.language,
          difficulty: targetDifficulty,
          targetCount,
          abilityEstimate: effectiveAbility,
          weakAreas: profile?.weakAreas?.map((w) => ({
            skill: w.skill,
            topic: w.topic,
            score: w.score,
          })),
          interests,
        });

        poolSize = poolResult.poolSize;

        // Determine how many pool questions to use based on pool size
        const poolRatio = poolSize < 50 ? 0 : poolSize < 200 ? 0.3 : poolSize < 1000 ? 0.5 : 0.7;
        const poolTarget = Math.round(targetCount * poolRatio);

        // Convert pool results to PracticeQuestion format
        // Only include pool questions that have translations
        poolQuestions = poolResult.questions
          .filter((pq: (typeof poolResult.questions)[number]) => pq.translations !== undefined)
          .slice(0, poolTarget)
          .map((pq: (typeof poolResult.questions)[number], idx: number) => ({
            questionId: `pool_${Date.now()}_${idx}`,
            type: pq.questionType as PracticeQuestionType,
            targetSkill: pq.targetSkill as SkillType,
            difficulty: pq.difficulty as DifficultyLevel,
            question: pq.question,
            passageText: pq.passageText ?? undefined,
            options: pq.options ?? undefined,
            correctAnswer: pq.correctAnswer,
            acceptableAnswers: pq.acceptableAnswers ?? undefined,
            points: pq.points,
            questionHash: pq.questionHash,
            translations: pq.translations as Record<UILanguage, string>,
            optionTranslations: (pq.optionTranslations as Record<UILanguage, string[]>) ?? null,
            showOptionsInTargetLanguage: pq.showOptionsInTargetLanguage ?? true,
          }));
      } catch (error) {
        console.error("Pool search failed, falling back to full generation:", error);
      }

      // Generate fresh questions to fill gaps
      const freshNeeded = targetCount - poolQuestions.length;
      let freshQuestions: PracticeQuestion[] = [];
      let diagnosticMeta: QuestionGenerationMeta = {};

      if (freshNeeded > 0) {
        const diagnosticResult = await generateDiagnosticQuestions(
          args.language,
          effectiveAbility,
          uiLang,
          learnerContext,
          undefined,
          targetDifficulty
        );
        freshQuestions = diagnosticResult.questions.slice(0, freshNeeded);
        diagnosticMeta = {
          modelUsed: diagnosticResult.modelUsed,
          systemPrompt: diagnosticResult.systemPrompt,
          prompt: diagnosticResult.prompt,
          qualityScore: diagnosticResult.qualityScore,
          validationFailures: diagnosticResult.validationFailures,
          repairAttempts: diagnosticResult.repairAttempts,
          generationLatencyMs: diagnosticResult.generationLatencyMs,
        };

        // Fire-and-forget: ingest fresh questions to pool
        ctx
          .runAction(internal.questionPool.ingestQuestionsToPool, {
            language: args.language,
            questions: diagnosticResult.questions.map((q) => ({
              questionType: q.type,
              targetSkill: q.targetSkill,
              difficulty: q.difficulty ?? "level_3",
              question: q.question,
              passageText: q.passageText ?? undefined,
              options: q.options ?? undefined,
              correctAnswer: q.correctAnswer,
              acceptableAnswers: q.acceptableAnswers ?? undefined,
              points: q.points,
              grammarTags: q.grammarTags ?? undefined,
              vocabTags: q.vocabTags ?? undefined,
              topicTags: q.topicTags ?? undefined,
              translations: q.translations,
              optionTranslations: q.optionTranslations,
              showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
            })),
            modelUsed: diagnosticResult.modelUsed,
            qualityScore: diagnosticResult.qualityScore,
          })
          .catch((e) => console.error("Pool ingestion failed:", e));
      }

      // Merge pool + fresh questions, shuffle
      const allQuestions = shuffleArray([...poolQuestions, ...freshQuestions]);

      const diagnosticCaps = getAudioCaps(true);
      const cappedDiagnostic = applyAudioCaps(
        allQuestions,
        { listening: 0, speaking: 0 },
        diagnosticCaps
      );

      // Generate TTS audio for audio-based question types (max 1-2)
      const audioTypes: PracticeQuestionType[] = ["listening_mcq", "dictation", "shadow_record"];
      const questionsWithAudio = await Promise.all(
        cappedDiagnostic.accepted.map(async (q) => {
          if (audioTypes.includes(q.type) && !q.audioUrl) {
            try {
              const ttsText =
                q.type === "listening_mcq" && q.passageText ? q.passageText : q.question;
              const result = await ctx.runAction(internal.ai.generateTTSAudioAction, {
                text: ttsText,
                language: args.language,
                word: `practice-${q.questionId}`,
                audioType: "sentence",
                sentenceId: "audio",
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

      await ctx.runMutation(internal.adaptivePracticeQueries.upsertPracticeSessionInternal, {
        userId: args.userId,
        practiceId,
        language: args.language,
        isDiagnostic: true,
        questions: questionsWithAudio.map((q) => ({
          questionId: q.questionId,
          type: q.type,
          targetSkill: q.targetSkill,
          difficulty: q.difficulty,
        })),
        modelUsed: diagnosticMeta.modelUsed,
        qualityScore: diagnosticMeta.qualityScore,
        validationFailures: diagnosticMeta.validationFailures,
        repairAttempts: diagnosticMeta.repairAttempts,
        generationLatencyMs: diagnosticMeta.generationLatencyMs,
      });

      console.log(
        `Diagnostic: ${poolQuestions.length} from pool, ${freshQuestions.length} fresh (pool size: ${poolSize})`
      );

      return {
        practiceId,
        isDiagnostic: true,
        questions: questionsWithAudio,
        targetSkills: ["vocabulary", "grammar", "reading", "listening", "writing", "speaking"],
        difficulty: effectiveAbility,
        generatedAt: Date.now(),
        modelUsed: diagnosticMeta.modelUsed,
        systemPrompt: diagnosticMeta.systemPrompt,
        prompt: diagnosticMeta.prompt,
        profileSnapshot,
      };
    }

    // ===== NORMAL MODE =====
    // 5. Get adaptive content
    const contentType = args.preferredContentType ?? selectContentType(weakSkills, learningGoal);
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
      profile?.weakAreas,
      undefined,
      learningGoal
    );

    // Fire-and-forget: ingest content-based questions to pool
    ctx
      .runAction(internal.questionPool.ingestQuestionsToPool, {
        language: args.language,
        questions: generatedResult.questions.map((q) => ({
          questionType: q.type,
          targetSkill: q.targetSkill,
          difficulty: q.difficulty ?? "level_3",
          question: q.question,
          passageText: q.passageText ?? undefined,
          options: q.options ?? undefined,
          correctAnswer: q.correctAnswer,
          acceptableAnswers: q.acceptableAnswers ?? undefined,
          points: q.points,
          grammarTags: q.grammarTags ?? undefined,
          vocabTags: q.vocabTags ?? undefined,
          topicTags: q.topicTags ?? undefined,
          translations: q.translations,
          optionTranslations: q.optionTranslations,
          showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
        })),
        modelUsed: generatedResult.modelUsed,
        qualityScore: generatedResult.qualityScore,
      })
      .catch((e) => console.error("Pool ingestion failed:", e));

    const normalCaps = getAudioCaps(false);
    const cappedNormal = applyAudioCaps(
      generatedResult.questions,
      { listening: 0, speaking: 0 },
      normalCaps
    );

    // 8. Generate TTS audio for audio-based question types
    const audioTypes: PracticeQuestionType[] = ["listening_mcq", "dictation", "shadow_record"];
    const questionsWithAudio = await Promise.all(
      cappedNormal.accepted.map(async (q) => {
        if (audioTypes.includes(q.type) && !q.audioUrl) {
          try {
            const ttsText = q.type === "listening_mcq" ? contentPayload.content : q.question;
            const result = await ctx.runAction(internal.ai.generateTTSAudioAction, {
              text: ttsText,
              language: args.language,
              word: `practice-${q.questionId}`,
              audioType: "sentence",
              sentenceId: "audio",
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

    await ctx.runMutation(internal.adaptivePracticeQueries.upsertPracticeSessionInternal, {
      userId: args.userId,
      practiceId,
      language: args.language,
      isDiagnostic: false,
      contentId: contentPayload.contentId,
      contentType: contentPayload.contentType,
      questions: questionsWithAudio.map((q) => ({
        questionId: q.questionId,
        type: q.type,
        targetSkill: q.targetSkill,
        difficulty: q.difficulty,
      })),
      modelUsed: generatedResult.modelUsed,
      qualityScore: generatedResult.qualityScore,
      validationFailures: generatedResult.validationFailures,
      repairAttempts: generatedResult.repairAttempts,
      generationLatencyMs: generatedResult.generationLatencyMs,
    });

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
  validationFailures?: number;
  repairAttempts?: number;
  generationLatencyMs?: number;
  qualityScore?: number;
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
  modelOverride?: ModelConfig[],
  learningGoal?: string
): Promise<GeneratedQuestionsResult> {
  const languageName = getContentLanguageName(language as ContentLanguage);

  // Build prompt enhancement blocks
  const langMixing = buildLanguageMixingDirective(
    uiLanguage,
    abilityEstimate,
    language as ContentLanguage
  );
  const distractorRules = buildDistractorRules(language as ContentLanguage, "current level");
  const stemVariety = buildStemVarietyRules();
  const weakAreaBlock = weakAreas ? buildWeakAreaTargeting(weakAreas) : "";

  const goalDirective = learningGoal ? buildGoalDirective(learningGoal) : "";

  const systemPrompt = `You are a language learning question generator. Create practice questions for ${languageName} learners based on the provided content.

${goalDirective ? `${goalDirective}\n` : ""}${langMixing}

Generate questions that test: ${targetSkills.join(", ")}
Question types to include: ${questionTypes.join(", ")}

For each question:
- MCQ should have exactly 4 options
- mcq_vocabulary / mcq_grammar with a sentence context: put the ${languageName} sentence in "passageText" and the instruction/question stem in "question". For simple "What does X mean?" questions with no sentence context, leave "passageText" empty.
- fill_blank: put the sentence with "___" in "passageText" (e.g. "毎朝___を食べます"). Put the instruction in "question". The correctAnswer is the word that fills the blank. Provide exactly 4 options (like MCQ) — one correct answer and 3 plausible distractors.
- Comprehension questions should test understanding of the main ideas
- For mcq_comprehension, do NOT set "passageText" — the passage is the provided content.
- translation: put the sentence to translate in "passageText" (in ${languageName}), put the instruction in "question" (e.g., "Translate to English"). Set translations to localized instructions, e.g. { en: "Translate to English", fr: "Traduisez en français", ja: "英語に翻訳してください", zh: "翻译成英文" }.
- listening_mcq: provide a question about audio content with 4 MCQ options. The audio will be generated from the content.
- dictation: set question to a sentence from the content that the user will hear and type. The correctAnswer is the exact sentence.
- shadow_record: set question to a sentence for pronunciation practice. Set translations to the sentence meaning in each UI language. The correctAnswer is the sentence itself.
- Include at least 2 inferential questions (not just surface-level recall)

Each question MUST have a "difficulty" field: one of "level_1", "level_2", "level_3", "level_4", "level_5", or "level_6".

${buildDifficultyAnchors(language as ContentLanguage)}

Include at least 4 different question types. Aim for a mix: 1-2 level_1, 2 level_2, 2 level_3, 2 level_4, 1-2 level_5, 0-1 level_6.

${distractorRules}

For vocabulary MCQs, distractors should be other words from the content when possible.

${stemVariety}

${weakAreaBlock}

${buildFormattingRules()}

IMPORTANT: All questions must be directly based on the provided content.

METADATA TAGS: For each question, include:
- "grammarTags": array of grammar points tested (e.g., ["て-form", "passive voice"]). Empty array [] if none.
- "vocabTags": array of vocabulary domains (e.g., ["food", "travel"]). Empty array [] if none.
- "topicTags": array of theme/interest tags (e.g., ["daily life", "cooking"]). Empty array [] if none.`;

  const prompt = `Generate practice questions for this ${content.contentType}:

Title: ${content.title}
Content: ${content.content}
Translation: ${content.translation}
Vocabulary: ${content.vocabulary.map((v) => `${v.word} - ${v.meaning}`).join(", ")}

Create 8-10 questions of varied types based on the weak skills: ${targetSkills.join(", ")}
Include at least 4 different question types. Tag each question with difficulty from: level_1, level_2, level_3, level_4, level_5, level_6.
Include grammarTags, vocabTags, and topicTags for each question.

Return JSON with an array of questions.`;

  const questionSchema = buildQuestionSchema("practice_questions");

  const context: QuestionSetContext = {
    mode: "content",
    minCount: 8,
    maxCount: 10,
    requireTypeVariety: 4,
  };

  try {
    const result = await generateQuestionsWithRepair(
      {
        prompt,
        systemPrompt,
        maxTokens: 3000,
        jsonSchema: questionSchema,
        parse: (response: string) => parseJson<{ questions: PracticeQuestion[] }>(response),
        context,
        modelOverride,
        language,
      },
      "pq"
    );

    return result;
  } catch (error) {
    console.error("Failed to generate questions:", error);
    throw error;
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
  modelOverride?: ModelConfig[],
  targetDifficulty?: DifficultyLevel
): Promise<GeneratedQuestionsResult> {
  const languageName = getContentLanguageName(language as ContentLanguage);

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

  const goalDirective = learnerContext?.learningGoal
    ? buildGoalDirective(learnerContext.learningGoal)
    : "";

  // Compute difficulty spread relative to estimated level
  const effectiveTarget: DifficultyLevel =
    targetDifficulty ??
    (abilityEstimate <= -2
      ? "level_1"
      : abilityEstimate <= -1
        ? "level_2"
        : abilityEstimate <= 0
          ? "level_3"
          : abilityEstimate <= 1
            ? "level_4"
            : abilityEstimate <= 2
              ? "level_5"
              : "level_6");
  const [spreadEasy, , spreadTarget] = getDiagnosticSpread(effectiveTarget);

  const systemPrompt = `You are a ${languageName} diagnostic assessment generator.
Create 4 standalone practice questions that do NOT reference any reading passage — each question must be self-contained.

${learnerBlock}

${goalDirective ? `${goalDirective}\n` : ""}${langMixing}

DIAGNOSTIC STRATEGY:
- 2 warm-up questions (${spreadEasy} — build confidence, confirm foundations)
- 2 questions at estimated level (${spreadTarget} — calibrate current ability)

Keep all questions approachable. Do NOT include questions above ${spreadTarget}.
The system will dynamically generate harder questions later if the learner succeeds.

Aim to cover at least 3 different skills from this list:
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
- mcq_vocabulary / mcq_grammar with a sentence context: put the ${languageName} sentence in "passageText" and the instruction/question stem in "question". For simple "What does X mean?" questions with no sentence context, leave "passageText" empty.
- fill_blank: put the sentence with "___" in "passageText" (e.g. "毎朝___を食べます"). Put the instruction in "question". Provide exactly 4 options (like MCQ) — one correct answer and 3 plausible distractors.
- translation: put the sentence to translate in "passageText" (in ${languageName}), put the instruction in "question". Set translations to localized instructions, e.g. { en: "Translate to English", fr: "Traduisez en français", ja: "英語に翻訳してください", zh: "翻译成英文" }
- free_input: ask the learner to write a short response in ${languageName}
- mcq_comprehension: set "passageText" to a short ${languageName} text (1-2 sentences) and use "question" for the question itself
- listening_mcq: provide a question about what was heard (audio will be generated from the question text)
- dictation: set question to a ${languageName} sentence the user will type after hearing
- shadow_record: set question to a ${languageName} sentence for pronunciation. Set translations to the sentence meaning in each UI language

${distractorRules}

${stemVariety}

${buildDifficultyAnchors(language as ContentLanguage)}

${buildFormattingRules()}

IMPORTANT: Questions must be standalone — no external reading passage.
Each question MUST have a "difficulty" field: one of "level_1", "level_2", "level_3", "level_4", "level_5", or "level_6".

METADATA TAGS: For each question, include:
- "grammarTags": array of grammar points tested (e.g., ["て-form", "passive voice", "particles"]). Empty array [] if none.
- "vocabTags": array of vocabulary domains (e.g., ["food", "travel", "numbers"]). Empty array [] if none.
- "topicTags": array of theme/interest tags (e.g., ["daily life", "cooking", "anime"]). Empty array [] if none.`;

  const prompt = `Generate exactly 4 standalone diagnostic ${languageName} practice questions.
Cover at least 3 different skills. Use at least 3 different question types.
Spread difficulty: 2 ${spreadEasy}, 2 ${spreadTarget}. Do NOT go above ${spreadTarget}.
Maximum 1 listening/dictation question and 1 shadow_record question.
Include grammarTags, vocabTags, and topicTags for each question.
Return JSON.`;

  const questionSchema = buildQuestionSchema("diagnostic_questions");

  try {
    const result = await generateQuestionsWithRepair(
      {
        prompt,
        systemPrompt,
        maxTokens: 2500,
        jsonSchema: questionSchema,
        parse: (response: string) => parseJson<{ questions: PracticeQuestion[] }>(response),
        context: {
          mode: "diagnostic",
          minCount: 4,
          maxCount: 4,
          requireAllSkills: false,
          requireTypeVariety: 3,
        },
        modelOverride,
        language,
      },
      "diag"
    );

    return {
      ...result,
      systemPrompt,
      prompt,
    };
  } catch (error) {
    console.error("Failed to generate diagnostic questions:", error);
    throw error;
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
    practiceId: v.string(),
    language: languageValidator,
    abilityEstimate: v.number(),
    targetDifficulty: difficultyLevelValidator,
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

    const session = await ctx.runQuery(
      internal.adaptivePracticeQueries.getPracticeSessionInternal,
      {
        userId: identity.subject,
        practiceId: args.practiceId,
      }
    );
    const isDiagnostic = session?.isDiagnostic ?? true;
    const caps = getAudioCaps(isDiagnostic);
    const existingCounts = {
      listening: session?.listeningCount ?? 0,
      speaking: session?.speakingCount ?? 0,
    };

    const effectiveExcludeTypes = new Set(args.excludeTypes);
    if (existingCounts.listening >= caps.listening) {
      effectiveExcludeTypes.add("listening_mcq");
      effectiveExcludeTypes.add("dictation");
    }
    if (existingCounts.speaking >= caps.speaking) {
      effectiveExcludeTypes.add("shadow_record");
    }

    const uiLang = (args.uiLanguage ?? "en") as UILanguage;
    const languageName = getContentLanguageName(args.language as ContentLanguage);

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
      effectiveExcludeTypes.size > 0
        ? `AVOID these question types (recently used or capped): ${Array.from(
            effectiveExcludeTypes
          ).join(", ")}`
        : "";

    const systemPrompt = `You are a ${languageName} diagnostic assessment generator.
Create standalone practice questions that do NOT reference any reading passage — each question must be self-contained.

LEARNER PROFILE:
- Estimated level: ${levelHint} (ability: ${args.abilityEstimate.toFixed(1)})

${langMixing}

RECENT PERFORMANCE:
${perfSummary || "No recent answers yet."}

${buildTargetDifficultyBlock(args.abilityEstimate, args.targetDifficulty, args.language as ContentLanguage)}

${excludeSkillsNote}
${excludeTypesNote}

For each question:
- MCQ: exactly 4 options
- mcq_vocabulary / mcq_grammar with a sentence context: put the ${languageName} sentence in "passageText" and the instruction/question stem in "question". For simple "What does X mean?" questions with no sentence context, leave "passageText" empty.
- fill_blank: put the sentence with "___" in "passageText". Put the instruction in "question". Provide exactly 4 options.
- translation: set translations to localized instructions, e.g. { en: "Translate to English", fr: "Traduisez en français", ja: "英語に翻訳してください", zh: "翻译成英文" }
- free_input: ask the learner to write a short response in ${languageName}
- mcq_comprehension: set "passageText" to a short ${languageName} text (1-2 sentences) and use "question" for the question itself
- listening_mcq / dictation: max 1 total
- shadow_record: set translations to the sentence meaning in each UI language. Max 1.

${distractorRules}

${stemVariety}

${buildDifficultyAnchors(args.language as ContentLanguage)}

${buildFormattingRules()}

IMPORTANT: Questions must be standalone — no external reading passage.
Each question MUST have a "difficulty" field: one of "level_1", "level_2", "level_3", "level_4", "level_5", or "level_6".`;

    const prompt = `Generate exactly 2 standalone diagnostic ${languageName} practice questions.
Target difficulty: ${args.targetDifficulty}.
Use different skills and question types from each other.
Return JSON.`;

    const questionSchema = buildQuestionSchema("incremental_diagnostic_questions");

    try {
      const result = await generateQuestionsWithRepair(
        {
          prompt,
          systemPrompt,
          maxTokens: 900,
          jsonSchema: questionSchema,
          parse: (response) => parseJson<{ questions: PracticeQuestion[] }>(response),
          context: {
            mode: "incremental",
            minCount: 2,
            maxCount: 2,
            requireTypeVariety: 2,
          },
          language: args.language,
        },
        "incr"
      );

      const withIds = result.questions;
      const capped = applyAudioCaps(withIds, existingCounts, caps);

      // Generate TTS audio for audio-based question types
      const incrAudioTypes: PracticeQuestionType[] = [
        "listening_mcq",
        "dictation",
        "shadow_record",
      ];
      const questionsWithAudio: PracticeQuestion[] = await Promise.all(
        capped.accepted.map(async (q): Promise<PracticeQuestion> => {
          if (incrAudioTypes.includes(q.type) && !q.audioUrl) {
            try {
              const ttsText =
                q.type === "listening_mcq" && q.passageText ? q.passageText : q.question;
              const ttsResult = await ctx.runAction(internal.ai.generateTTSAudioAction, {
                text: ttsText,
                language: args.language,
                word: `practice-${q.questionId}`,
                audioType: "sentence" as const,
                sentenceId: "audio",
              });
              if (ttsResult.success && ttsResult.audioUrl) {
                return { ...q, audioUrl: ttsResult.audioUrl };
              }
            } catch (error) {
              console.error(
                `Failed to generate TTS for incremental question ${q.questionId}:`,
                error
              );
            }
          }
          return q;
        })
      );

      if (questionsWithAudio.length > 0) {
        await ctx.runMutation(internal.adaptivePracticeQueries.upsertPracticeSessionInternal, {
          userId: identity.subject,
          practiceId: args.practiceId,
          language: args.language,
          isDiagnostic,
          questions: questionsWithAudio.map((q) => ({
            questionId: q.questionId,
            type: q.type,
            targetSkill: q.targetSkill,
            difficulty: q.difficulty,
          })),
          modelUsed: result.modelUsed,
          qualityScore: result.qualityScore,
          validationFailures: result.validationFailures,
          repairAttempts: result.repairAttempts,
          generationLatencyMs: result.generationLatencyMs,
        });
      }

      // Fire-and-forget: ingest incremental questions to pool
      ctx
        .runAction(internal.questionPool.ingestQuestionsToPool, {
          language: args.language,
          questions: result.questions.map((q) => ({
            questionType: q.type,
            targetSkill: q.targetSkill,
            difficulty: q.difficulty ?? args.targetDifficulty,
            question: q.question,
            passageText: q.passageText ?? undefined,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            acceptableAnswers: q.acceptableAnswers ?? undefined,
            points: q.points,
            grammarTags: q.grammarTags ?? undefined,
            vocabTags: q.vocabTags ?? undefined,
            topicTags: q.topicTags ?? undefined,
            translations: q.translations,
            optionTranslations: q.optionTranslations,
            showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
          })),
          modelUsed: result.modelUsed,
          qualityScore: result.qualityScore,
        })
        .catch((e) => console.error("Pool ingestion failed:", e));

      return {
        questions: questionsWithAudio,
        modelUsed: result.modelUsed,
        systemPrompt,
        prompt,
        validationFailures: result.validationFailures,
        repairAttempts: result.repairAttempts,
        generationLatencyMs: result.generationLatencyMs,
        qualityScore: result.qualityScore,
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
    uiLanguage: v.optional(uiLanguageValidator),
  },
  handler: async (_ctx, args): Promise<{ score: number; feedback: string; isCorrect: boolean }> => {
    const languageNames: Record<string, string> = {
      japanese: "Japanese",
      english: "English",
      french: "French",
    };
    const languageName = languageNames[args.language] || "English";
    const uiLang = (args.uiLanguage ?? "en") as UILanguage;
    const feedbackLanguageName = getUILanguageName(uiLang);

    const systemPrompt = `You are a ${languageName} language teacher grading student responses.
Score the answer from 0-100 and provide brief, encouraging feedback.
Consider: grammar accuracy, vocabulary usage, and relevance to the question.
Provide ALL feedback and explanations in ${feedbackLanguageName}. Do NOT respond in English unless the feedback language is English.`;

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

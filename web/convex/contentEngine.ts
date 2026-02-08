"use node";

import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { generateAndParse, type JsonSchema, type ModelConfig, parseJson } from "./ai/models";
import { abilityToProficiency } from "./learnerModel";
import { TEXT_MODEL_CHAIN } from "./lib/models";
import { getStorageProvider } from "./lib/storage";
import {
  adaptiveContentTypeValidator,
  type ContentLanguage,
  languageValidator,
  learningGoalValidator,
} from "./schema";

// ============================================
// TYPES
// ============================================

type CandidateVocabulary = {
  word: string;
  reading?: string;
  meaning: string;
};

type CandidateContent = {
  title: string;
  content: string;
  translation: string;
  vocabulary: CandidateVocabulary[];
  grammarTags?: string[];
  dialogueTurns?: Array<{ speaker: string; line: string }>;
};

type EvaluationResult = {
  constraints: {
    coverage: number;
    newWordCount: number;
    grammarMatch: boolean;
    lengthOk: boolean;
  };
  scores: {
    difficultyFit: number;
    interestFit: number;
    clarity: number;
    novelty: number;
    total: number;
  };
};

type GradingResult = {
  score: number;
  feedback: string;
};

type ContentSpec = {
  difficultyTarget: number;
  vocabBudget: number;
  topicTags: string[];
  requiredGrammarTags: string[];
  goal?: string;
  mustUseWords: string[];
  preferWords: string[];
  targetWordCount: number;
  targetLevel: string;
  beginnerMode: boolean;
};

import type { WeakArea } from "./lib/promptHelpers";

type ContentItem = {
  contentId: string;
  contentType: "dialogue" | "micro_story";
  contentUrl: string;
  language: ContentLanguage;
  difficultyEstimate: number;
  topicTags: string[];
  avgScore: number;
  completionRate: number;
};

// ============================================
// CONSTANTS
// ============================================

const TARGET_COVERAGE = 0.85;
const REUSE_SCORE_THRESHOLD = 0.65;
const REPEAT_WINDOW_DAYS = 30;
const DEFAULT_NEW_WORD_BUDGET = 3;

// ============================================
// PUBLIC ACTIONS
// ============================================

export const getBestContent = action({
  args: {
    userId: v.string(),
    language: languageValidator,
    contentType: adaptiveContentTypeValidator,
    goal: v.optional(learningGoalValidator),
    topicTags: v.optional(v.array(v.string())),
    difficultyTarget: v.optional(v.number()),
    newWordBudget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: args.userId });
    const profile = await ctx.runQuery(internal.learnerModel.getProfileInternal, {
      userId: args.userId,
      language: args.language,
    });

    const goal = args.goal ?? user?.learningGoal;
    const hasPlacement =
      !!user?.proficiencyLevels?.[args.language as keyof typeof user.proficiencyLevels];
    const hasActivity = (profile?.totalStudyMinutes ?? 0) > 0;
    const isBeginner = !hasPlacement && !hasActivity;
    const baseAbility = profile?.abilityEstimate ?? (isBeginner ? -1.6 : 0);
    const baseDifficulty = args.difficultyTarget ?? baseAbility + 0.3;
    const difficultyTarget = isBeginner ? Math.min(baseDifficulty, -1.2) : baseDifficulty;
    const targetLevel = abilityToProficiency(difficultyTarget, args.language, false);

    const vocabBudget = args.newWordBudget ?? DEFAULT_NEW_WORD_BUDGET;
    const topicTags = args.topicTags ?? user?.interests ?? [];

    // Attempt reuse first
    const difficultyBuffer = 0.5;
    const reuseCandidates: ContentItem[] = (await ctx.runQuery(
      internal.contentEngineQueries.getReuseCandidates,
      {
        language: args.language,
        contentType: args.contentType,
        minDifficulty: difficultyTarget - difficultyBuffer,
        maxDifficulty: difficultyTarget + difficultyBuffer,
        goal,
      }
    )) as ContentItem[];

    const cutoff = now - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentExposureIds = new Set(
      await ctx.runQuery(internal.contentEngineQueries.getRecentExposureIds, {
        userId: args.userId,
        language: args.language,
        since: cutoff,
      })
    );

    const scoredReuse: { candidate: ContentItem; score: number }[] = reuseCandidates
      .filter((candidate) => !recentExposureIds.has(candidate.contentId))
      .map((candidate) => ({
        candidate,
        score: scoreReuseCandidate(candidate, difficultyTarget, topicTags),
      }))
      .sort((a, b) => b.score - a.score);

    if (scoredReuse.length > 0 && scoredReuse[0].score >= REUSE_SCORE_THRESHOLD) {
      return {
        contentId: scoredReuse[0].candidate.contentId,
        contentType: scoredReuse[0].candidate.contentType,
        contentUrl: scoredReuse[0].candidate.contentUrl,
        language: scoredReuse[0].candidate.language,
        source: "reused" as const,
      };
    }

    // Generate new content
    const runId = crypto.randomUUID();

    const vocabData = await ctx.runQuery(internal.lib.generation.getVocabularyForStoryGeneration, {
      userId: args.userId,
      language: args.language,
      learningWordsLimit: 5,
      knownWordsLimit: 100,
    });

    const requiredGrammarTags =
      profile?.weakAreas
        ?.filter((area: WeakArea) => area.skill === "grammar")
        .slice(0, 2)
        .map((area: WeakArea) => area.topic) ?? [];

    const targetWordCount =
      args.contentType === "dialogue" ? (isBeginner ? 80 : 120) : isBeginner ? 100 : 140;

    const spec: ContentSpec = {
      difficultyTarget,
      vocabBudget,
      topicTags,
      goal,
      requiredGrammarTags,
      mustUseWords: vocabData.mustUseWords,
      preferWords: vocabData.preferWords,
      targetWordCount,
      targetLevel,
      beginnerMode: isBeginner,
    };

    const selected = await generateCandidate(ctx, {
      runId,
      models: TEXT_MODEL_CHAIN,
      contentType: args.contentType,
      language: args.language,
      spec,
    });

    // Persist candidate
    await ctx.runMutation(internal.contentEngineQueries.insertContentCandidate, {
      runId,
      candidateId: selected.candidateId,
      modelId: selected.modelId,
      contentType: args.contentType,
      language: args.language,
      candidateUrl: selected.candidateUrl,
      constraints: selected.constraints,
      scores: selected.scores,
      gradingFeedback: selected.grading.feedback,
      gradingScore: selected.grading.score,
      selected: true,
    });

    await ctx.runMutation(internal.contentEngineQueries.insertSelectionRun, {
      runId,
      userId: args.userId,
      language: args.language,
      contentType: args.contentType,
      requestSpec: {
        difficultyTarget,
        vocabBudget,
        topicTags,
        goal,
      },
      candidateIds: [selected.candidateId],
      selectedCandidateId: selected.candidateId,
      selectionReason: "single candidate",
    });

    const finalContentUrl = await uploadJson(
      `adaptive-content/${args.language}/${args.contentType}/${selected.candidateId}/content.json`,
      selected.contentPayload
    );

    await ctx.runMutation(internal.contentEngineQueries.insertContentItem, {
      contentId: selected.candidateId,
      contentType: args.contentType,
      language: args.language,
      difficultyEstimate: difficultyTarget,
      vocabList: selected.vocabList,
      grammarTags: selected.grammarTags,
      topicTags,
      goalTags: goal ? [goal] : [],
      modelId: selected.modelId,
      contentUrl: finalContentUrl,
      audienceScope: goal ? "goal" : "global",
    });

    return {
      contentId: selected.candidateId,
      contentType: args.contentType,
      contentUrl: finalContentUrl,
      language: args.language,
      source: "generated" as const,
    };
  },
});

// ============================================
// HELPERS
// ============================================

function scoreReuseCandidate(
  candidate: {
    difficultyEstimate: number;
    topicTags: string[];
    avgScore: number;
    completionRate: number;
  },
  difficultyTarget: number,
  topicTags: string[]
): number {
  const difficultyFit = clamp(1 - Math.abs(candidate.difficultyEstimate - difficultyTarget), 0, 1);
  const interestFit = topicTags.length
    ? candidate.topicTags.filter((tag) => topicTags.includes(tag)).length / topicTags.length
    : 0.5;
  const clarity = clamp(candidate.avgScore / 100, 0, 1);
  const novelty = clamp(1 - candidate.completionRate, 0, 1);

  return 0.45 * difficultyFit + 0.25 * interestFit + 0.2 * clarity + 0.1 * novelty;
}

async function generateCandidate(
  _ctx: ActionCtx,
  args: {
    runId: string;
    models: ModelConfig[];
    contentType: "dialogue" | "micro_story";
    language: ContentLanguage;
    spec: ContentSpec;
  }
) {
  const candidateId = crypto.randomUUID();
  const schema = getSchema(args.contentType);
  const { prompt, systemPrompt } = buildPrompt(args);

  const generation = await generateAndParse<CandidateContent>({
    prompt,
    systemPrompt,
    maxTokens: 2500,
    jsonSchema: schema,
    models: args.models,
    parse: (response) => parseJson<CandidateContent>(response),
    validate: (parsed) => (!parsed.title || !parsed.content ? "Missing content" : null),
  });

  const content = generation.result;
  const vocabulary = content.vocabulary ?? [];
  const vocabList = vocabulary.map((v) => v.word);
  const grammarTags = content.grammarTags ?? [];
  const wordCount = vocabulary.length || content.content.split(/\s+/).length;

  const { constraints, scores } = evaluateCandidate({
    content,
    vocabList,
    grammarTags,
    wordCount,
    spec: args.spec,
  });

  const grading = await gradeCandidate({
    content,
    spec: args.spec,
  });

  const candidatePayload = {
    ...content,
    grammarTags,
    wordCount,
  };

  const candidateUrl = await uploadJson(
    `adaptive-content/${args.language}/${args.contentType}/candidates/${args.runId}/${candidateId}/content.json`,
    candidatePayload
  );

  return {
    candidateId,
    candidateUrl,
    modelId: generation.usage.model,
    contentPayload: candidatePayload,
    vocabList,
    grammarTags,
    contentUrl: candidateUrl,
    constraints,
    scores: {
      ...scores,
      clarity: clamp(grading.score / 100, 0, 1),
      total:
        0.45 * scores.difficultyFit +
        0.25 * scores.interestFit +
        0.2 * clamp(grading.score / 100, 0, 1) +
        0.1 * scores.novelty,
    },
    grading,
    gradingUsage: grading.usage,
    usage: generation.usage,
  };
}

function evaluateCandidate(args: {
  content: CandidateContent;
  vocabList: string[];
  grammarTags: string[];
  wordCount: number;
  spec: ContentSpec;
}): EvaluationResult {
  const knownWords = new Set([...args.spec.mustUseWords, ...args.spec.preferWords]);
  const newWordCount = args.vocabList.filter((word) => !knownWords.has(word)).length;
  const coverage = args.vocabList.length
    ? (args.vocabList.length - newWordCount) / args.vocabList.length
    : 1;

  const lengthOk =
    args.wordCount >= args.spec.targetWordCount * 0.8 &&
    args.wordCount <= args.spec.targetWordCount * 1.2;

  const grammarMatch =
    args.spec.requiredGrammarTags.length === 0 ||
    args.spec.requiredGrammarTags.some((tag) => args.grammarTags.includes(tag));

  const difficultyFit = clamp(1 - Math.abs(coverage - TARGET_COVERAGE) / 0.15, 0, 1);
  const interestFit = args.spec.topicTags.length ? 1 : 0.5;

  return {
    constraints: {
      coverage,
      newWordCount,
      grammarMatch,
      lengthOk,
    },
    scores: {
      difficultyFit,
      interestFit,
      clarity: 0,
      novelty: 1,
      total: 0,
    },
  };
}

function buildPrompt(args: {
  contentType: "dialogue" | "micro_story";
  language: ContentLanguage;
  spec: ContentSpec;
}) {
  const languageName =
    args.language === "japanese" ? "Japanese" : args.language === "french" ? "French" : "English";
  const topic = args.spec.topicTags[0] ?? "daily life";
  const mustUse = args.spec.mustUseWords.join(", ") || "none";
  const prefer = args.spec.preferWords.slice(0, 50).join(", ") || "any appropriate words";
  const requiredGrammar =
    args.spec.requiredGrammarTags.length > 0 ? args.spec.requiredGrammarTags.join(", ") : "none";
  const contentTypeLabel = args.contentType === "dialogue" ? "dialogue" : "short story";
  const beginnerNote = args.spec.beginnerMode
    ? "Keep sentences short, avoid rare vocabulary, and ensure the translation is clear."
    : "Keep the language natural for the target level.";

  const systemPrompt = `You are a language learning content creator.
Create a ${contentTypeLabel} in ${languageName} that is engaging, level-appropriate, and strictly follows the constraints.
Respond ONLY with valid JSON.`;

  const prompt = `Create a ${contentTypeLabel} in ${languageName}.

Topic: ${topic}
Goal: ${args.spec.goal ?? "general learning"}
Target difficulty (ability): ${args.spec.difficultyTarget.toFixed(2)}
Target proficiency level: ${args.spec.targetLevel}
Target word count: about ${args.spec.targetWordCount}
Beginner guidance: ${beginnerNote}

Words that MUST appear:
${mustUse}

Preferred vocabulary:
${prefer}

Maximum new words allowed: ${args.spec.vocabBudget}
Required grammar tags (if possible): ${requiredGrammar}

Return JSON with:
- title
- content
- translation (English)
- vocabulary: array of { word, reading (optional), meaning }
- grammarTags: array of short grammar labels
- dialogueTurns (only if contentType is dialogue; array of { speaker, line })`;

  return { prompt, systemPrompt };
}

function getSchema(contentType: "dialogue" | "micro_story"): JsonSchema {
  const base: Record<string, unknown> = {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      translation: { type: "string" },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            word: { type: "string" },
            reading: { type: ["string", "null"] },
            meaning: { type: "string" },
          },
          required: ["word", "reading", "meaning"],
          additionalProperties: false,
        },
      },
      grammarTags: { type: ["array", "null"], items: { type: "string" } },
    },
    required: ["title", "content", "translation", "vocabulary", "grammarTags"],
    additionalProperties: false,
  };

  if (contentType === "dialogue") {
    (base.properties as Record<string, unknown>).dialogueTurns = {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: { type: "string" },
          line: { type: "string" },
        },
        required: ["speaker", "line"],
        additionalProperties: false,
      },
    };
    (base.required as string[]).push("dialogueTurns");
  }

  return { name: "adaptive_content", schema: base };
}

async function gradeCandidate(args: { content: CandidateContent; spec: { vocabBudget: number } }) {
  const systemPrompt = `You are a strict evaluator for language learning content.
Score clarity and constraint adherence from 0 to 100 and provide a short feedback note.
Respond ONLY with valid JSON.`;

  const prompt = `Evaluate this content:

Content:
${args.content.content}

Vocabulary count: ${args.content.vocabulary?.length ?? 0}
Max new words: ${args.spec.vocabBudget}

Return JSON with:
- score (0-100)
- feedback (short)`;

  const gradingSchema: JsonSchema = {
    name: "content_grade",
    schema: {
      type: "object",
      properties: {
        score: { type: "number" },
        feedback: { type: "string" },
      },
      required: ["score", "feedback"],
      additionalProperties: false,
    },
  };

  const grading = await generateAndParse<GradingResult>({
    prompt,
    systemPrompt,
    maxTokens: 300,
    jsonSchema: gradingSchema,
    models: TEXT_MODEL_CHAIN,
    parse: (response) => parseJson<GradingResult>(response),
    validate: (parsed) => (parsed.score < 0 || parsed.score > 100 ? "Score out of range" : null),
  });

  return {
    score: grading.result.score,
    feedback: grading.result.feedback,
    usage: grading.usage,
  };
}

async function uploadJson(prefix: string, data: unknown): Promise<string> {
  const provider = getStorageProvider();
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  return provider.upload({
    data: encoded,
    contentType: "application/json",
    prefix,
    exactKey: true,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

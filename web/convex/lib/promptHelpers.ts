/**
 * Shared prompt helpers for AI question generation.
 *
 * All generation contexts (placement, adaptive practice, comprehension)
 * use these helpers for consistent language mixing, learner context,
 * distractor construction, and question stem variety.
 */

import type { ContentLanguage } from "../schema";

// ============================================
// TYPES
// ============================================

export type { ContentLanguage };

export type ProficiencyTier = "beginner" | "intermediate" | "advanced";

// UILanguage mirrors web/src/lib/i18n/types.ts but is defined here because
// Convex server code cannot import from the frontend src/ directory.
// Keep in sync with uiLanguageValidator in schema.ts.
export type UILanguage = "en" | "ja" | "fr" | "zh";

interface WeakArea {
  skill: string;
  topic: string;
  score: number;
}

interface InterestWeight {
  tag: string;
  weight: number;
}

export interface LearnerContext {
  abilityEstimate: number;
  weakAreas?: WeakArea[];
  interestWeights?: InterestWeight[];
  examType?: string;
  vocabCoverage?: {
    targetLevel: string;
    totalWords: number;
    known: number;
    learning: number;
    unknown: number;
  };
  difficultyCalibration?: {
    targetAccuracy: number;
    recentAccuracy: number;
  };
  skills?: Record<string, number>;
}

// ============================================
// LANGUAGE / NAME MAPS
// ============================================

/** UI language display names — matches uiLanguageNames in ai/core.ts */
const UI_LANGUAGE_NAMES: Record<UILanguage, string> = {
  en: "English",
  ja: "日本語",
  fr: "français",
  zh: "中文",
};

/** Content language display names — matches languageNames in ai/core.ts */
const CONTENT_LANGUAGE_NAMES: Record<ContentLanguage, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

export function getUILanguageName(uiLang: UILanguage): string {
  return UI_LANGUAGE_NAMES[uiLang] ?? "English";
}

export function getContentLanguageName(lang: ContentLanguage): string {
  return CONTENT_LANGUAGE_NAMES[lang] ?? "English";
}

// ============================================
// PROFICIENCY TIER
// ============================================

/**
 * Determine proficiency tier from IRT ability estimate.
 * Beginner: < -1.0  (N5 / A1-A2)
 * Intermediate: -1.0 to 1.0  (N4-N3 / B1-B2)
 * Advanced: >= 1.0  (N2-N1 / C1-C2)
 */
export function getProficiencyTier(abilityEstimate: number): ProficiencyTier {
  if (abilityEstimate < -1.0) return "beginner";
  if (abilityEstimate < 1.0) return "intermediate";
  return "advanced";
}

// ============================================
// LANGUAGE MIXING DIRECTIVE
// ============================================

/**
 * Build the language mixing directive block for AI prompts.
 * Controls when questions use the target language (TL) vs the user's language (L1).
 */
export function buildLanguageMixingDirective(
  uiLanguage: UILanguage,
  abilityEstimate: number,
  targetLanguage: ContentLanguage
): string {
  const tier = getProficiencyTier(abilityEstimate);
  const l1Name = getUILanguageName(uiLanguage);
  const tlName = getContentLanguageName(targetLanguage);

  switch (tier) {
    case "beginner":
      return `LANGUAGE MIXING RULES (Beginner — ability ${abilityEstimate.toFixed(1)}):
- "question" field (instructions): write in ${l1Name}
- "passageText" field (sentences, example contexts): write in ${tlName}
- Answer options (MCQ): write in ${tlName}
- Always include "questionTranslation" as a ${l1Name} translation
- Fill-in-blank: instruction in "question" (${l1Name}), sentence with ___ in "passageText" (${tlName})
- Translation direction: ${l1Name} → ${tlName}
- Listening questions: audio in ${tlName}, question and options in ${l1Name}`;

    case "intermediate":
      return `LANGUAGE MIXING RULES (Intermediate — ability ${abilityEstimate.toFixed(1)}):
- "question" field (instructions): write in ${tlName} using simpler grammar than the tested level
- "passageText" field (sentences, example contexts): write in ${tlName}
- Answer options: write in ${tlName}
- Include "questionTranslation" as a ${l1Name} translation (scaffold)
- Fill-in-blank: instruction in "question" (${tlName}), sentence with ___ in "passageText" (${tlName})
- Translation: both directions (${l1Name} ↔ ${tlName})
- Listening questions: audio and question in ${tlName}`;

    case "advanced":
      return `LANGUAGE MIXING RULES (Advanced — ability ${abilityEstimate.toFixed(1)}):
- Everything in ${tlName} — "question", "passageText", options, instructions
- Do NOT include "questionTranslation" unless the question type requires it
- Translation: ${tlName} → ${l1Name}, or ${tlName} paraphrasing
- Listening questions: everything in ${tlName}`;
  }
}

// ============================================
// LEARNER CONTEXT BLOCK
// ============================================

/**
 * Format learner profile data into a prompt section.
 */
export function buildLearnerContextBlock(
  learnerContext: LearnerContext,
  levelHint: string
): string {
  const parts: string[] = [];

  parts.push(`LEARNER PROFILE:`);
  parts.push(
    `- Estimated level: ${levelHint} (ability: ${learnerContext.abilityEstimate.toFixed(1)})`
  );

  if (learnerContext.examType) {
    parts.push(`- Target exam: ${learnerContext.examType.replace("_", " ").toUpperCase()}`);
  }

  if (learnerContext.weakAreas && learnerContext.weakAreas.length > 0) {
    const weakStr = learnerContext.weakAreas
      .slice(0, 5)
      .map((w) => `${w.skill}/${w.topic} (${w.score}/100)`)
      .join(", ");
    parts.push(`- Weak areas: ${weakStr}`);
  }

  if (learnerContext.interestWeights && learnerContext.interestWeights.length > 0) {
    const interests = learnerContext.interestWeights
      .filter((iw) => iw.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((iw) => iw.tag);
    if (interests.length > 0) {
      parts.push(`- Interests: ${interests.join(", ")}`);
    }
  }

  if (learnerContext.skills) {
    const skillStr = Object.entries(learnerContext.skills)
      .map(([s, v]) => `${s}: ${v}`)
      .join(", ");
    parts.push(`- Skill scores: ${skillStr}`);
  }

  if (learnerContext.vocabCoverage) {
    const vc = learnerContext.vocabCoverage;
    parts.push(
      `- Vocab coverage (${vc.targetLevel}): ${vc.known} known, ${vc.learning} learning, ${vc.unknown} unknown of ${vc.totalWords}`
    );
  }

  if (learnerContext.difficultyCalibration) {
    const dc = learnerContext.difficultyCalibration;
    if (dc.recentAccuracy > dc.targetAccuracy + 10) {
      parts.push(
        `- Note: Recent accuracy (${dc.recentAccuracy}%) is well above target (${dc.targetAccuracy}%). Lean slightly harder.`
      );
    } else if (dc.recentAccuracy < dc.targetAccuracy - 10) {
      parts.push(
        `- Note: Recent accuracy (${dc.recentAccuracy}%) is below target (${dc.targetAccuracy}%). Lean slightly easier.`
      );
    }
  }

  return parts.join("\n");
}

// ============================================
// DISTRACTOR RULES
// ============================================

/**
 * Get language-specific distractor examples for MCQ construction.
 */
function getLanguageSpecificDistractorExamples(language: ContentLanguage): string {
  switch (language) {
    case "japanese":
      return `Japanese-specific distractor patterns:
  - Visually similar kanji (e.g., 待 vs 持, 読 vs 続)
  - Particle confusion (は/が, に/で, を/が)
  - Verb form confusion (te-form/ta-form/nai-form)
  - Multiple readings of the same kanji (音読み vs 訓読み)
  - Counter word confusion`;

    case "french":
      return `French-specific distractor patterns:
  - Gender errors (le/la, un/une)
  - Agreement errors (adjective/noun, subject/verb)
  - Tense confusion (passé composé vs imparfait)
  - False cognates with English (attendre ≠ attend)
  - Preposition confusion (à/de/en)`;

    case "english":
      return `English-specific distractor patterns:
  - Phrasal verb confusion (look up / look after / look into)
  - Collocation errors (make/do, say/tell)
  - Tense confusion (present perfect vs simple past)
  - Article errors (a/an/the/∅)
  - Preposition confusion (in/on/at)`;
  }
}

/**
 * Build distractor construction rules for MCQ questions.
 */
export function buildDistractorRules(targetLanguage: ContentLanguage, level: string): string {
  const examples = getLanguageSpecificDistractorExamples(targetLanguage);

  return `DISTRACTOR RULES (for every MCQ):
Construct 3 wrong answers following this pattern:
1. NEAR MISS: Similar form, sound, or meaning to correct answer (catches partial knowledge)
2. LEVEL ERROR: A common mistake for ${level} learners (catches known misconceptions)
3. SEMANTIC FIELD: Same topic/category but clearly different meaning (catches guessing)

All distractors must be the same part of speech and similar length as the correct answer.
Do NOT include obviously wrong or absurd options.

${examples}`;
}

// ============================================
// STEM VARIETY RULES
// ============================================

/**
 * Build question stem variety directive.
 */
export function buildStemVarietyRules(): string {
  return `STEM VARIETY RULES:
- Each question must use a DIFFERENT stem pattern from the others
- Do NOT start multiple questions with the same phrase
- Avoid generic stems like "Choose the correct answer" or "Select the right option"
- Distribute across cognitive levels: ~30% recall, ~40% understand, ~30% apply/analyze

Vocabulary stem examples: definition matching, context usage, synonym identification, gap completion, word-in-context, odd-one-out
Grammar stem examples: form selection, error identification, transformation, meaning implication, contextual choice
Comprehension stem examples: main idea, detail retrieval, inference, author intent, vocabulary in context, cause/effect`;
}

// ============================================
// WEAK AREA TARGETING
// ============================================

/**
 * Build weak area targeting instructions for diagnostic prompts.
 */
export function buildWeakAreaTargeting(weakAreas: WeakArea[]): string {
  if (weakAreas.length === 0) return "";

  const targets = weakAreas
    .slice(0, 3)
    .map(
      (w) => `- Include at least one question testing ${w.skill}/${w.topic} (score: ${w.score}/100)`
    )
    .join("\n");

  return `WEAK AREA TARGETING:\n${targets}`;
}

/**
 * Build interest theming instructions.
 */
export function buildInterestTheming(interests: string[]): string {
  if (interests.length === 0) return "";
  return `CONTENT THEMING:\nWhere possible, use themes related to: ${interests.join(", ")}`;
}

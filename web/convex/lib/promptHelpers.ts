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

/** Translation map: question text translated into each UI language */
export type TranslationMap = Record<UILanguage, string>;

/** Option translations: MCQ options translated into each UI language */
export type OptionTranslationMap = Record<UILanguage, string[]>;

export interface WeakArea {
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
  learningGoal?: string; // "exam" | "travel" | "professional" | "media" | "casual"
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
export const UI_LANGUAGE_NAMES: Record<UILanguage, string> = {
  en: "English",
  ja: "日本語",
  fr: "français",
  zh: "中文",
};

/** All supported UI languages, derived from UI_LANGUAGE_NAMES keys */
export const SUPPORTED_UI_LANGUAGES: UILanguage[] = Object.keys(UI_LANGUAGE_NAMES) as UILanguage[];

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
// LEARNING GOAL DIRECTIVE
// ============================================

/**
 * Build a prompt block that steers AI generation toward the user's learning goal.
 */
export function buildGoalDirective(goal: string): string {
  const directives: Record<string, string> = {
    travel:
      "LEARNING GOAL: Travel & conversation.\nPrioritize practical, real-world scenarios: ordering food, asking for directions, booking hotels, handling emergencies. Favor listening comprehension and speaking/pronunciation questions. Use dialogue-style contexts where possible.",
    professional:
      "LEARNING GOAL: Business & workplace.\nPrioritize professional scenarios: emails, meetings, presentations, workplace interactions. Include formal register and business vocabulary. Favor reading comprehension and writing questions.",
    media:
      "LEARNING GOAL: Entertainment & media consumption.\nPrioritize understanding native-speed content: anime, films, books, music, social media. Include colloquial expressions, slang, and cultural references. Favor listening and reading comprehension.",
    exam: "LEARNING GOAL: Exam preparation.\nPrioritize exam-style question formats and systematic coverage of tested grammar/vocabulary. Include questions that mirror official exam patterns.",
    casual:
      "LEARNING GOAL: General exploration.\nProvide a balanced mix of everyday conversation, cultural context, and practical language use.",
  };
  return directives[goal] ?? "";
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

  // Build dynamic language list for translations instruction
  const langListStr = SUPPORTED_UI_LANGUAGES.map(
    (lang) => `${lang} (${UI_LANGUAGE_NAMES[lang]})`
  ).join(", ");

  const translationsInstruction = `Always include a "translations" object with the question text translated into ALL UI languages: ${langListStr}.
For MCQ questions: include "optionTranslations" with each option translated into all UI languages (same order as "options"). For non-MCQ: set "optionTranslations" to null.
- Set "showOptionsInTargetLanguage": true = options display in ${tlName}, false = options display in the user's UI language. Choose based on whether showing a translation would reveal the correct answer. Always generate optionTranslations regardless (needed for pool reuse).`;

  switch (tier) {
    case "beginner":
      return `LANGUAGE MIXING RULES (Beginner — ability ${abilityEstimate.toFixed(1)}):
- "question" field: always write in ${tlName}
- "passageText" field (sentences, example contexts): write in ${tlName}
- Answer options (MCQ): write in ${tlName}
- ${translationsInstruction}
- Translations are ESSENTIAL — beginners will primarily read these to understand questions
- Fill-in-blank: instruction in "question" (${tlName}), sentence with ___ in "passageText" (${tlName})
- Translation direction: ${l1Name} → ${tlName}
- Listening questions: audio in ${tlName}, question in ${tlName}`;

    case "intermediate":
      return `LANGUAGE MIXING RULES (Intermediate — ability ${abilityEstimate.toFixed(1)}):
- "question" field: write in ${tlName} using simpler grammar than the tested level
- "passageText" field (sentences, example contexts): write in ${tlName}
- Answer options: write in ${tlName}
- ${translationsInstruction}
- Fill-in-blank: instruction in "question" (${tlName}), sentence with ___ in "passageText" (${tlName})
- Translation: both directions (${l1Name} ↔ ${tlName})
- Listening questions: audio and question in ${tlName}`;

    case "advanced":
      return `LANGUAGE MIXING RULES (Advanced — ability ${abilityEstimate.toFixed(1)}):
- Everything in ${tlName} — "question", "passageText", options, instructions
- ${translationsInstruction}
- Note: translations are still required for pool reuse, but won't be displayed to this learner
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

  if (learnerContext.learningGoal) {
    parts.push(`- Learning goal: ${learnerContext.learningGoal}`);
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
// DIFFICULTY ANCHORS
// ============================================

/**
 * Per-language difficulty anchors with concrete vocabulary, grammar, and sentence-length
 * specifications for each of the 6 difficulty levels.
 */
const DIFFICULTY_ANCHORS: Record<ContentLanguage, Record<string, string>> = {
  japanese: {
    level_1:
      "N5 vocabulary (top 800 words), hiragana/katakana + basic kanji (~80), sentences <10 characters, ます/です forms only, simple SOV patterns",
    level_2:
      "N4 vocabulary (top 1500 words), ~150 kanji, 10-20 character sentences, て-form, basic conditionals (たら), たい/ている forms",
    level_3:
      "N3 vocabulary (top 3000 words), ~350 kanji, 15-30 character sentences, passive/causative, compound sentences, ようにする/ことがある",
    level_4:
      "N2 vocabulary (top 6000 words), ~650 kanji, 20-40 character sentences, complex grammar (ばかりに, にもかかわらず, 一方で), formal register",
    level_5:
      "N1 vocabulary (10000+ words), ~1000+ kanji, 30+ character sentences, literary/formal patterns (べからず, ごとく), idiomatic expressions, classical grammar influence",
    level_6:
      "Beyond N1: 12000+ words, literary/classical Japanese, 40+ character sentences, archaic patterns, domain-specific jargon",
  },
  french: {
    level_1:
      "A1 vocabulary (top 500 words), présent tense only, sentences <8 words, basic SVO, être/avoir, definite/indefinite articles",
    level_2:
      "A2 vocabulary (top 1200 words), passé composé, 8-15 word sentences, futur proche, basic negation, common reflexive verbs",
    level_3:
      "B1 vocabulary (top 3000 words), imparfait vs passé composé, 12-22 word sentences, subjonctif (basic triggers), relative clauses (qui/que)",
    level_4:
      "B2 vocabulary (top 5000 words), conditionnel, 18-30 word sentences, subjonctif (full range), passive voice, complex adverbial phrases",
    level_5:
      "C1 vocabulary (8000+ words), literary tenses (passé simple), 25+ word sentences, formal register, nuanced connectors, complex argumentation",
    level_6:
      "C2 vocabulary (10000+ words), plus-que-parfait du subjonctif, 30+ word sentences, idiomatic and figurative language, academic/literary register, nuanced collocations",
  },
  english: {
    level_1:
      "A1 vocabulary (top 500 words), present simple/continuous, sentences <8 words, basic SVO, common prepositions",
    level_2:
      "A2 vocabulary (top 1200 words), past simple, 8-15 word sentences, comparatives/superlatives, basic modal verbs (can/must)",
    level_3:
      "B1 vocabulary (top 3000 words), present perfect vs past simple, 12-22 word sentences, passive voice, conditionals (1st/2nd), phrasal verbs",
    level_4:
      "B2 vocabulary (top 5000 words), reported speech, 18-30 word sentences, 3rd conditional, complex relative clauses, advanced modal verbs (would have/might have)",
    level_5:
      "C1 vocabulary (8000+ words), 25+ word sentences, subjunctive mood, inversion for emphasis, idiomatic and figurative language, formal register, nuanced collocations",
    level_6:
      "C2 vocabulary (10000+ words), 30+ word sentences, academic/literary register, subtle pragmatic distinctions, domain-specific terminology, stylistic mastery",
  },
};

/**
 * Build difficulty level specifications for AI prompts.
 * Provides concrete per-level linguistic anchors so the AI has calibration targets.
 */
export function buildDifficultyAnchors(language: ContentLanguage): string {
  const anchors = DIFFICULTY_ANCHORS[language];
  return `DIFFICULTY LEVEL SPECIFICATIONS:
- level_1: ${anchors.level_1}
- level_2: ${anchors.level_2}
- level_3: ${anchors.level_3}
- level_4: ${anchors.level_4}
- level_5: ${anchors.level_5}
- level_6: ${anchors.level_6}`;
}

/**
 * Build a targeted difficulty block for incremental question generation.
 * Provides the AI with both the categorical level and continuous IRT value.
 */
export function buildTargetDifficultyBlock(
  abilityEstimate: number,
  targetDifficulty: string,
  language: ContentLanguage
): string {
  const anchors = DIFFICULTY_ANCHORS[language];
  const anchor = anchors[targetDifficulty] ?? anchors.level_3;
  return `TARGET DIFFICULTY: "${targetDifficulty}" (IRT ability estimate: ${abilityEstimate.toFixed(1)})
Generate questions matching these constraints: ${anchor}
Questions should be calibrated so a learner at ability ${abilityEstimate.toFixed(1)} has roughly 65-75% chance of answering correctly.`;
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

// ============================================
// FORMATTING RULES
// ============================================

/**
 * Build plain-text formatting rules for AI question generation prompts.
 * Prevents markdown formatting in generated questions, options, and explanations.
 */
export function buildFormattingRules(): string {
  return `FORMATTING RULES:
- Use plain text only. Do NOT use markdown formatting (no **bold**, *italic*, __underline__, ~~strikethrough~~, \`code\`, or any other markup).
- Do NOT use bullet points or numbered lists in question text or answer options.
- Do NOT refer to visual text effects (e.g., "the highlighted word", "the underlined phrase", "the bolded text"). All text is rendered as plain text with no visual emphasis.`;
}

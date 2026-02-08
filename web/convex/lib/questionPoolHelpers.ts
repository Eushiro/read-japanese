"use node";

/**
 * Helpers for the question pool: embedding text construction,
 * content hashing for deduplication, and query embedding builders.
 */

import { createHash } from "crypto";

import type { ContentLanguage, DifficultyLevel, PracticeQuestionType, SkillType } from "../schema";
import type { WeakArea } from "./promptHelpers";

// ============================================
// TYPES
// ============================================

interface PoolQuestion {
  questionType: PracticeQuestionType;
  targetSkill: SkillType;
  difficulty: DifficultyLevel;
  question: string;
  passageText?: string | null;
  correctAnswer: string;
  options?: string[] | null;
  grammarTags?: string[];
  vocabTags?: string[];
  topicTags?: string[];
}

interface LearnerQueryContext {
  language: ContentLanguage;
  targetSkill?: SkillType;
  difficulty?: DifficultyLevel;
  weakAreas?: WeakArea[];
  interests?: string[];
  abilityEstimate?: number;
}

// ============================================
// EMBEDDING TEXT BUILDERS
// ============================================

/**
 * Build a composite text representation of a question for embedding.
 * Combines question text, metadata, and tags into a single embeddable string.
 */
export function buildEmbeddingText(question: PoolQuestion): string {
  const parts: string[] = [];

  parts.push(`[${question.questionType}] [${question.targetSkill}] [${question.difficulty}]`);

  if (question.passageText) {
    parts.push(question.passageText);
  }

  parts.push(question.question);
  parts.push(`Answer: ${question.correctAnswer}`);

  if (question.grammarTags?.length) {
    parts.push(`Grammar: ${question.grammarTags.join(", ")}`);
  }
  if (question.vocabTags?.length) {
    parts.push(`Vocabulary: ${question.vocabTags.join(", ")}`);
  }
  if (question.topicTags?.length) {
    parts.push(`Topics: ${question.topicTags.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Build an "ideal question" description from a learner profile for query embedding.
 * This text describes what kind of question would be most useful for the learner.
 */
export function buildQueryEmbeddingText(context: LearnerQueryContext): string {
  const parts: string[] = [];

  parts.push(`Language: ${context.language}`);

  if (context.difficulty) {
    parts.push(`Difficulty: ${context.difficulty}`);
  }

  if (context.targetSkill) {
    parts.push(`Skill: ${context.targetSkill}`);
  }

  if (context.weakAreas?.length) {
    const weakTopics = context.weakAreas
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((w) => `${w.skill}: ${w.topic}`);
    parts.push(`Weak areas to practice: ${weakTopics.join(", ")}`);
  }

  if (context.interests?.length) {
    parts.push(`Topics of interest: ${context.interests.join(", ")}`);
  }

  return parts.join("\n");
}

// ============================================
// HASHING
// ============================================

/**
 * Deterministic SHA-256 hash of question content for deduplication.
 * Only hashes the content that makes the question unique (not metadata like tags).
 */
export function hashQuestionContent(question: {
  questionType: string;
  question: string;
  passageText?: string | null;
  correctAnswer: string;
  options?: string[] | null;
}): string {
  // Canonical representation: sorted options, trimmed text
  const canonical = {
    type: question.questionType,
    q: question.question.trim(),
    p: question.passageText?.trim() ?? "",
    a: question.correctAnswer.trim(),
    o: question.options ? [...question.options].sort().map((o) => o.trim()) : [],
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

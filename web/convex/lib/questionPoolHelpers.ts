"use node";

/**
 * Helpers for the question pool: content hashing and candidate scoring.
 */

import { createHash } from "crypto";

import type { DifficultyLevel, PracticeQuestionType, SkillType } from "../schema";
import { LABEL_TO_IRT } from "./difficultyEstimator";

// ============================================
// TYPES
// ============================================

/** Shape of a pool question document returned by getPoolCandidatesWithCount */
export interface PoolQuestionDoc {
  _id: string;
  questionHash: string;
  questionType: PracticeQuestionType;
  targetSkill: SkillType;
  difficulty: DifficultyLevel;
  question: string;
  passageText?: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  points: number;
  totalResponses: number;
  correctResponses: number;
  empiricalDifficulty?: number;
  discrimination?: number;
  translations?: Record<string, string>;
  optionTranslations?: Record<string, string[]> | null;
  showOptionsInTargetLanguage?: boolean;
  grammarTags: string[];
  vocabTags: string[];
  topicTags: string[];
  isStandalone: boolean;
}

// ============================================
// SCORING
// ============================================

/**
 * Score a candidate question for selection.
 * Weighted sum: IRT information (40%), difficulty fit (25%),
 * tag overlap relevance (20%), discrimination (15%).
 */
export function scoreCandidate(
  doc: PoolQuestionDoc,
  ability: number,
  targetGrammar: Set<string>,
  targetVocab: Set<string>,
  targetTopics: Set<string>
): number {
  const isCalibrated = doc.totalResponses >= 20;
  const diffIRT = doc.empiricalDifficulty ?? LABEL_TO_IRT[doc.difficulty];
  const disc = doc.discrimination ?? 1.0;

  // IRT Fisher information: I(θ) = a² × P(θ) × (1 - P(θ))
  let irtScore = 0;
  if (isCalibrated) {
    const p = 1 / (1 + Math.exp(-disc * (ability - diffIRT)));
    const info = disc * disc * p * (1 - p);
    irtScore = Math.min(info, 1);
  }

  // Difficulty fit: how close is the question's difficulty to optimal?
  const diffGap = Math.abs(diffIRT - ability);
  const diffFit = Math.max(0, 1 - diffGap / 3);

  // Tag overlap relevance (replaces vector similarity)
  const relevance = computeTagOverlap(doc, targetGrammar, targetVocab, targetTopics);

  // Discrimination quality
  const discScore = isCalibrated ? Math.min(disc / 2, 1) : 0.5;

  // Exploration bonus for uncalibrated questions
  const explorationBonus = doc.totalResponses < 20 ? 0.15 : 0;

  if (isCalibrated) {
    return 0.4 * irtScore + 0.25 * diffFit + 0.2 * relevance + 0.15 * discScore;
  } else {
    return 0.35 * diffFit + 0.35 * relevance + 0.15 * discScore + explorationBonus;
  }
}

/**
 * Compute weighted Jaccard tag overlap between a question and target tag sets.
 * Weights: grammar 40%, vocab 30%, topic 30%.
 * Returns 0-1 score.
 */
export function computeTagOverlap(
  doc: { grammarTags: string[]; vocabTags: string[]; topicTags: string[] },
  targetGrammar: Set<string>,
  targetVocab: Set<string>,
  targetTopics: Set<string>
): number {
  const grammarOverlap = jaccard(new Set(doc.grammarTags), targetGrammar);
  const vocabOverlap = jaccard(new Set(doc.vocabTags), targetVocab);
  const topicOverlap = jaccard(new Set(doc.topicTags), targetTopics);

  return 0.4 * grammarOverlap + 0.3 * vocabOverlap + 0.3 * topicOverlap;
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B|, returns 0 if both sets are empty. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
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

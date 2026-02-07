/**
 * Post-generation heuristic difficulty estimator.
 *
 * Returns a continuous IRT difficulty estimate (-3 to +3) for a practice question
 * by blending the AI's categorical label (60% weight) with surface-level heuristics
 * (40% weight). No AI calls — runs synchronously in <5ms.
 */

import type { DifficultyLevel } from "../schema";

interface QuestionInput {
  difficulty?: string;
  question: string;
  passageText?: string | null;
  correctAnswer: string;
  options?: string[] | null;
  type: string;
}

const LABEL_TO_IRT: Record<DifficultyLevel, number> = {
  level_1: -2.5,
  level_2: -1.5,
  level_3: -0.5,
  level_4: 0.5,
  level_5: 1.5,
  level_6: 2.5,
};

function labelToIRT(label?: string): number {
  return LABEL_TO_IRT[label as DifficultyLevel] ?? 0.0;
}

/**
 * Count CJK characters (kanji/hanzi) in a string.
 * CJK Unified Ideographs: U+4E00–U+9FFF
 */
function countKanji(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x4e00 && code <= 0x9fff) count++;
  }
  return count;
}

/**
 * Approximate clause count by counting clause-level delimiters.
 */
function countClauses(text: string): number {
  // Japanese: 、。が but also commas, periods, conjunctions
  const delimiters = /[、,;。.！？!?]/g;
  const matches = text.match(delimiters);
  return (matches?.length ?? 0) + 1; // at least 1 clause
}

/**
 * Estimate question difficulty as a continuous IRT value.
 *
 * @param question - The practice question object
 * @param language - The content language ("japanese" | "english" | "french")
 * @returns A continuous difficulty estimate in range [-3, +3]
 */
export function estimateQuestionDifficulty(question: QuestionInput, language: string): number {
  // Base: AI's categorical label (60% weight)
  const aiBase = labelToIRT(question.difficulty);

  // Heuristic adjustments (will be combined at 40% weight)
  let heuristicScore = 0;
  let factors = 0;

  const fullText = [question.question, question.passageText ?? ""].join(" ");
  const answerText = question.correctAnswer;

  // --- Text length factor ---
  const charCount = fullText.length;
  let lengthScore: number;
  if (language === "japanese") {
    // Japanese characters carry more information density
    if (charCount < 15) lengthScore = -2.0;
    else if (charCount < 30) lengthScore = -1.0;
    else if (charCount < 60) lengthScore = 0.0;
    else if (charCount < 100) lengthScore = 1.0;
    else lengthScore = 2.0;
  } else {
    // Word count for alphabetic languages
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 8) lengthScore = -2.0;
    else if (wordCount < 15) lengthScore = -1.0;
    else if (wordCount < 25) lengthScore = 0.0;
    else if (wordCount < 40) lengthScore = 1.0;
    else lengthScore = 2.0;
  }
  heuristicScore += lengthScore;
  factors++;

  // --- Japanese-specific: kanji density ---
  if (language === "japanese") {
    const kanji = countKanji(fullText);
    const totalChars = [...fullText].length || 1;
    const kanjiRatio = kanji / totalChars;

    let kanjiScore: number;
    if (kanjiRatio < 0.05) kanjiScore = -2.0;
    else if (kanjiRatio < 0.15) kanjiScore = -1.0;
    else if (kanjiRatio < 0.3) kanjiScore = 0.0;
    else if (kanjiRatio < 0.45) kanjiScore = 1.0;
    else kanjiScore = 2.0;

    heuristicScore += kanjiScore;
    factors++;
  }

  // --- Clause complexity ---
  const clauses = countClauses(fullText);
  let clauseScore: number;
  if (clauses <= 1) clauseScore = -1.5;
  else if (clauses <= 2) clauseScore = -0.5;
  else if (clauses <= 3) clauseScore = 0.5;
  else clauseScore = 1.5;
  heuristicScore += clauseScore;
  factors++;

  // --- Answer complexity ---
  const answerLength = answerText.length;
  let answerScore: number;
  if (language === "japanese") {
    if (answerLength <= 3) answerScore = -1.0;
    else if (answerLength <= 8) answerScore = 0.0;
    else answerScore = 1.0;
  } else {
    const answerWords = answerText.split(/\s+/).filter(Boolean).length;
    if (answerWords <= 2) answerScore = -1.0;
    else if (answerWords <= 5) answerScore = 0.0;
    else answerScore = 1.0;
  }
  heuristicScore += answerScore;
  factors++;

  // Normalize heuristic to roughly [-2, +2]
  const heuristicAvg = factors > 0 ? heuristicScore / factors : 0;

  // Blend: 60% AI label, 40% heuristic
  const blended = 0.6 * aiBase + 0.4 * heuristicAvg;

  // Clamp to [-3, +3]
  return Math.max(-3, Math.min(3, blended));
}

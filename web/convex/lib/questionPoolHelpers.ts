"use node";

/**
 * Helpers for the question pool: content hashing for deduplication.
 */

import { createHash } from "crypto";

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

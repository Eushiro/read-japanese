// Shared types for practice question components

import type { UILanguage } from "@/lib/i18n/types";

import type { DifficultyLevel } from "../../../convex/schema";

export type { DifficultyLevel };

export interface PracticeQuestion {
  questionId: string;
  type: string;
  targetSkill: string;
  difficulty?: DifficultyLevel;
  difficultyNumeric?: number;
  question: string;
  passageText?: string;
  /** @deprecated Use translations[uiLanguage] instead */
  questionTranslation?: string;
  /** Question text translated into each UI language */
  translations?: Record<UILanguage, string>;
  /** MCQ option translations into each UI language (null for non-MCQ) */
  optionTranslations?: Record<UILanguage, string[]> | null;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  audioUrl?: string;
  points: number;
  // Pool tracking (SHA-256 of canonical content, for pool stat updates)
  questionHash: string;
}

export interface PracticeContent {
  contentId: string;
  contentType: "dialogue" | "micro_story";
  title: string;
  content: string;
  translation: string;
  vocabulary: Array<{ word: string; reading?: string; meaning: string }>;
  audioUrl?: string;
}

export type QuestionResult = "correct" | "partial" | "incorrect" | null;

export interface QuestionViewProps {
  question: PracticeQuestion;
  content: PracticeContent;
  language: string;
  totalQuestions: number;
  currentIndex: number;
  previousResults: QuestionResult[];
  showFeedback: boolean;
  isSubmitting: boolean;
  currentAnswer: {
    isCorrect: boolean;
    earnedPoints: number;
    feedback?: string;
    userAnswer?: string;
  } | null;
  selectedAnswer: string;
  onSelectAnswer: (answer: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onGoToQuestion?: (index: number) => void;
  isLastQuestion: boolean;
  /** Whether more questions are being generated (diagnostic mode) */
  isGeneratingMore?: boolean;
  /** Message to display when generating more questions */
  generatingMessage?: string;
}

/** Get font family based on content language */
export function getFontFamily(language: string) {
  return language === "japanese" ? "var(--font-japanese)" : "inherit";
}

/**
 * Split a fill-in-blank question on "___" marker.
 * Returns { before, after } or null if no blank found.
 */
export function splitBlankQuestion(question: string): { before: string; after: string } | null {
  const marker = "___";
  const idx = question.indexOf(marker);
  if (idx === -1) return null;
  return {
    before: question.substring(0, idx),
    after: question.substring(idx + marker.length),
  };
}

/**
 * Simple character-level diff for dictation grading display.
 */
export function getDiff(input: string, correct: string) {
  const result: { char: string; status: "match" | "wrong" | "missing" | "extra" }[] = [];
  const maxLen = Math.max(input.length, correct.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < input.length && i < correct.length) {
      if (input[i] === correct[i]) {
        result.push({ char: correct[i], status: "match" });
      } else {
        result.push({ char: correct[i], status: "wrong" });
      }
    } else if (i >= correct.length && i < input.length) {
      result.push({ char: input[i], status: "extra" });
    } else if (i >= input.length) {
      result.push({ char: correct[i], status: "missing" });
    }
  }
  return result;
}

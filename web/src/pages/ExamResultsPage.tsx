import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ExamResultsPage() {
  const t = useT();
  const { templateId, attemptId } = useParams({
    from: "/exams/$templateId/results/$attemptId",
  });
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Get attempt with full details
  const attempt = useQuery(api.examAttempts.get, {
    attemptId: attemptId as Id<"examAttempts">,
  });

  const toggleQuestion = (index: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!attempt) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-pulse text-foreground-muted">{t("examResults.loading")}</div>
      </div>
    );
  }

  const passed = attempt.passed;
  const percentScore = attempt.percentScore || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          to="/exams"
          className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("examResults.backToExams")}
        </Link>

        {/* Results Header */}
        <div
          className={`rounded-xl p-8 mb-8 text-center ${
            passed
              ? "bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30"
              : "bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30"
          }`}
        >
          <div className="mb-4">
            {passed ? (
              <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
            ) : (
              <Target className="w-16 h-16 mx-auto text-foreground-muted" />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {passed
              ? t("examResults.header.congratulations")
              : t("examResults.header.keepPracticing")}
          </h1>
          <p className="text-foreground-muted mb-4">{attempt.template?.title}</p>

          {/* Score */}
          <div className="text-6xl font-bold mb-2">
            <span className={passed ? "text-green-500" : "text-red-500"}>{percentScore}%</span>
          </div>
          <p className="text-foreground-muted">
            {t("examResults.header.points", {
              earned: attempt.earnedPoints,
              total: attempt.totalPoints,
            })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-surface rounded-lg border border-border p-4 text-center">
            <Check className="w-6 h-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">
              {attempt.questionsWithDetails?.filter((q) => q.isCorrect).length}
            </p>
            <p className="text-sm text-foreground-muted">{t("examResults.stats.correct")}</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-4 text-center">
            <X className="w-6 h-6 mx-auto text-red-500 mb-2" />
            <p className="text-2xl font-bold">
              {attempt.questionsWithDetails?.filter((q) => !q.isCorrect).length}
            </p>
            <p className="text-sm text-foreground-muted">{t("examResults.stats.incorrect")}</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">
              {attempt.timeSpentSeconds ? Math.floor(attempt.timeSpentSeconds / 60) : "—"}
            </p>
            <p className="text-sm text-foreground-muted">{t("examResults.stats.minutes")}</p>
          </div>
        </div>

        {/* Section Breakdown */}
        {attempt.sectionScores && attempt.sectionScores.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-6 mb-8">
            <h2 className="font-semibold mb-4">{t("examResults.sections.title")}</h2>
            <div className="space-y-4">
              {attempt.sectionScores.map((section) => (
                <div key={section.sectionType}>
                  <div className="flex justify-between mb-1">
                    <span className="capitalize">{section.sectionType.replace("_", " ")}</span>
                    <span
                      className={
                        section.percentScore >= 70
                          ? "text-green-500"
                          : section.percentScore >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                      }
                    >
                      {section.percentScore}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        section.percentScore >= 70
                          ? "bg-green-500"
                          : section.percentScore >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${section.percentScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question Review */}
        <div className="mb-8">
          <h2 className="font-semibold mb-4">{t("examResults.questions.title")}</h2>
          <div className="space-y-3">
            {attempt.questionsWithDetails?.map((q, idx) => {
              const isExpanded = expandedQuestions.has(idx);
              const isCorrect = q.isCorrect;

              return (
                <div
                  key={idx}
                  className="bg-surface rounded-lg border border-border overflow-hidden"
                >
                  {/* Question header */}
                  <button
                    onClick={() => toggleQuestion(idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCorrect
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">
                          {t("examResults.questions.questionNumber", { number: idx + 1 })}
                        </p>
                        <p className="text-sm text-foreground-muted line-clamp-1">
                          {q.questionData?.questionText}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground-muted">
                        {t("examResults.questions.points", {
                          earned: q.earnedPoints ?? 0,
                          total: q.questionData?.points,
                        })}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-foreground-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-foreground-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && q.questionData && (
                    <div className="p-4 border-t border-border bg-muted/20">
                      {/* Question */}
                      <p className="font-medium mb-4">{q.questionData.questionText}</p>

                      {/* Passage if present */}
                      {q.questionData.passageText && (
                        <div className="mb-4 p-3 bg-muted/30 rounded text-sm">
                          {q.questionData.passageText}
                        </div>
                      )}

                      {/* User's answer */}
                      <div className="mb-3">
                        <p className="text-sm text-foreground-muted mb-1">
                          {t("examResults.questions.yourAnswer")}
                        </p>
                        <p
                          className={`p-2 rounded ${
                            isCorrect
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-red-100 dark:bg-red-900/30"
                          }`}
                        >
                          {q.userAnswer || t("examResults.questions.noAnswer")}
                        </p>
                      </div>

                      {/* Correct answer */}
                      {!isCorrect && q.questionData.correctAnswer && (
                        <div className="mb-3">
                          <p className="text-sm text-foreground-muted mb-1">
                            {t("examResults.questions.correctAnswer")}
                          </p>
                          <p className="p-2 rounded bg-green-100 dark:bg-green-900/30">
                            {q.questionData.correctAnswer}
                          </p>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {q.aiFeedback && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <p className="text-sm font-medium mb-1">
                            {t("examResults.questions.feedback")}
                          </p>
                          <p className="text-sm">{q.aiFeedback}</p>
                        </div>
                      )}

                      {/* Explanation */}
                      {q.questionData.explanation && (
                        <div className="mt-3 p-3 bg-muted/30 rounded">
                          <p className="text-sm font-medium mb-1">
                            {t("examResults.questions.explanation")}
                          </p>
                          <p className="text-sm">{q.questionData.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/exams/$templateId"
            params={{ templateId }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            <RotateCcw className="w-4 h-4" />
            {t("examResults.actions.tryAgain")}
          </Link>
          <Link
            to="/progress"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-muted/50"
          >
            <TrendingUp className="w-4 h-4" />
            {t("examResults.actions.viewProgress")}
          </Link>
          <Link
            to="/exams"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-muted/50"
          >
            <BookOpen className="w-4 h-4" />
            {t("examResults.actions.moreExams")}
          </Link>
        </div>
      </div>
    </div>
  );
}

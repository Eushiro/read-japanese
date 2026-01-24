import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useT, useUILanguage } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ExamTakingPage() {
  const { user, isAuthenticated } = useAuth();
  const { templateId } = useParams({ from: "/exams/$templateId" });
  const navigate = useNavigate();
  const t = useT();
  const { language: uiLanguage } = useUILanguage();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Get template
  const template = useQuery(api.examTemplates.get, {
    templateId: templateId as Id<"examTemplates">,
  });

  // Check for in-progress attempt or start new
  const existingAttempt = useQuery(
    api.examAttempts.getInProgress,
    isAuthenticated && user
      ? { userId: user.id, templateId: templateId as Id<"examTemplates"> }
      : "skip"
  );

  // Mutations
  const startExam = useMutation(api.examAttempts.start);
  const submitAnswer = useMutation(api.examAttempts.submitAnswer);
  const updatePosition = useMutation(api.examAttempts.updatePosition);
  const completeExam = useMutation(api.examAttempts.complete);
  const gradeAnswer = useAIAction(api.ai.gradeExamAnswer);

  // Get current attempt (existing or create new)
  const [attemptId, setAttemptId] = useState<Id<"examAttempts"> | null>(null);

  // Load attempt
  const attempt = useQuery(api.examAttempts.get, attemptId ? { attemptId } : "skip");

  // Start or resume exam
  useEffect(() => {
    if (!isAuthenticated || !user || !template) return;

    if (existingAttempt) {
      setAttemptId(existingAttempt._id);
      setCurrentQuestionIndex(
        existingAttempt.currentSection * 100 + existingAttempt.currentQuestion
      );
      // Load existing answers
      const existingAnswers: Record<number, string> = {};
      existingAttempt.questions.forEach((q, idx) => {
        if (q.userAnswer) {
          existingAnswers[idx] = q.userAnswer;
        }
      });
      setAnswers(existingAnswers);
    } else if (existingAttempt === null) {
      // No existing attempt, start new
      startExam({
        userId: user.id,
        templateId: templateId as Id<"examTemplates">,
      }).then((id) => {
        setAttemptId(id);
      });
    }
  }, [existingAttempt, isAuthenticated, user, template, templateId, startExam]);

  // Timer
  useEffect(() => {
    if (!attempt || !template?.totalTimeLimitMinutes) return;

    const startTime = attempt.startedAt;
    const duration = template.totalTimeLimitMinutes * 60 * 1000;
    const endTime = startTime + duration;

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(Math.floor(remaining / 1000));

      if (remaining <= 0) {
        // Time's up - auto submit
        handleComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attempt, template]);

  // Get current question
  const currentQuestion = attempt?.questionsWithDetails?.[currentQuestionIndex];
  const totalQuestions = attempt?.questions?.length || 0;

  // Handle answer selection
  const handleAnswer = async (answer: string) => {
    if (!attemptId) return;

    setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: answer }));

    // Submit to server
    await submitAnswer({
      attemptId,
      questionIndex: currentQuestionIndex,
      userAnswer: answer,
    });
  };

  // Navigate questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index);
      if (attemptId) {
        updatePosition({
          attemptId,
          currentSection: Math.floor(index / 100),
          currentQuestion: index % 100,
        });
      }
    }
  };

  // Complete exam
  const handleComplete = async () => {
    if (!attemptId) return;

    setIsSubmitting(true);

    try {
      // Grade any AI-graded questions
      const questionsNeedingGrading = attempt?.questionsWithDetails?.filter(
        (q, idx) =>
          answers[idx] &&
          q.questionData &&
          ["essay", "translation", "short_answer"].includes(q.questionData.questionType) &&
          q.isCorrect === undefined
      );

      if (questionsNeedingGrading && questionsNeedingGrading.length > 0) {
        for (const q of questionsNeedingGrading) {
          if (!q.questionData) continue;
          const idx = attempt.questionsWithDetails.indexOf(q);

          try {
            // Pass UI language for localized feedback
            const result = await gradeAnswer({
              questionText: q.questionData.questionText,
              questionType: q.questionData.questionType,
              userAnswer: answers[idx],
              correctAnswer: q.questionData.correctAnswer,
              acceptableAnswers: q.questionData.acceptableAnswers,
              rubric: q.questionData.rubric,
              passageText: q.questionData.passageText,
              language: template?.language || "japanese",
              examType: template?.examType || "",
              maxPoints: q.questionData.points,
              feedbackLanguage: uiLanguage,
            });

            // Update with AI grading
            await api.examAttempts.updateWithAiGrading({
              attemptId,
              questionIndex: idx,
              aiScore: result.score,
              aiFeedback: result.feedback,
              isCorrect: result.isCorrect,
              earnedPoints: Math.round((result.score / 100) * q.questionData.points),
            });
          } catch (error) {
            console.error("AI grading failed:", error);
          }
        }
      }

      // Complete the exam
      await completeExam({ attemptId });

      // Navigate to results
      navigate({
        to: "/exams/$templateId/results/$attemptId",
        params: {
          templateId: templateId,
          attemptId: attemptId,
        },
      });
    } catch (error) {
      console.error("Error completing exam:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>{t("examTaking.signInRequired")}</p>
      </div>
    );
  }

  if (!template || !attempt) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold">{template.title}</h1>
              <p className="text-sm text-foreground-muted">
                {t("examTaking.questionProgress", {
                  current: currentQuestionIndex + 1,
                  total: totalQuestions,
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {timeLeft !== null && (
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                    timeLeft < 300
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-muted"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{formatTime(timeLeft)}</span>
                </div>
              )}
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                {t("examTaking.finishExam")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Question */}
          {currentQuestion?.questionData && (
            <div className="bg-surface rounded-xl border border-border p-6 mb-6">
              {/* Passage if present */}
              {currentQuestion.questionData.passageText && (
                <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-foreground-muted mb-2">
                    {t("examTaking.readPassage")}
                  </p>
                  <p className="whitespace-pre-wrap">{currentQuestion.questionData.passageText}</p>
                </div>
              )}

              {/* Question text */}
              <p className="text-lg mb-6">{currentQuestion.questionData.questionText}</p>

              {/* Answer options */}
              {currentQuestion.questionData.questionType === "multiple_choice" &&
                currentQuestion.questionData.options && (
                  <div className="space-y-3">
                    {currentQuestion.questionData.options.map((option, idx) => {
                      const isSelected = answers[currentQuestionIndex] === option;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(option)}
                          className={`w-full text-left p-4 rounded-lg border transition-colors ${
                            isSelected
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          <span className="font-medium mr-3">{String.fromCharCode(65 + idx)}.</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* Text input for other types */}
              {["short_answer", "essay", "translation", "fill_blank"].includes(
                currentQuestion.questionData.questionType
              ) && (
                <div>
                  <textarea
                    value={answers[currentQuestionIndex] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQuestionIndex]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      if (answers[currentQuestionIndex]) {
                        handleAnswer(answers[currentQuestionIndex]);
                      }
                    }}
                    placeholder={
                      currentQuestion.questionData.questionType === "essay"
                        ? t("examTaking.writeAnswer")
                        : t("examTaking.typeAnswer")
                    }
                    className={`w-full p-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent ${
                      currentQuestion.questionData.questionType === "essay"
                        ? "min-h-[200px]"
                        : "min-h-[80px]"
                    }`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("examTaking.previous")}
            </button>

            {/* Question indicators */}
            <div className="flex items-center gap-1 flex-wrap justify-center max-w-md">
              {attempt?.questions?.map((q, idx) => {
                const isAnswered = !!answers[idx];
                const isCurrent = idx === currentQuestionIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => goToQuestion(idx)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      isCurrent
                        ? "bg-accent text-white"
                        : isAnswered
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === totalQuestions - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("examTaking.next")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

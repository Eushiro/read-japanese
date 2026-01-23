import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth, SignInButton } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { Id } from "../../convex/_generated/dataModel";
import { formatDuration } from "@/lib/format";
import { getYoutubeWatchUrl } from "@/lib/youtube";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

interface VideoQuestion {
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string;
  timestamp?: number;
}

interface AnswerState {
  answer: string;
  isCorrect?: boolean;
  submitted: boolean;
}

export function VideoQuizPage() {
  const { videoId } = useParams({ from: "/video-quiz/$videoId" });
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [showResults, setShowResults] = useState(false);

  // Fetch video content from Convex
  const video = useQuery(api.youtubeContent.get, {
    id: videoId as Id<"youtubeContent">,
  });

  const isLoading = video === undefined;
  const questions = (video?.questions || []) as VideoQuestion[];
  const currentQuestion = questions[currentQuestionIndex];

  // Handle answer selection
  const handleAnswerSelect = (answer: string) => {
    if (answers[currentQuestionIndex]?.submitted) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: {
        answer,
        submitted: false,
      },
    }));
  };

  // Submit answer
  const handleSubmit = () => {
    if (!currentQuestion) return;

    const currentAnswer = answers[currentQuestionIndex];
    if (!currentAnswer?.answer) return;

    // For multiple choice, check if correct
    const isCorrect =
      currentQuestion.type === "multiple_choice"
        ? currentAnswer.answer === currentQuestion.correctAnswer
        : undefined;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: {
        ...currentAnswer,
        isCorrect,
        submitted: true,
      },
    }));
  };

  // Navigation
  const goToNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Calculate score
  const calculateScore = () => {
    const answered = Object.values(answers).filter((a) => a.submitted);
    const correct = answered.filter((a) => a.isCorrect === true);
    return {
      total: questions.length,
      answered: answered.length,
      correct: correct.length,
      percentage: questions.length > 0 ? Math.round((correct.length / questions.length) * 100) : 0,
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Require authentication for quiz
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <HelpCircle className="w-12 h-12 text-foreground-muted mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Sign in to take the quiz</p>
        <p className="text-sm text-foreground-muted mb-6 text-center max-w-sm">
          Create an account to track your progress and save your quiz results.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/video/$videoId", params: { videoId } })}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Video
          </Button>
          <SignInButton mode="modal">
            <Button>Sign In</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (!video || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <HelpCircle className="w-12 h-12 text-foreground-muted mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">No quiz available</p>
        <p className="text-sm text-foreground-muted mb-4">
          Questions haven't been generated for this video yet.
        </p>
        <Button onClick={() => navigate({ to: "/video/$videoId", params: { videoId } })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Video
        </Button>
      </div>
    );
  }

  // Results view
  if (showResults) {
    const score = calculateScore();

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-surface">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/video/$videoId", params: { videoId } })}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Quiz Results</h1>
                <p className="text-sm text-foreground-muted">{video.title}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              score.percentage >= 70 ? "bg-green-500/10" : "bg-amber-500/10"
            }`}>
              <span className={`text-4xl font-bold ${
                score.percentage >= 70 ? "text-green-500" : "text-amber-500"
              }`}>
                {score.percentage}%
              </span>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              {score.percentage >= 70 ? "Well done!" : "Keep practicing!"}
            </h2>
            <p className="text-foreground-muted mb-6">
              You got {score.correct} out of {score.total} questions correct.
            </p>

            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResults(false);
                  setCurrentQuestionIndex(0);
                  setAnswers({});
                }}
              >
                Try Again
              </Button>
              <Button onClick={() => navigate({ to: "/video/$videoId", params: { videoId } })}>
                <Play className="w-4 h-4 mr-2" />
                Watch Video
              </Button>
            </div>
          </div>

          {/* Review answers */}
          <div className="mt-8 space-y-4">
            <h3 className="font-semibold text-foreground">Review Answers</h3>
            {questions.map((q, index) => {
              const answerState = answers[index];
              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    answerState?.isCorrect
                      ? "border-green-500/30 bg-green-500/5"
                      : answerState?.submitted
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {answerState?.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : answerState?.submitted ? (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-foreground-muted shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{q.question}</p>
                      {answerState?.submitted && (
                        <div className="mt-2 text-sm">
                          <p className="text-foreground-muted">
                            Your answer: <span className="font-medium">{answerState.answer}</span>
                          </p>
                          {q.correctAnswer && !answerState.isCorrect && (
                            <p className="text-green-600">
                              Correct: <span className="font-medium">{q.correctAnswer}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Quiz view
  const currentAnswerState = answers[currentQuestionIndex];
  const isAnswered = !!currentAnswerState?.answer;
  const isSubmitted = !!currentAnswerState?.submitted;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/video/$videoId", params: { videoId } })}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Video Quiz</h1>
                <p className="text-sm text-foreground-muted truncate max-w-[200px] sm:max-w-none">
                  {video.title}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="text-sm text-foreground-muted">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="bg-surface rounded-2xl border border-border p-6">
          {/* Timestamp badge */}
          {currentQuestion.timestamp !== undefined && (
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-sm mb-4 hover:bg-accent/20 transition-colors"
              onClick={() => {
                // Open video at timestamp
                window.open(
                  getYoutubeWatchUrl(video.videoId, currentQuestion.timestamp),
                  "_blank"
                );
              }}
            >
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(currentQuestion.timestamp)}
              <Play className="w-3 h-3 ml-1" />
            </button>
          )}

          {/* Question text */}
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {currentQuestion.question}
          </h2>

          {/* Multiple choice options */}
          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = currentAnswerState?.answer === option;
                const isCorrectAnswer = option === currentQuestion.correctAnswer;
                const showCorrect = isSubmitted && isCorrectAnswer;
                const showIncorrect = isSubmitted && isSelected && !isCorrectAnswer;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      showCorrect
                        ? "border-green-500 bg-green-500/10"
                        : showIncorrect
                          ? "border-red-500 bg-red-500/10"
                          : isSelected
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                    } ${isSubmitted ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        showCorrect
                          ? "border-green-500 bg-green-500"
                          : showIncorrect
                            ? "border-red-500 bg-red-500"
                            : isSelected
                              ? "border-accent bg-accent"
                              : "border-foreground-muted"
                      }`}>
                        {(showCorrect || (isSelected && !isSubmitted)) && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                        {showCorrect && <CheckCircle2 className="w-4 h-4 text-white" />}
                        {showIncorrect && <XCircle className="w-4 h-4 text-white" />}
                      </div>
                      <span className="text-foreground">{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Short answer / inference */}
          {(currentQuestion.type === "short_answer" || currentQuestion.type === "inference") && (
            <div>
              <textarea
                value={currentAnswerState?.answer || ""}
                onChange={(e) => handleAnswerSelect(e.target.value)}
                disabled={isSubmitted}
                placeholder="Type your answer..."
                className="w-full p-4 rounded-xl border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
                rows={4}
              />
              {isSubmitted && currentQuestion.correctAnswer && (
                <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-600">Suggested answer:</p>
                  <p className="text-foreground mt-1">{currentQuestion.correctAnswer}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-3">
            {!isSubmitted && (
              <Button onClick={handleSubmit} disabled={!isAnswered}>
                Submit
              </Button>
            )}
            {isSubmitted && (
              <Button onClick={goToNext}>
                {currentQuestionIndex === questions.length - 1 ? "See Results" : "Next"}
                {currentQuestionIndex < questions.length - 1 && (
                  <ChevronRight className="w-4 h-4 ml-1" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

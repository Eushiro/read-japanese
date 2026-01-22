import { useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  Brain,
  Target,
  ChevronRight,
} from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

type Language = "japanese" | "english" | "french";

const languageNames: Record<Language, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

const languageFlags: Record<Language, string> = {
  japanese: "🇯🇵",
  english: "🇬🇧",
  french: "🇫🇷",
};

interface PlacementQuestion {
  questionId: string;
  level: string;
  type: "vocabulary" | "grammar" | "reading" | "listening";
  question: string;
  questionTranslation?: string;
  options: string[];
  correctAnswer: string;
  difficulty: number;
  userAnswer?: string;
  isCorrect?: boolean;
}

export function PlacementTestPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const search = useSearch({ strict: false }) as { language?: string };
  const language = (search.language as Language) || "japanese";

  const [testId, setTestId] = useState<Id<"placementTests"> | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

  // Queries
  const existingTest = useQuery(
    api.placementTest.getForUser,
    user ? { userId: user.id, language } : "skip"
  );

  const currentTest = useQuery(
    api.placementTest.get,
    testId ? { id: testId } : "skip"
  );

  // Mutations and actions
  const createTest = useMutation(api.placementTest.create);
  const submitAnswer = useMutation(api.placementTest.submitAnswer);
  const completeTest = useMutation(api.placementTest.complete);
  const generateQuestion = useAction(api.ai.generatePlacementQuestion);
  const getNextDifficulty = useAction(api.ai.getNextQuestionDifficulty);

  // Initialize or resume test
  useEffect(() => {
    if (existingTest === undefined) return; // Still loading

    if (existingTest && existingTest.status === "in_progress") {
      setTestId(existingTest._id);
      // Resume at the last unanswered question
      const lastAnswered = existingTest.questions.findIndex(
        (q) => q.userAnswer === undefined
      );
      setCurrentQuestionIndex(
        lastAnswered >= 0 ? lastAnswered : existingTest.questions.length
      );
      setPreviousQuestions(existingTest.questions.map((q) => q.question));
    }
  }, [existingTest]);

  // Start a new test
  const handleStartTest = async () => {
    if (!user) return;

    try {
      const id = await createTest({ userId: user.id, language });
      setTestId(id);
      setCurrentQuestionIndex(0);
      setPreviousQuestions([]);

      // Generate first question
      await generateNextQuestion(id, 0);
    } catch (error) {
      console.error("Failed to start test:", error);
    }
  };

  // Generate the next question
  const generateNextQuestion = async (
    tid: Id<"placementTests">,
    afterIndex: number
  ) => {
    setIsGeneratingQuestion(true);

    try {
      // Get optimal difficulty for next question
      const nextInfo = await getNextDifficulty({ testId: tid });

      if (!nextInfo.shouldContinue) {
        // Test is complete
        await handleCompleteTest(tid);
        return;
      }

      // Generate question at optimal difficulty
      const question = await generateQuestion({
        testId: tid,
        language,
        targetDifficulty: nextInfo.targetDifficulty,
        questionType: nextInfo.suggestedType,
        previousQuestions,
      });

      setPreviousQuestions((prev) => [...prev, question.question]);
      setCurrentQuestionIndex(afterIndex);
    } catch (error) {
      console.error("Failed to generate question:", error);
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!testId || selectedAnswer === null || currentQuestionIndex < 0) return;

    setIsSubmitting(true);

    try {
      const result = await submitAnswer({
        testId,
        questionIndex: currentQuestionIndex,
        answer: selectedAnswer,
      });

      setShowFeedback(true);

      // Wait for feedback, then proceed
      setTimeout(async () => {
        setShowFeedback(false);
        setSelectedAnswer(null);

        // Check if we should continue
        const nextInfo = await getNextDifficulty({ testId });

        if (!nextInfo.shouldContinue) {
          await handleCompleteTest(testId);
        } else {
          // Generate next question
          await generateNextQuestion(testId, currentQuestionIndex + 1);
        }
      }, 1500);
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete the test
  const handleCompleteTest = async (tid: Id<"placementTests">) => {
    try {
      await completeTest({ testId: tid });
    } catch (error) {
      console.error("Failed to complete test:", error);
    }
  };

  // Loading states
  if (authLoading || existingTest === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
            <p className="text-foreground-muted mb-6">
              Please sign in to take the placement test.
            </p>
            <Button onClick={() => navigate({ to: "/" })}>Go to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion =
    currentTest?.questions[currentQuestionIndex] as PlacementQuestion | undefined;
  const isTestComplete = currentTest?.status === "completed";

  // Results view
  if (isTestComplete && currentTest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/settings" })}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">Placement Test Results</h1>
          </div>

          {/* Results Card */}
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-accent" />
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {languageFlags[language]} Your {languageNames[language]} Level
            </h2>

            <div className="text-5xl font-bold text-accent my-6">
              {currentTest.determinedLevel}
            </div>

            <div className="flex items-center justify-center gap-2 text-foreground-muted mb-8">
              <Target className="w-4 h-4" />
              <span>{currentTest.confidence}% confidence</span>
            </div>

            {/* Section breakdown */}
            {currentTest.scoresBySection && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {Object.entries(currentTest.scoresBySection).map(
                  ([section, score]) => (
                    <div
                      key={section}
                      className="bg-muted rounded-lg p-4"
                    >
                      <div className="text-sm text-foreground-muted capitalize mb-1">
                        {section}
                      </div>
                      <div className="text-xl font-bold">{score}%</div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex justify-center gap-8 text-sm text-foreground-muted mb-8">
              <div>
                <span className="font-medium text-foreground">
                  {currentTest.questionsAnswered}
                </span>{" "}
                questions
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {currentTest.correctAnswers}
                </span>{" "}
                correct
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {Math.round(
                    (currentTest.correctAnswers / currentTest.questionsAnswered) *
                      100
                  )}
                  %
                </span>{" "}
                accuracy
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate({ to: "/learn" })}>
                Start Learning at {currentTest.determinedLevel}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/settings" })}
              >
                Back to Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Start test view
  if (!testId || (currentTest && currentTest.questions.length === 0)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/settings" })}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">
              {languageFlags[language]} {languageNames[language]} Placement Test
            </h1>
          </div>

          {/* Start Card */}
          <div className="bg-surface rounded-2xl border border-border p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Adaptive Placement Test
              </h2>
              <p className="text-foreground-muted">
                This test adapts to your level as you answer. Answer honestly to
                get an accurate assessment.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">1</span>
                </div>
                <div>
                  <div className="font-medium">8-20 questions</div>
                  <div className="text-foreground-muted">
                    The test adapts and stops when confident in your level
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">2</span>
                </div>
                <div>
                  <div className="font-medium">Vocabulary, Grammar & Reading</div>
                  <div className="text-foreground-muted">
                    Tests multiple language skills
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">3</span>
                </div>
                <div>
                  <div className="font-medium">Personalized learning path</div>
                  <div className="text-foreground-muted">
                    Results customize content difficulty for you
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleStartTest}
              disabled={isGeneratingQuestion}
            >
              {isGeneratingQuestion ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing test...
                </>
              ) : (
                "Start Test"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Question view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/settings" })}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">
              {languageFlags[language]} Placement Test
            </h1>
          </div>
          <Badge variant="outline">
            Question {(currentQuestionIndex ?? 0) + 1}
          </Badge>
        </div>

        {/* Progress */}
        {currentTest && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-foreground-muted mb-2">
              <span>
                {currentTest.correctAnswers} / {currentTest.questionsAnswered}{" "}
                correct
              </span>
              <span>Estimating level...</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (currentTest.questionsAnswered / 20) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Question Card */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          {isGeneratingQuestion ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
              <p className="text-foreground-muted">Generating question...</p>
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question type badge */}
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="capitalize">
                  {currentQuestion.type}
                </Badge>
                <Badge variant="outline">{currentQuestion.level}</Badge>
              </div>

              {/* Question */}
              <div className="mb-6">
                <p
                  className="text-lg font-medium mb-2"
                  style={{ fontFamily: "var(--font-japanese)" }}
                >
                  {currentQuestion.question}
                </p>
                {currentQuestion.questionTranslation && (
                  <p className="text-sm text-foreground-muted">
                    {currentQuestion.questionTranslation}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === currentQuestion.correctAnswer;
                  const showCorrectness = showFeedback;

                  return (
                    <button
                      key={index}
                      onClick={() =>
                        !showFeedback && !isSubmitting && setSelectedAnswer(option)
                      }
                      disabled={showFeedback || isSubmitting}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        showCorrectness
                          ? isCorrect
                            ? "border-green-500 bg-green-500/10"
                            : isSelected
                            ? "border-red-500 bg-red-500/10"
                            : "border-border"
                          : isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-foreground-muted"
                      }`}
                      style={{ fontFamily: "var(--font-japanese)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {showCorrectness && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                        {showCorrectness && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Submit button */}
              <Button
                className="w-full"
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null || isSubmitting || showFeedback}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : showFeedback ? (
                  "Next question..."
                ) : (
                  "Submit Answer"
                )}
              </Button>
            </>
          ) : (
            <div className="text-center py-12 text-foreground-muted">
              Loading question...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

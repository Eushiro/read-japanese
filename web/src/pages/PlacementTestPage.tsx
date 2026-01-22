import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QuestionDisplay,
  QuestionNavigation,
} from "@/components/quiz";
import {
  ArrowLeft,
  Loader2,
  Trophy,
  Brain,
  Target,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

type Language = "japanese" | "english" | "french";

// Loading phrases that cycle during question generation
const LOADING_PHRASES = [
  "Creating your question...",
  "Calibrating difficulty...",
  "Selecting the best format...",
  "Preparing answer choices...",
  "Verifying accuracy...",
  "Almost ready...",
];

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // The latest question (unanswered)
  const [viewingIndex, setViewingIndex] = useState(-1); // Which question we're currently viewing
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  // Pre-generated next question for instant transitions
  const [nextQuestionReady, setNextQuestionReady] = useState(false);
  const [isPreGenerating, setIsPreGenerating] = useState(false);
  // Track if we've initialized from an existing test (to avoid re-running on every query update)
  const hasInitializedFromExisting = useRef(false);
  // Track max confidence so progress bar never moves backwards
  const [maxConfidence, setMaxConfidence] = useState(0);
  // Cycling loading phrases
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  // Cycle through loading phrases while generating
  useEffect(() => {
    if (!isGeneratingQuestion) {
      setLoadingPhraseIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isGeneratingQuestion]);

  // Queries
  const existingTest = useQuery(
    api.placementTest.getForUser,
    user ? { userId: user.id, language } : "skip"
  );

  const currentTest = useQuery(
    api.placementTest.get,
    testId ? { id: testId } : "skip"
  );

  // Calculate confidence from standard error
  // SE starts at 1.5 (low confidence) and decreases toward 0.4 threshold
  const currentConfidence = currentTest
    ? Math.min(100, Math.max(0, Math.round(
        ((1.5 - currentTest.abilityStandardError) / (1.5 - 0.4)) * 100
      )))
    : 0;

  // Update max confidence when current exceeds it (so bar never goes backwards)
  useEffect(() => {
    if (currentConfidence > maxConfidence) {
      setMaxConfidence(currentConfidence);
    }
  }, [currentConfidence, maxConfidence]);

  // Reset max confidence when starting a new test
  useEffect(() => {
    if (!testId) {
      setMaxConfidence(0);
    }
  }, [testId]);

  // Mutations and actions
  const createTest = useMutation(api.placementTest.create);
  const submitAnswer = useMutation(api.placementTest.submitAnswer);
  const completeTest = useMutation(api.placementTest.complete);
  const resetTest = useMutation(api.placementTest.reset);
  const generateQuestion = useAction(api.ai.generatePlacementQuestion);
  const getNextDifficulty = useAction(api.ai.getNextQuestionDifficulty);

  // Admin check
  const isAdmin = user?.email === "hiro.ayettey@gmail.com";

  // Reset initialization flag when language changes
  useEffect(() => {
    hasInitializedFromExisting.current = false;
  }, [language]);

  // Initialize or resume test (only runs once per language, not on every query update)
  useEffect(() => {
    if (existingTest === undefined) return; // Still loading
    if (hasInitializedFromExisting.current) return; // Already initialized

    if (existingTest && existingTest.status === "in_progress") {
      hasInitializedFromExisting.current = true;
      setTestId(existingTest._id);
      // Resume at the last unanswered question
      const lastAnswered = existingTest.questions.findIndex(
        (q) => q.userAnswer === undefined
      );
      const idx = lastAnswered >= 0 ? lastAnswered : existingTest.questions.length;
      setCurrentQuestionIndex(idx);
      setViewingIndex(idx);
      setPreviousQuestions(existingTest.questions.map((q) => q.question));
    } else if (existingTest && existingTest.status === "completed") {
      // Show results for completed test
      hasInitializedFromExisting.current = true;
      setTestId(existingTest._id);
    }
  }, [existingTest]);

  // Pre-generate next question when current question is displayed
  useEffect(() => {
    if (
      testId &&
      currentQuestionIndex >= 0 &&
      currentTest?.questions[currentQuestionIndex] &&
      !nextQuestionReady &&
      !isPreGenerating &&
      !showFeedback
    ) {
      preGenerateNextQuestion(testId, currentQuestionIndex + 1);
    }
  }, [testId, currentQuestionIndex, currentTest, nextQuestionReady, isPreGenerating, showFeedback]);

  // Reset scroll position when viewing a different question
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [viewingIndex]);

  // Start a new test
  const handleStartTest = async () => {
    if (!user) return;

    try {
      const id = await createTest({ userId: user.id, language });
      setTestId(id);
      setCurrentQuestionIndex(0);
      setViewingIndex(0);
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
    afterIndex: number,
    isPreGeneration: boolean = false
  ) => {
    if (isPreGeneration) {
      setIsPreGenerating(true);
    } else {
      setIsGeneratingQuestion(true);
    }

    try {
      // Get optimal difficulty for next question
      const nextInfo = await getNextDifficulty({ testId: tid });

      if (!nextInfo.shouldContinue) {
        // Test is complete
        if (!isPreGeneration) {
          await handleCompleteTest(tid);
        }
        return;
      }

      // For the first question, add minimum 6 second delay for better UX
      const isFirstQuestion = afterIndex === 0 && !isPreGeneration;
      const minDelayPromise = isFirstQuestion
        ? new Promise((resolve) => setTimeout(resolve, 6000))
        : Promise.resolve();

      // Generate question at optimal difficulty (in parallel with min delay)
      const [question] = await Promise.all([
        generateQuestion({
          testId: tid,
          language,
          targetDifficulty: nextInfo.targetDifficulty,
          questionType: nextInfo.suggestedType,
          previousQuestions,
        }),
        minDelayPromise,
      ]);

      setPreviousQuestions((prev) => [...prev, question.question]);

      if (isPreGeneration) {
        setNextQuestionReady(true);
      } else {
        setCurrentQuestionIndex(afterIndex);
        setViewingIndex(afterIndex);
        setNextQuestionReady(false);
        // Start pre-generating the next question in background
        preGenerateNextQuestion(tid, afterIndex + 1);
      }
    } catch (error) {
      console.error("Failed to generate question:", error);
    } finally {
      if (isPreGeneration) {
        setIsPreGenerating(false);
      } else {
        setIsGeneratingQuestion(false);
      }
    }
  };

  // Pre-generate the next question while user is answering current one
  const preGenerateNextQuestion = async (
    tid: Id<"placementTests">,
    forIndex: number
  ) => {
    // Don't pre-generate if already doing so or if next question is ready
    if (isPreGenerating || nextQuestionReady) return;

    await generateNextQuestion(tid, forIndex, true);
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!testId || selectedAnswer === null || currentQuestionIndex < 0) return;

    setIsSubmitting(true);

    try {
      await submitAnswer({
        testId,
        questionIndex: currentQuestionIndex,
        answer: selectedAnswer,
      });

      setShowFeedback(true);
      // Don't auto-progress - wait for user to click "Next Question"
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Proceed to next question (called when user clicks "Next Question")
  const handleNextQuestion = async () => {
    if (!testId) return;

    setShowFeedback(false);
    setSelectedAnswer(null);

    // Check if we should continue
    const nextInfo = await getNextDifficulty({ testId });

    if (!nextInfo.shouldContinue) {
      await handleCompleteTest(testId);
    } else if (nextQuestionReady) {
      // Use pre-generated question - just advance the index
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setViewingIndex(currentQuestionIndex + 1);
      setNextQuestionReady(false);
      // Start pre-generating the next question in background
      preGenerateNextQuestion(testId, currentQuestionIndex + 2);
    } else {
      // Fall back to generating if pre-generation didn't complete
      await generateNextQuestion(testId, currentQuestionIndex + 1);
    }
  };

  // Navigate to previous question (view only, can't change answers)
  const handlePreviousQuestion = () => {
    if (viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }
  };

  // Navigate forward through answered questions
  const handleViewNextQuestion = () => {
    if (viewingIndex < currentQuestionIndex) {
      setViewingIndex(viewingIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
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

  // Reset the test (admin only)
  const handleResetTest = async () => {
    if (!user || !isAdmin) return;

    try {
      await resetTest({
        userId: user.id,
        language,
        adminEmail: user.email || "",
      });

      // Reset local state
      setTestId(null);
      setCurrentQuestionIndex(-1);
      setViewingIndex(-1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setPreviousQuestions([]);
      setNextQuestionReady(false);
      hasInitializedFromExisting.current = false;
    } catch (error) {
      console.error("Failed to reset test:", error);
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

  // The question we're currently viewing (may be a past answered question)
  const viewingQuestion =
    currentTest?.questions[viewingIndex] as PlacementQuestion | undefined;
  // Whether we're viewing a past question (already answered)
  const isViewingPastQuestion = viewingIndex < currentQuestionIndex;
  // Whether we're on the current unanswered question
  const isOnCurrentQuestion = viewingIndex === currentQuestionIndex;
  const isTestComplete = currentTest?.status === "completed";

  // Results view
  if (isTestComplete && currentTest) {
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
              <h1 className="text-xl font-bold">Placement Test Results</h1>
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetTest}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Test
              </Button>
            )}
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

  // Start test view - but not if we're generating the first question
  if (!testId || (currentTest && currentTest.questions.length === 0 && !isGeneratingQuestion)) {
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
                {languageFlags[language]} {languageNames[language]} Placement Test
              </h1>
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetTest}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
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

            {/* How it works explanation */}
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-sm">
              <h4 className="font-medium text-foreground mb-2">How it works</h4>
              <ul className="space-y-1.5 text-foreground-muted">
                <li>• This adaptive test has <strong className="text-foreground">8-20 questions</strong></li>
                <li>• Questions adjust to your skill level as you answer</li>
                <li>• The test ends when we're confident we've assessed your level</li>
                <li>• Most people finish in about <strong className="text-foreground">10-15 questions</strong></li>
              </ul>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">1</span>
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
                  <span className="text-accent font-medium">2</span>
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Q{(viewingIndex ?? 0) + 1}
              {isViewingPastQuestion ? ` of ${currentQuestionIndex + 1}` : ""}
              {currentTest && !isViewingPastQuestion && ` • ${maxConfidence}%`}
            </Badge>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetTest}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Confidence-based Progress */}
        {currentTest && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground-muted">
                Question {currentQuestionIndex + 1}
              </span>
              <span className="text-foreground">
                {maxConfidence >= 70
                  ? "Almost there!"
                  : maxConfidence >= 50
                  ? "Getting clearer..."
                  : "Assessing your level..."}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${maxConfidence}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-foreground-muted mt-1">
              <span>
                {currentTest.questionsAnswered > 0
                  ? `${currentTest.correctAnswers} / ${currentTest.questionsAnswered} correct`
                  : ""}
              </span>
              <span>{maxConfidence}% confident</span>
            </div>
          </div>
        )}

        {/* Question Card */}
        {isGeneratingQuestion ? (
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm min-h-[400px] flex flex-col items-center justify-center">
            {/* Centered shimmering loading text */}
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p
                key={loadingPhraseIndex}
                className="text-xl sm:text-2xl font-medium text-foreground text-center animate-fade-in-up"
                style={{
                  background: 'linear-gradient(90deg, var(--foreground) 0%, var(--accent) 50%, var(--foreground) 100%)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmer 2s ease-in-out infinite, fade-in-up 0.3s ease-out',
                }}
              >
                {LOADING_PHRASES[loadingPhraseIndex]}
              </p>
              <p className="text-sm text-foreground-muted">
                Question {currentQuestionIndex + 1}
              </p>
            </div>
          </div>
        ) : viewingQuestion ? (
          <>
            <QuestionDisplay
              question={viewingQuestion.question}
              type="multiple_choice"
              options={viewingQuestion.options}
              selectedAnswer={
                isViewingPastQuestion
                  ? viewingQuestion.userAnswer || ""
                  : selectedAnswer || ""
              }
              onSelectAnswer={(answer) => {
                if (!isViewingPastQuestion && !showFeedback && !isSubmitting) {
                  setSelectedAnswer(answer);
                }
              }}
              isAnswered={isViewingPastQuestion || showFeedback}
              showFeedback={isViewingPastQuestion || showFeedback}
              correctAnswer={viewingQuestion.correctAnswer}
              isCorrect={viewingQuestion.isCorrect}
              isDisabled={isViewingPastQuestion || showFeedback || isSubmitting}
              metadata={{
                type: viewingQuestion.type.charAt(0).toUpperCase() + viewingQuestion.type.slice(1),
                level: viewingQuestion.level,
                badge: isViewingPastQuestion ? "Reviewing" : undefined,
              }}
              language={language}
            />

            <QuestionNavigation
              currentIndex={viewingIndex}
              totalQuestions={currentQuestionIndex + 1}
              isAnswered={isViewingPastQuestion || showFeedback}
              onPrevious={viewingIndex > 0 ? handlePreviousQuestion : undefined}
              onNext={isViewingPastQuestion ? handleViewNextQuestion : undefined}
              onSubmit={!isViewingPastQuestion && !showFeedback ? handleSubmitAnswer : undefined}
              onFinish={!isViewingPastQuestion && showFeedback ? handleNextQuestion : undefined}
              isSubmitting={isSubmitting}
              canSubmit={selectedAnswer !== null}
              nextLabel={viewingIndex === currentQuestionIndex - 1 ? "Return to Current" : "Next"}
              finishLabel="Next Question"
              variant="stacked"
            />
          </>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-foreground-muted">Loading question...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

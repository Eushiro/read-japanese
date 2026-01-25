import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Brain, ChevronRight, Loader2, RotateCcw, Target, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { QuestionDisplay, QuestionNavigation } from "@/components/quiz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WaveBackground } from "@/components/ui/wave-background";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const languageFlags: Record<ContentLanguage, string> = {
  japanese: "\u{1f1ef}\u{1f1f5}",
  english: "\u{1f1ec}\u{1f1e7}",
  french: "\u{1f1eb}\u{1f1f7}",
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
  const t = useT();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const search = useSearch({ strict: false }) as { language?: string };
  const language = (search.language as ContentLanguage) || "japanese";

  // Loading phrases that cycle during question generation (translated)
  const loadingPhrases = useMemo(
    () => [
      t("placement.loadingPhrases.creating"),
      t("placement.loadingPhrases.calibrating"),
      t("placement.loadingPhrases.selectingFormat"),
      t("placement.loadingPhrases.preparingChoices"),
      t("placement.loadingPhrases.verifying"),
      t("placement.loadingPhrases.analyzing"),
      t("placement.loadingPhrases.consulting"),
      t("placement.loadingPhrases.balancing"),
      t("placement.loadingPhrases.crafting"),
      t("placement.loadingPhrases.checkingGrammar"),
      t("placement.loadingPhrases.selectingVocab"),
      t("placement.loadingPhrases.optimizing"),
      t("placement.loadingPhrases.reviewingDifficulty"),
      t("placement.loadingPhrases.matchingSkill"),
    ],
    [t]
  );

  // Get language name from common translations
  const languageName = t(`common.languages.${language}`);

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
  const loadingPhrase = useRotatingMessages(loadingPhrases, isGeneratingQuestion, 2000);

  // Queries
  const existingTest = useQuery(
    api.placementTest.getForUser,
    user ? { userId: user.id, language } : "skip"
  );

  const currentTest = useQuery(api.placementTest.get, testId ? { id: testId } : "skip");

  // Calculate confidence from standard error
  // SE starts at 1.5 (low confidence) and decreases toward 0.4 threshold
  const currentConfidence = currentTest
    ? Math.min(
        100,
        Math.max(0, Math.round(((1.5 - currentTest.abilityStandardError) / (1.5 - 0.4)) * 100))
      )
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
  const generateQuestion = useAIAction(api.ai.generatePlacementQuestion);
  const getNextDifficulty = useAIAction(api.ai.getNextQuestionDifficulty);

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
      const lastAnswered = existingTest.questions.findIndex((q) => q.userAnswer === undefined);
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

  // Ref to hold the latest generateNextQuestion function
  const generateNextQuestionRef = useRef<
    (tid: Id<"placementTests">, afterIndex: number, isPreGeneration?: boolean) => Promise<void>
  >(() => Promise.resolve());

  // Wrap preGenerateNextQuestion in useCallback for use in effect
  const preGenerateNextQuestionCallback = useCallback(
    async (tid: Id<"placementTests">, forIndex: number) => {
      // Don't pre-generate if already doing so or if next question is ready
      if (isPreGenerating || nextQuestionReady) return;

      await generateNextQuestionRef.current(tid, forIndex, true);
    },
    [isPreGenerating, nextQuestionReady]
  );

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
      preGenerateNextQuestionCallback(testId, currentQuestionIndex + 1);
    }
  }, [
    testId,
    currentQuestionIndex,
    currentTest,
    nextQuestionReady,
    isPreGenerating,
    showFeedback,
    preGenerateNextQuestionCallback,
  ]);

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

  // Keep ref updated with latest generateNextQuestion
  useEffect(() => {
    generateNextQuestionRef.current = generateNextQuestion;
  });

  // Pre-generate the next question while user is answering current one
  const preGenerateNextQuestion = async (tid: Id<"placementTests">, forIndex: number) => {
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
            <h1 className="text-2xl font-bold mb-4">{t("placement.auth.signInRequired")}</h1>
            <p className="text-foreground-muted mb-6">{t("placement.auth.signInPrompt")}</p>
            <Button onClick={() => navigate({ to: "/" })}>{t("placement.auth.goToHome")}</Button>
          </div>
        </div>
      </div>
    );
  }

  // The question we're currently viewing (may be a past answered question)
  const viewingQuestion = currentTest?.questions[viewingIndex] as PlacementQuestion | undefined;
  // Whether we're viewing a past question (already answered)
  const isViewingPastQuestion = viewingIndex < currentQuestionIndex;
  const isTestComplete = currentTest?.status === "completed";

  // Results view
  if (isTestComplete && currentTest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">{t("placement.results.title")}</h1>
            </div>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleResetTest}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("placement.results.resetTest")}
              </Button>
            )}
          </div>

          {/* Results Card */}
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-accent" />
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {languageFlags[language]}{" "}
              {t("placement.results.yourLevel", { language: languageName })}
            </h2>

            <div className="text-5xl font-bold text-accent my-6">{currentTest.determinedLevel}</div>

            <div className="flex items-center justify-center gap-2 text-foreground-muted mb-8">
              <Target className="w-4 h-4" />
              <span>
                {t("placement.results.confidence", { percent: currentTest.confidence ?? 0 })}
              </span>
            </div>

            {/* Section breakdown */}
            {currentTest.scoresBySection && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {Object.entries(currentTest.scoresBySection).map(([section, score]) => (
                  <div key={section} className="bg-muted rounded-lg p-4">
                    <div className="text-sm text-foreground-muted capitalize mb-1">{section}</div>
                    <div className="text-xl font-bold">{score}%</div>
                  </div>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex justify-center gap-8 text-sm text-foreground-muted mb-8">
              <div>
                <span className="font-medium text-foreground">{currentTest.questionsAnswered}</span>{" "}
                {t("placement.results.questions")}
              </div>
              <div>
                <span className="font-medium text-foreground">{currentTest.correctAnswers}</span>{" "}
                {t("placement.results.correct")}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {Math.round((currentTest.correctAnswers / currentTest.questionsAnswered) * 100)}%
                </span>{" "}
                {t("placement.results.accuracy")}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate({ to: "/learn" })}>
                {t("placement.results.startLearning", { level: currentTest.determinedLevel ?? "" })}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                {t("placement.results.backToDashboard")}
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
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">
                {languageFlags[language]} {t("placement.start.title", { language: languageName })}
              </h1>
            </div>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleResetTest}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("placement.start.reset")}
              </Button>
            )}
          </div>

          {/* Start Card */}
          <div className="bg-surface rounded-2xl border border-border p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t("placement.start.adaptiveTest")}</h2>
              <p className="text-foreground-muted">{t("placement.start.description")}</p>
            </div>

            {/* How it works explanation */}
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-sm">
              <h4 className="font-medium text-foreground mb-2">
                {t("placement.start.howItWorks")}
              </h4>
              <ul className="space-y-1.5 text-foreground-muted">
                <li
                  dangerouslySetInnerHTML={{
                    __html: `\u2022 ${t("placement.start.questionRange")}`,
                  }}
                />
                <li>{`\u2022 ${t("placement.start.questionsAdjust")}`}</li>
                <li>{`\u2022 ${t("placement.start.testEnds")}`}</li>
                <li
                  dangerouslySetInnerHTML={{
                    __html: `\u2022 ${t("placement.start.typicalDuration")}`,
                  }}
                />
              </ul>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">1</span>
                </div>
                <div>
                  <div className="font-medium">{t("placement.start.skillsTitle")}</div>
                  <div className="text-foreground-muted">
                    {t("placement.start.skillsDescription")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-accent font-medium">2</span>
                </div>
                <div>
                  <div className="font-medium">{t("placement.start.personalizedTitle")}</div>
                  <div className="text-foreground-muted">
                    {t("placement.start.personalizedDescription")}
                  </div>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleStartTest} disabled={isGeneratingQuestion}>
              {isGeneratingQuestion ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("placement.start.preparingTest")}
                </>
              ) : (
                t("placement.start.startTest")
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
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">
              {languageFlags[language]} {t("placement.question.title")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {t("placement.question.questionNumber", { number: (viewingIndex ?? 0) + 1 })}
              {isViewingPastQuestion
                ? ` ${t("placement.question.ofTotal", { total: currentQuestionIndex + 1 })}`
                : ""}
            </Badge>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleResetTest}>
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
                {t("placement.question.questionNumber", { number: currentQuestionIndex + 1 })}
              </span>
              <span className="text-foreground">
                {maxConfidence >= 70
                  ? t("placement.question.almostThere")
                  : maxConfidence >= 50
                    ? t("placement.question.gettingClearer")
                    : t("placement.question.assessing")}
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
                  ? t("placement.question.correctCount", {
                      correct: currentTest.correctAnswers,
                      total: currentTest.questionsAnswered,
                    })
                  : ""}
              </span>
              <span>{t("placement.question.confident", { percent: maxConfidence })}</span>
            </div>
          </div>
        )}

        {/* Question Card */}
        {isGeneratingQuestion ? (
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm relative overflow-hidden">
            {/* Skeleton structure matching multiple choice layout */}
            <div>
              {/* Skeleton for type badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-28 rounded-full bg-border animate-pulse" />
              </div>
              {/* Skeleton for question text */}
              <div className="mb-6 space-y-2">
                <div className="h-5 w-full rounded-md bg-border animate-pulse" />
                <div className="h-5 w-4/5 rounded-md bg-border animate-pulse" />
              </div>
              {/* Skeleton for 4 options */}
              <div className="space-y-3">
                <div className="h-14 w-full rounded-xl bg-border animate-pulse" />
                <div className="h-14 w-full rounded-xl bg-border animate-pulse" />
                <div className="h-14 w-full rounded-xl bg-border animate-pulse" />
                <div className="h-14 w-full rounded-xl bg-border animate-pulse" />
              </div>
            </div>

            {/* Centered overlay with wave background and shimmering text */}
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 dark:bg-background/90">
              {/* Wave background for dark mode */}
              <div className="absolute inset-0 opacity-0 dark:opacity-100 overflow-hidden">
                <WaveBackground size="card" className="absolute inset-0" intensity={2} />
              </div>
              <p
                key={loadingPhrase}
                className="text-2xl sm:text-3xl font-bold text-center px-4 relative z-10"
                style={{
                  background:
                    "linear-gradient(90deg, var(--foreground) 0%, #a855f7 25%, #06b6d4 50%, #ec4899 75%, var(--foreground) 100%)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "shimmer 2s ease-in-out infinite",
                }}
              >
                {loadingPhrase}
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
                isViewingPastQuestion ? viewingQuestion.userAnswer || "" : selectedAnswer || ""
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
                type: t(`common.skillTypes.${viewingQuestion.type}`),
                level: viewingQuestion.level,
                badge: isViewingPastQuestion ? t("placement.question.reviewing") : undefined,
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
              nextLabel={
                viewingIndex === currentQuestionIndex - 1
                  ? t("placement.question.returnToCurrent")
                  : t("placement.question.next")
              }
              finishLabel={t("placement.question.nextQuestion")}
              variant="stacked"
            />
          </>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-foreground-muted">
                {t("placement.question.loadingQuestion")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

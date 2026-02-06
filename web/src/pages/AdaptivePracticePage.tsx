import { useNavigate } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  RotateCcw,
  SkipForward,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QuestionResult } from "@/components/practice";
import {
  getDiff,
  QuestionDictation,
  QuestionListening,
  QuestionMCQ,
  QuestionReading,
  QuestionShadowRecord,
  QuestionTranslation,
} from "@/components/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SkeletonLoadingCard } from "@/components/ui/skeleton-loading-card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Types matching backend
interface PracticeQuestion {
  questionId: string;
  type: string;
  targetSkill: string;
  difficulty?: "easy" | "medium" | "hard";
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  audioUrl?: string;
  points: number;
}

interface PracticeContent {
  contentId: string;
  contentType: "dialogue" | "micro_story";
  title: string;
  content: string;
  translation: string;
  vocabulary: Array<{ word: string; reading?: string; meaning: string }>;
  audioUrl?: string;
}

interface PracticeSet {
  practiceId: string;
  isDiagnostic: boolean;
  content?: PracticeContent;
  questions: PracticeQuestion[];
  targetSkills: string[];
  difficulty: number;
  generatedAt: number;
  modelUsed?: string;
  profileSnapshot: {
    abilityEstimate: number;
    abilityConfidence: number;
    skillScores: Record<string, number>;
  };
}

interface AnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  responseTimeMs?: number;
  skipped?: boolean;
}

type PracticePhase = "loading" | "content" | "questions" | "results";

// Audio/mic question types that need a skip option
const AUDIO_MIC_TYPES = ["listening_mcq", "dictation", "shadow_record"];

// ============================================
// SMART QUESTION ORDERING
// ============================================

type Difficulty = "easy" | "medium" | "hard";

function pickNextQuestion(
  availableQuestions: PracticeQuestion[],
  answeredHistory: AnswerRecord[]
): PracticeQuestion | null {
  if (availableQuestions.length === 0) return null;

  const answeredIds = new Set(answeredHistory.map((a) => a.questionId));
  const remaining = availableQuestions.filter((q) => !answeredIds.has(q.questionId));
  if (remaining.length === 0) return null;

  const totalAnswered = answeredHistory.filter((a) => !a.skipped).length;

  // Determine target difficulty based on performance
  let targetDifficulty: Difficulty = "easy";
  if (totalAnswered >= 2) {
    const recentAnswers = answeredHistory.filter((a) => !a.skipped).slice(-3);
    const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
    const recentTotal = recentAnswers.length;

    if (recentTotal >= 2 && recentCorrect >= recentTotal) {
      // All recent correct → scale up
      const lastDiff = getLastDifficulty(availableQuestions, answeredHistory);
      targetDifficulty = scaleDifficultyUp(lastDiff);
    } else if (recentTotal >= 2 && recentCorrect <= 0) {
      // All recent wrong → scale down
      const lastDiff = getLastDifficulty(availableQuestions, answeredHistory);
      targetDifficulty = scaleDifficultyDown(lastDiff);
    } else {
      // Mixed → stay at current
      targetDifficulty = getLastDifficulty(availableQuestions, answeredHistory);
    }
  }

  // Get last answered skill and type to avoid repeats
  const lastSkill =
    answeredHistory.length > 0
      ? availableQuestions.find(
          (q) => q.questionId === answeredHistory[answeredHistory.length - 1]?.questionId
        )?.targetSkill
      : null;
  const lastType =
    answeredHistory.length > 0
      ? availableQuestions.find(
          (q) => q.questionId === answeredHistory[answeredHistory.length - 1]?.questionId
        )?.type
      : null;

  // Track tested skills
  const testedSkills = new Set(
    answeredHistory
      .map((a) => availableQuestions.find((q) => q.questionId === a.questionId)?.targetSkill)
      .filter(Boolean)
  );

  // Score each remaining question
  let bestScore = -Infinity;
  let bestQuestion = remaining[0];

  for (const q of remaining) {
    let score = 0;

    // Difficulty match (+3 for exact, +1 for adjacent)
    if (q.difficulty === targetDifficulty) score += 3;
    else if (isAdjacentDifficulty(q.difficulty, targetDifficulty)) score += 1;

    // Avoid repeating skill back-to-back (-2)
    if (q.targetSkill === lastSkill) score -= 2;

    // Avoid repeating type back-to-back (-2)
    if (q.type === lastType) score -= 2;

    // Prefer untested skills (+2)
    if (!testedSkills.has(q.targetSkill)) score += 2;

    // Slight penalty for audio/mic types (prefer non-audio)
    if (AUDIO_MIC_TYPES.includes(q.type)) score -= 1;

    if (score > bestScore) {
      bestScore = score;
      bestQuestion = q;
    }
  }

  return bestQuestion;
}

function getLastDifficulty(questions: PracticeQuestion[], history: AnswerRecord[]): Difficulty {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].skipped) continue;
    const q = questions.find((q) => q.questionId === history[i].questionId);
    if (q?.difficulty) return q.difficulty;
  }
  return "easy";
}

function scaleDifficultyUp(current: Difficulty): Difficulty {
  if (current === "easy") return "medium";
  return "hard";
}

function scaleDifficultyDown(current: Difficulty): Difficulty {
  if (current === "hard") return "medium";
  return "easy";
}

function isAdjacentDifficulty(a?: string, b?: string): boolean {
  const order = ["easy", "medium", "hard"];
  const ia = order.indexOf(a ?? "medium");
  const ib = order.indexOf(b ?? "medium");
  return Math.abs(ia - ib) === 1;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AdaptivePracticePage() {
  const navigate = useNavigate();
  const t = useT();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { userProfile } = useUserData();
  const language = (userProfile?.languages?.[0] as ContentLanguage) || "japanese";

  // Practice state
  const [phase, setPhase] = useState<PracticePhase>("loading");
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [contentReadTime, setContentReadTime] = useState<number>(0);

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Loading messages
  const loadingPhrases = useMemo(
    () => [
      t("adaptivePractice.loading.analyzingSkills"),
      t("adaptivePractice.loading.selectingContent"),
      t("adaptivePractice.loading.generatingQuestions"),
      t("adaptivePractice.loading.personalizingDifficulty"),
      t("adaptivePractice.loading.preparingPractice"),
    ],
    [t]
  );
  const loadingPhrase = useRotatingMessages(loadingPhrases, phase === "loading", 2000);

  // Get language display name
  const languageName = t(`common.languages.${language}`);

  // Convex actions/mutations
  const getNextPractice = useAction(api.adaptivePractice.getNextPractice);
  const submitPractice = useMutation(api.adaptivePracticeQueries.submitPractice);
  const recordAnswer = useMutation(api.adaptivePracticeQueries.recordAnswer);
  const gradeFreeAnswer = useAction(api.adaptivePractice.gradeFreeAnswer);
  const evaluateShadowing = useAIAction(api.ai.evaluateShadowing);

  // Count answered questions (including skipped)
  const questionsHandled = answers.length;
  const totalQuestions = practiceSet?.questions.length ?? 0;

  // Pick next question using smart ordering
  const pickNext = useCallback(() => {
    if (!practiceSet) return;
    const next = pickNextQuestion(practiceSet.questions, answers);
    setCurrentQuestion(next);
    setQuestionStartTime(Date.now());
  }, [practiceSet, answers]);

  // Fetch practice set on mount
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const fetchPractice = async () => {
      try {
        const result = await getNextPractice({
          userId: user.id,
          language,
        });
        setPracticeSet(result);
        // Diagnostic mode → skip content, go straight to questions
        if (result.isDiagnostic) {
          setPhase("questions");
        } else {
          setPhase("content");
          setContentReadTime(Date.now());
        }
      } catch (error) {
        console.error("Failed to fetch practice:", error);
      }
    };

    fetchPractice();
  }, [user, isAuthenticated, language, getNextPractice]);

  // Pick first question when entering questions phase
  useEffect(() => {
    if (phase === "questions" && practiceSet && !currentQuestion && answers.length === 0) {
      pickNext();
    }
  }, [phase, practiceSet, currentQuestion, answers.length, pickNext]);

  // Start questions phase
  const handleStartQuestions = useCallback(() => {
    setPhase("questions");
    pickNext();
  }, [pickNext]);

  // Play audio
  const handlePlayAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play();
  }, []);

  // Record answer to backend (fire-and-forget)
  const recordAnswerToBackend = useCallback(
    (question: PracticeQuestion, answer: AnswerRecord) => {
      if (!practiceSet || !user) return;
      recordAnswer({
        userId: user.id,
        language,
        practiceId: practiceSet.practiceId,
        questionId: question.questionId,
        questionText: question.question,
        questionType: question.type,
        targetSkill: question.targetSkill,
        difficulty: question.difficulty,
        userAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        earnedPoints: answer.earnedPoints,
        maxPoints: question.points,
        responseTimeMs: answer.responseTimeMs,
        skipped: answer.skipped,
      }).catch((err) => console.error("Failed to record answer:", err));
    },
    [practiceSet, user, language, recordAnswer]
  );

  // Finish session
  const finishSession = useCallback(
    async (finalAnswers: AnswerRecord[]) => {
      if (!practiceSet || !user) return;

      const dwellMs = Date.now() - contentReadTime;
      const nonSkippedAnswers = finalAnswers.filter((a) => !a.skipped);
      const finalTotalScore = nonSkippedAnswers.reduce((sum, a) => sum + a.earnedPoints, 0);
      const finalMaxScore = nonSkippedAnswers.reduce((sum, a) => {
        const q = practiceSet.questions.find((q) => q.questionId === a.questionId);
        return sum + (q?.points ?? 0);
      }, 0);

      setTotalScore(finalTotalScore);
      setMaxScore(finalMaxScore);

      await submitPractice({
        userId: user.id,
        practiceId: practiceSet.practiceId,
        contentId: practiceSet.content?.contentId,
        contentType: practiceSet.content?.contentType,
        language,
        isDiagnostic: practiceSet.isDiagnostic,
        answers: nonSkippedAnswers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          earnedPoints: a.earnedPoints,
          responseTimeMs: a.responseTimeMs,
        })),
        totalScore: finalTotalScore,
        maxScore: finalMaxScore,
        dwellMs,
        targetSkills: practiceSet.targetSkills,
      });
      setPhase("results");
    },
    [practiceSet, user, language, contentReadTime, submitPractice]
  );

  // Skip audio/mic question
  const handleSkipQuestion = useCallback(() => {
    if (!currentQuestion || !practiceSet) return;

    const answer: AnswerRecord = {
      questionId: currentQuestion.questionId,
      userAnswer: "[skipped]",
      isCorrect: false,
      earnedPoints: 0,
      skipped: true,
    };

    setAnswers((prev) => [...prev, answer]);
    // Don't add to score for skipped questions
    recordAnswerToBackend(currentQuestion, answer);

    // Move to next
    setShowFeedback(false);
    setSelectedAnswer("");
    const updatedAnswers = [...answers, answer];
    const remaining = practiceSet.questions.filter(
      (q) => !updatedAnswers.some((a) => a.questionId === q.questionId)
    );
    if (remaining.length === 0) {
      finishSession(updatedAnswers);
    } else {
      const next = pickNextQuestion(practiceSet.questions, updatedAnswers);
      setCurrentQuestion(next);
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestion, practiceSet, answers, recordAnswerToBackend, finishSession]);

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    if (!practiceSet || !currentQuestion) return;

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const responseTimeMs = Date.now() - questionStartTime;

    try {
      let isCorrect = false;
      let earnedPoints = 0;

      if (currentQuestion.type === "free_input" || currentQuestion.type === "translation") {
        const grading = await gradeFreeAnswer({
          question: currentQuestion.question,
          userAnswer: selectedAnswer,
          language,
          expectedConcepts: currentQuestion.acceptableAnswers,
        });
        isCorrect = grading.isCorrect;
        earnedPoints = Math.round((grading.score / 100) * currentQuestion.points);
      } else if (currentQuestion.type === "dictation") {
        const diff = getDiff(selectedAnswer.trim(), currentQuestion.correctAnswer);
        const matchCount = diff.filter((d) => d.status === "match").length;
        const accuracy = diff.length > 0 ? Math.round((matchCount / diff.length) * 100) : 0;
        isCorrect = accuracy >= 80;
        earnedPoints = Math.round((accuracy / 100) * currentQuestion.points);
      } else {
        isCorrect =
          selectedAnswer === currentQuestion.correctAnswer ||
          (currentQuestion.acceptableAnswers?.includes(selectedAnswer) ?? false);
        earnedPoints = isCorrect ? currentQuestion.points : 0;
      }

      const answer: AnswerRecord = {
        questionId: currentQuestion.questionId,
        userAnswer: selectedAnswer,
        isCorrect,
        earnedPoints,
        responseTimeMs,
      };

      setAnswers((prev) => [...prev, answer]);
      setTotalScore((prev) => prev + earnedPoints);
      setMaxScore((prev) => prev + currentQuestion.points);
      setShowFeedback(true);

      // Fire-and-forget: record answer + update learner model
      recordAnswerToBackend(currentQuestion, answer);
    } catch (error) {
      console.error("Failed to grade answer:", error);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    practiceSet,
    currentQuestion,
    selectedAnswer,
    questionStartTime,
    gradeFreeAnswer,
    language,
    recordAnswerToBackend,
  ]);

  // Submit audio for shadow_record evaluation
  const handleSubmitAudio = useCallback(
    async (audioBase64: string): Promise<{ score: number; feedback: string }> => {
      if (!practiceSet || !currentQuestion) return { score: 0, feedback: "" };

      const responseTimeMs = Date.now() - questionStartTime;

      try {
        const result = await evaluateShadowing({
          targetText: currentQuestion.question,
          targetLanguage: language as "japanese" | "english" | "french",
          userAudioBase64: audioBase64,
          feedbackLanguage: "en",
        });

        const isCorrect = result.accuracyScore >= 60;
        const earnedPoints = Math.round((result.accuracyScore / 100) * currentQuestion.points);

        const answer: AnswerRecord = {
          questionId: currentQuestion.questionId,
          userAnswer: `[audio:${result.accuracyScore}%]`,
          isCorrect,
          earnedPoints,
          responseTimeMs,
        };

        setAnswers((prev) => [...prev, answer]);
        setTotalScore((prev) => prev + earnedPoints);
        setMaxScore((prev) => prev + currentQuestion.points);
        setShowFeedback(true);

        recordAnswerToBackend(currentQuestion, answer);

        return { score: result.accuracyScore, feedback: result.feedbackText };
      } catch (error) {
        console.error("Failed to evaluate shadowing:", error);
        return { score: 0, feedback: t("adaptivePractice.feedback.evaluationFailed") };
      }
    },
    [
      practiceSet,
      currentQuestion,
      questionStartTime,
      evaluateShadowing,
      language,
      recordAnswerToBackend,
      t,
    ]
  );

  // Build previous results array for progress squares
  const buildPreviousResults = useCallback((): QuestionResult[] => {
    if (!practiceSet) return [];
    // Show results in order questions were answered
    return practiceSet.questions.map((q) => {
      const answer = answers.find((a) => a.questionId === q.questionId);
      if (!answer) return null;
      if (answer.skipped) return null;
      return answer.isCorrect ? "correct" : "incorrect";
    });
  }, [practiceSet, answers]);

  // Next question or finish
  const handleNextQuestion = useCallback(async () => {
    if (!practiceSet) return;

    setShowFeedback(false);
    setSelectedAnswer("");

    const updatedAnswers = answers;
    const remaining = practiceSet.questions.filter(
      (q) => !updatedAnswers.some((a) => a.questionId === q.questionId)
    );

    if (remaining.length === 0) {
      await finishSession(updatedAnswers);
    } else {
      const next = pickNextQuestion(practiceSet.questions, updatedAnswers);
      setCurrentQuestion(next);
      setQuestionStartTime(Date.now());
    }
  }, [practiceSet, answers, finishSession]);

  // Restart practice
  const handleRestart = useCallback(() => {
    setPracticeSet(null);
    setPhase("loading");
    setCurrentQuestion(null);
    setAnswers([]);
    setSelectedAnswer("");
    setShowFeedback(false);
    setTotalScore(0);
    setMaxScore(0);

    if (user) {
      getNextPractice({ userId: user.id, language }).then((result) => {
        setPracticeSet(result);
        if (result.isDiagnostic) {
          setPhase("questions");
        } else {
          setPhase("content");
          setContentReadTime(Date.now());
        }
      });
    }
  }, [user, language, getNextPractice]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <SkeletonLoadingCard loadingPhrase={t("common.status.loading")} />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">{t("common.auth.signInRequired")}</h1>
            <p className="text-foreground-muted mb-6">{t("adaptivePractice.signInPrompt")}</p>
            <Button onClick={() => navigate({ to: "/" })}>{t("common.actions.signIn")}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading phase
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/learn" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">{t("adaptivePractice.title")}</h1>
          </div>

          <SkeletonLoadingCard loadingPhrase={loadingPhrase} />
        </div>
      </div>
    );
  }

  // Content phase - show the content to read (normal mode only)
  if (phase === "content" && practiceSet?.content) {
    const content = practiceSet.content;
    const fontFamily = language === "japanese" ? "var(--font-japanese)" : "inherit";

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/learn" })}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">{t("adaptivePractice.title")}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{languageName}</Badge>
              <Badge variant="secondary">
                {content.contentType === "dialogue"
                  ? t("adaptivePractice.contentType.dialogue")
                  : t("adaptivePractice.contentType.microStory")}
              </Badge>
            </div>
          </div>

          {/* Target skills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {practiceSet.targetSkills.map((skill) => (
              <Badge key={skill} className="bg-accent/10 text-accent border-accent/20">
                <Target className="w-3 h-3 mr-1" />
                {t(`common.skillTypes.${skill}`)}
              </Badge>
            ))}
          </div>

          {/* Content Card */}
          <div className="bg-surface rounded-xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily }}>
                {content.title}
              </h2>
              {content.audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlayAudio(content.audioUrl!)}
                  disabled={isPlayingAudio}
                >
                  <Volume2 className={`w-4 h-4 ${isPlayingAudio ? "text-accent" : ""}`} />
                </Button>
              )}
            </div>

            <div
              className="text-lg leading-relaxed mb-4 whitespace-pre-wrap"
              style={{ fontFamily }}
            >
              {content.content}
            </div>

            <div className="text-sm text-foreground-muted border-t border-border pt-4">
              {content.translation}
            </div>

            {/* Vocabulary list */}
            {content.vocabulary.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-medium mb-2">{t("adaptivePractice.vocabulary")}</h3>
                <div className="flex flex-wrap gap-2">
                  {content.vocabulary.map((v, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-muted border border-border"
                    >
                      <span style={{ fontFamily }}>{v.word}</span>
                      {v.reading && (
                        <span className="text-foreground-muted ml-1">({v.reading})</span>
                      )}
                      <span className="text-foreground-muted ml-1">- {v.meaning}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Start Questions Button */}
          <Button className="w-full" size="lg" onClick={handleStartQuestions}>
            <BookOpen className="w-4 h-4 mr-2" />
            {t("adaptivePractice.startQuestions", { count: practiceSet.questions.length })}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Questions phase
  if (phase === "questions" && practiceSet && currentQuestion) {
    const isLastQuestion = questionsHandled === totalQuestions - 1;
    const currentAnswer = answers.find((a) => a.questionId === currentQuestion.questionId) ?? null;
    const previousResultsArray = buildPreviousResults();
    const isAudioMicQuestion = AUDIO_MIC_TYPES.includes(currentQuestion.type);

    // Shared props for all question components
    const sharedProps = {
      question: currentQuestion,
      content: practiceSet.content ?? {
        contentId: "diagnostic",
        contentType: "dialogue" as const,
        title: "",
        content: "",
        translation: "",
        vocabulary: [],
      },
      language,
      totalQuestions,
      currentIndex: questionsHandled,
      previousResults: previousResultsArray,
      showFeedback,
      isSubmitting,
      currentAnswer: currentAnswer
        ? { isCorrect: currentAnswer.isCorrect, earnedPoints: currentAnswer.earnedPoints }
        : null,
      selectedAnswer,
      onSelectAnswer: setSelectedAnswer,
      onSubmit: handleSubmitAnswer,
      onNext: handleNextQuestion,
      isLastQuestion,
    };

    const renderQuestion = () => {
      switch (currentQuestion.type) {
        case "mcq_vocabulary":
        case "mcq_grammar":
        case "fill_blank":
          return <QuestionMCQ key={currentQuestion.questionId} {...sharedProps} />;
        case "mcq_comprehension":
          return <QuestionReading key={currentQuestion.questionId} {...sharedProps} />;
        case "listening_mcq":
          return <QuestionListening key={currentQuestion.questionId} {...sharedProps} />;
        case "translation":
        case "free_input":
          return <QuestionTranslation key={currentQuestion.questionId} {...sharedProps} />;
        case "dictation":
          return <QuestionDictation key={currentQuestion.questionId} {...sharedProps} />;
        case "shadow_record":
          return (
            <QuestionShadowRecord
              key={currentQuestion.questionId}
              {...sharedProps}
              onSubmitAudio={handleSubmitAudio}
            />
          );
        default:
          return <QuestionMCQ key={currentQuestion.questionId} {...sharedProps} />;
      }
    };

    return (
      <div>
        {renderQuestion()}
        {/* Skip button for audio/mic questions */}
        {isAudioMicQuestion && !showFeedback && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipQuestion}
              className="text-foreground-muted hover:text-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              {t("adaptivePractice.skipAudioQuestion")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Results phase
  if (phase === "results" && practiceSet) {
    const nonSkippedAnswers = answers.filter((a) => !a.skipped);
    const percentScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const correctCount = nonSkippedAnswers.filter((a) => a.isCorrect).length;
    const skippedCount = answers.filter((a) => a.skipped).length;

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/learn" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">{t("adaptivePractice.results.title")}</h1>
          </div>

          {/* Results Card */}
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6"
            >
              <Trophy className="w-10 h-10 text-accent" />
            </motion.div>

            <h2 className="text-2xl font-bold mb-2">
              {percentScore >= 80
                ? t("adaptivePractice.results.excellent")
                : percentScore >= 60
                  ? t("adaptivePractice.results.goodJob")
                  : t("adaptivePractice.results.keepPracticing")}
            </h2>

            {practiceSet.isDiagnostic && (
              <p className="text-sm text-foreground-muted mb-4">
                {t("adaptivePractice.results.diagnosticNote")}
              </p>
            )}

            <div className="text-5xl font-bold text-accent my-6">{percentScore}%</div>

            {/* Stats */}
            <div className="flex justify-center gap-8 text-sm text-foreground-muted mb-8">
              <div>
                <span className="font-medium text-foreground">{correctCount}</span> /{" "}
                {nonSkippedAnswers.length} {t("adaptivePractice.results.correct")}
              </div>
              <div>
                <span className="font-medium text-foreground">{totalScore}</span> / {maxScore}{" "}
                {t("adaptivePractice.points")}
              </div>
              {skippedCount > 0 && (
                <div>
                  <span className="font-medium text-foreground">{skippedCount}</span>{" "}
                  {t("adaptivePractice.results.skipped")}
                </div>
              )}
            </div>

            {/* Skills practiced */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {practiceSet.targetSkills.map((skill) => (
                <Badge key={skill} className="bg-accent/10 text-accent border-accent/20">
                  {t(`common.skillTypes.${skill}`)}
                </Badge>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <Button onClick={handleRestart}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("adaptivePractice.results.practiceAgain")}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/learn" })}>
                {t("adaptivePractice.results.backToLearn")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

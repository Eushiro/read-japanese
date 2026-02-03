import { useNavigate } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Target,
  Trophy,
  Volume2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SkeletonLoadingCard } from "@/components/ui/skeleton-loading-card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";
import { isAdmin as checkIsAdmin } from "@/lib/admin";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Types matching backend
interface PracticeQuestion {
  questionId: string;
  type: string;
  targetSkill: string;
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
  content: PracticeContent;
  questions: PracticeQuestion[];
  targetSkills: string[];
  difficulty: number;
  generatedAt: number;
  modelUsed?: string;
}

interface AnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  responseTimeMs?: number;
}

type PracticePhase = "loading" | "content" | "questions" | "results";

export function AdaptivePracticePage() {
  const navigate = useNavigate();
  const t = useT();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { userProfile } = useUserData();
  const language = (userProfile?.languages?.[0] as ContentLanguage) || "japanese";

  // Practice state
  const [phase, setPhase] = useState<PracticePhase>("loading");
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Admin check
  const isAdmin = checkIsAdmin(user?.email);

  // Convex actions/mutations
  const getNextPractice = useAction(api.adaptivePractice.getNextPractice);
  const submitPractice = useMutation(api.adaptivePracticeQueries.submitPractice);
  const gradeFreeAnswer = useAction(api.adaptivePractice.gradeFreeAnswer);

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
        setPhase("content");
        setContentReadTime(Date.now());
      } catch (error) {
        console.error("Failed to fetch practice:", error);
      }
    };

    fetchPractice();
  }, [user, isAuthenticated, language, getNextPractice]);

  // Start questions phase
  const handleStartQuestions = useCallback(() => {
    setPhase("questions");
    setCurrentQuestionIndex(0);
    setQuestionStartTime(Date.now());
  }, []);

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

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    if (!practiceSet || isSubmitting) return;

    const question = practiceSet.questions[currentQuestionIndex];
    if (!question) return;

    setIsSubmitting(true);
    const responseTimeMs = Date.now() - questionStartTime;

    try {
      let isCorrect = false;
      let earnedPoints = 0;

      // Check answer based on question type
      if (question.type === "free_input" || question.type === "translation") {
        // Use AI grading for free-form answers
        const grading = await gradeFreeAnswer({
          question: question.question,
          userAnswer: selectedAnswer,
          language,
          expectedConcepts: question.acceptableAnswers,
        });
        isCorrect = grading.isCorrect;
        earnedPoints = Math.round((grading.score / 100) * question.points);
      } else {
        // MCQ - exact match
        isCorrect =
          selectedAnswer === question.correctAnswer ||
          (question.acceptableAnswers?.includes(selectedAnswer) ?? false);
        earnedPoints = isCorrect ? question.points : 0;
      }

      const answer: AnswerRecord = {
        questionId: question.questionId,
        userAnswer: selectedAnswer,
        isCorrect,
        earnedPoints,
        responseTimeMs,
      };

      setAnswers((prev) => [...prev, answer]);
      setTotalScore((prev) => prev + earnedPoints);
      setMaxScore((prev) => prev + question.points);
      setShowFeedback(true);
    } catch (error) {
      console.error("Failed to grade answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    practiceSet,
    currentQuestionIndex,
    selectedAnswer,
    questionStartTime,
    gradeFreeAnswer,
    language,
    isSubmitting,
  ]);

  // Next question or finish
  const handleNextQuestion = useCallback(async () => {
    if (!practiceSet) return;

    setShowFeedback(false);
    setSelectedAnswer("");

    if (currentQuestionIndex < practiceSet.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setQuestionStartTime(Date.now());
    } else {
      // Submit all answers
      const dwellMs = Date.now() - contentReadTime;
      await submitPractice({
        userId: user!.id,
        practiceId: practiceSet.practiceId,
        contentId: practiceSet.content.contentId,
        contentType: practiceSet.content.contentType,
        language,
        answers,
        totalScore,
        maxScore,
        dwellMs,
        targetSkills: practiceSet.targetSkills,
      });
      setPhase("results");
    }
  }, [
    practiceSet,
    currentQuestionIndex,
    answers,
    totalScore,
    maxScore,
    contentReadTime,
    submitPractice,
    user,
    language,
  ]);

  // Restart practice
  const handleRestart = useCallback(() => {
    setPracticeSet(null);
    setPhase("loading");
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer("");
    setShowFeedback(false);
    setTotalScore(0);
    setMaxScore(0);

    // Re-fetch practice
    if (user) {
      getNextPractice({ userId: user.id, language }).then((result) => {
        setPracticeSet(result);
        setPhase("content");
        setContentReadTime(Date.now());
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

  // Content phase - show the content to read
  if (phase === "content" && practiceSet) {
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
  if (phase === "questions" && practiceSet) {
    const question = practiceSet.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === practiceSet.questions.length - 1;
    const currentAnswer = answers.find((a) => a.questionId === question?.questionId);
    const fontFamily = language === "japanese" ? "var(--font-japanese)" : "inherit";

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setPhase("content")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">{t("adaptivePractice.title")}</h1>
            </div>
            <Badge variant="outline">
              {t("adaptivePractice.questionProgress", {
                current: currentQuestionIndex + 1,
                total: practiceSet.questions.length,
              })}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full shadow-[0_0_10px_rgba(255,132,0,0.5)]"
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentQuestionIndex + 1) / practiceSet.questions.length) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Question Card */}
          {question && (
            <div className="bg-surface rounded-xl border border-border p-6 mb-6">
              {/* Question metadata */}
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  {t(`adaptivePractice.questionType.${question.type}`)}
                </Badge>
                <Badge variant="outline">{t(`common.skillTypes.${question.targetSkill}`)}</Badge>
                <span className="text-xs text-foreground-muted ml-auto">
                  {question.points} {t("adaptivePractice.points")}
                </span>
              </div>

              {/* Audio for listening questions */}
              {question.audioUrl && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    onClick={() => handlePlayAudio(question.audioUrl!)}
                    disabled={isPlayingAudio}
                    className="w-full"
                  >
                    <Volume2 className={`w-4 h-4 mr-2 ${isPlayingAudio ? "text-accent" : ""}`} />
                    {isPlayingAudio
                      ? t("adaptivePractice.playing")
                      : t("adaptivePractice.playAudio")}
                  </Button>
                </div>
              )}

              {/* Question text */}
              <h2 className="text-lg font-semibold mb-2" style={{ fontFamily }}>
                {question.question}
              </h2>
              {question.questionTranslation && (
                <p className="text-sm text-foreground-muted mb-6">{question.questionTranslation}</p>
              )}

              {/* Answer input */}
              {question.options && question.options.length > 0 ? (
                // MCQ options
                <div className="space-y-3">
                  {question.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrectOption = option === question.correctAnswer;
                    const showCorrectness = showFeedback;

                    let ringClass = "";
                    if (showCorrectness) {
                      if (isCorrectOption) {
                        ringClass = "ring-2 ring-green-500";
                      } else if (isSelected && !isCorrectOption) {
                        ringClass = "ring-2 ring-red-500";
                      }
                    } else if (isSelected) {
                      ringClass = "ring-2 ring-accent";
                    }

                    let bgClass = "bg-muted border-border";
                    if (showCorrectness && isCorrectOption) {
                      bgClass = "bg-green-500/10 border-green-500/30";
                    } else if (showCorrectness && isSelected && !isCorrectOption) {
                      bgClass = "bg-red-500/10 border-red-500/30";
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => !showFeedback && setSelectedAnswer(option)}
                        disabled={showFeedback || isSubmitting}
                        className={`w-full p-4 rounded-xl text-left transition-all border ${bgClass} ${ringClass} ${
                          showFeedback || isSubmitting
                            ? "cursor-not-allowed"
                            : "hover:bg-muted/80 hover:border-border/80"
                        }`}
                        style={{ fontFamily }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {!showCorrectness && (
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? "border-accent" : "border-foreground/30"
                                }`}
                              >
                                {isSelected && <div className="w-3 h-3 rounded-full bg-accent" />}
                              </div>
                            )}
                            <span className="text-foreground">{option}</span>
                          </div>
                          {showCorrectness && isCorrectOption && (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          )}
                          {showCorrectness && isSelected && !isCorrectOption && (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Free input
                <textarea
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  disabled={showFeedback || isSubmitting}
                  placeholder={t("adaptivePractice.typeAnswer")}
                  rows={4}
                  className="w-full p-4 rounded-xl border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ fontFamily }}
                />
              )}

              {/* Feedback */}
              {showFeedback && currentAnswer && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    {currentAnswer.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-medium text-green-500">
                          {t("adaptivePractice.feedback.correct")}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="font-medium text-red-500">
                          {t("adaptivePractice.feedback.incorrect")}
                        </span>
                      </>
                    )}
                    <span className="text-sm text-foreground-muted ml-auto">
                      +{currentAnswer.earnedPoints} {t("adaptivePractice.points")}
                    </span>
                  </div>
                  {!currentAnswer.isCorrect && question.correctAnswer && (
                    <p className="text-sm text-foreground-muted">
                      {t("adaptivePractice.feedback.correctAnswer")}:{" "}
                      <span style={{ fontFamily }}>{question.correctAnswer}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Model indicator for debugging (admin only) */}
              {isAdmin && practiceSet.modelUsed && (
                // eslint-disable-next-line i18next/no-literal-string
                <div className="mt-4 text-xs text-muted-foreground text-right">
                  Model: {practiceSet.modelUsed}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!showFeedback ? (
              <Button
                className="flex-1"
                size="lg"
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer || isSubmitting}
              >
                {t("common.actions.submit")}
              </Button>
            ) : (
              <Button className="flex-1" size="lg" onClick={handleNextQuestion}>
                {isLastQuestion
                  ? t("adaptivePractice.finishPractice")
                  : t("adaptivePractice.nextQuestion")}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results phase
  if (phase === "results" && practiceSet) {
    const percentScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const correctCount = answers.filter((a) => a.isCorrect).length;

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

            <div className="text-5xl font-bold text-accent my-6">{percentScore}%</div>

            {/* Stats */}
            <div className="flex justify-center gap-8 text-sm text-foreground-muted mb-8">
              <div>
                <span className="font-medium text-foreground">{correctCount}</span> /{" "}
                {practiceSet.questions.length} {t("adaptivePractice.results.correct")}
              </div>
              <div>
                <span className="font-medium text-foreground">{totalScore}</span> / {maxScore}{" "}
                {t("adaptivePractice.points")}
              </div>
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

import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import {
  BookOpen,
  Check,
  ChevronRight,
  Loader2,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useT, useUILanguage } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

export function PracticePage() {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { trackEvent, events } = useAnalytics();
  const userId = user?.id ?? "anonymous";
  const search = useSearch({ strict: false }) as { vocabularyId?: string };

  // Get vocabulary for practice (prioritize words that need practice)
  const vocabulary = useQuery(api.vocabulary.list, isAuthenticated ? { userId } : "skip");

  type VocabularyItem = NonNullable<typeof vocabulary>[number];
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null);

  // Language filter state
  type LanguageFilter = "all" | "japanese" | "english" | "french";
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");

  // Compute available languages from vocabulary
  const availableLanguages = useMemo(() => {
    if (!vocabulary) return [];
    const languages = new Set(vocabulary.map((v) => v.language));
    return Array.from(languages) as ("japanese" | "english" | "french")[];
  }, [vocabulary]);

  const showLanguageFilter = availableLanguages.length > 1;

  // Pre-select word from URL parameter
  useEffect(() => {
    if (search.vocabularyId && vocabulary && !selectedWord) {
      const word = vocabulary.find((v) => v._id === search.vocabularyId);
      if (word) {
        setSelectedWord(word);
        // Auto-set filter to match the word's language
        setLanguageFilter(word.language as LanguageFilter);
      }
    }
  }, [search.vocabularyId, vocabulary, selectedWord]);
  const [sentence, setSentence] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    grammarScore: number;
    usageScore: number;
    naturalnessScore: number;
    overallScore: number;
    difficultyLevel: string;
    difficultyExplanation: string;
    corrections: Array<{
      original: string;
      corrected: string;
      explanation: string;
    }>;
    feedback: string;
    improvedSentence: string;
  } | null>(null);

  const verifySentence = useAIAction(api.ai.verifySentence);
  const submitSentence = useMutation(api.userSentences.submit);

  // Subscription from shared context (prevents refetching on navigation)
  const { isPremium: isPremiumUser } = useUserData();

  // Filter vocabulary for practice (prefer new/learning words, respect language filter)
  const practiceWords = useMemo(() => {
    if (!vocabulary) return [];
    return vocabulary.filter((v) => {
      const isMasteryMatch = v.masteryState === "new" || v.masteryState === "learning";
      const isLanguageMatch = languageFilter === "all" || v.language === languageFilter;
      return isMasteryMatch && isLanguageMatch;
    });
  }, [vocabulary, languageFilter]);

  const handleSelectWord = (word: VocabularyItem) => {
    setSelectedWord(word);
    setSentence("");
    setResult(null);
    trackEvent(events.PRACTICE_WORD_SELECTED, {
      word: word.word,
      language: word.language,
      mastery_state: word.masteryState,
    });
  };

  const handleSubmit = async () => {
    if (!selectedWord || !sentence.trim()) return;

    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    // Track sentence submitted
    trackEvent(events.SENTENCE_SUBMITTED, {
      word: selectedWord.word,
      language: selectedWord.language,
      sentence_length: sentence.trim().length,
    });

    try {
      // Verify the sentence with AI - pass UI language for localized feedback
      const verification = await verifySentence({
        sentence: sentence.trim(),
        targetWord: selectedWord.word,
        wordDefinitions: selectedWord.definitions,
        language: selectedWord.language as "japanese" | "english" | "french",
        feedbackLanguage: uiLanguage,
      });

      setResult(verification);

      // Track sentence verified
      trackEvent(events.SENTENCE_VERIFIED, {
        word: selectedWord.word,
        language: selectedWord.language,
        is_correct: verification.isCorrect,
        overall_score: verification.overallScore,
        difficulty_level: verification.difficultyLevel,
      });

      // Save the result to the database (verification results are stored separately or used locally)
      await submitSentence({
        userId,
        vocabularyId: selectedWord._id as GenericId<"vocabulary">,
        targetWord: selectedWord.word,
        sentence: sentence.trim(),
      });
    } catch (error) {
      console.error("Failed to verify sentence:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextWord = () => {
    if (!practiceWords.length || !selectedWord) return;

    // Filter to only words of the same language as the current word
    const sameLanguageWords = practiceWords.filter((w) => w.language === selectedWord.language);
    if (sameLanguageWords.length === 0) return;

    const currentIndex = sameLanguageWords.findIndex((w) => w._id === selectedWord._id);
    const nextIndex = (currentIndex + 1) % sameLanguageWords.length;
    handleSelectWord(sameLanguageWords[nextIndex]);
  };

  const handleTryAgain = () => {
    setSentence("");
    setResult(null);
  };

  // Don't show sign-in prompt while auth is still loading
  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <PenLine className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t("practice.signIn.title")}
          </h2>
          <p className="text-foreground-muted mb-4">{t("practice.signIn.description")}</p>
          <SignInButton mode="modal">
            <Button>{t("practice.signIn.button")}</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Animated background */}
      <PremiumBackground
        variant="subtle"
        colorScheme="purple"
        showStars={true}
        showOrbs={true}
        orbCount={1}
        starCount={15}
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-8 pb-12 flex-shrink-0">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-purple-500/20">
                <PenLine className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm font-medium text-purple-400 uppercase tracking-wider">
                {t("practice.hero.badge")}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("practice.hero.title")}
            </h1>
            <p className="text-foreground-muted text-lg">{t("practice.hero.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl flex-1 flex flex-col overflow-y-auto">
        {vocabulary === undefined ? (
          // Loading skeleton for word grid
          <div>
            <Skeleton className="w-40 h-6 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] animate-pulse"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="h-6 bg-muted rounded w-24 mb-2" />
                  <div className="h-4 bg-muted rounded w-32 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-muted rounded-full w-16" />
                    <div className="h-4 bg-muted rounded-full w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : practiceWords.length === 0 ? (
          // No words to practice
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-foreground-muted" />
              </div>
              <h2
                className="text-2xl font-bold text-foreground mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("practice.empty.title")}
              </h2>
              <p className="text-foreground-muted mb-6">{t("practice.empty.description")}</p>
              <Button onClick={() => (window.location.href = "/vocabulary")}>
                <BookOpen className="w-4 h-4 mr-2" />
                {t("practice.empty.goToVocabulary")}
              </Button>
            </div>
          </div>
        ) : !selectedWord ? (
          // Word selection
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t("practice.wordSelection.title")}
              </h2>
              {/* Language Filter - only show if multiple languages */}
              {showLanguageFilter && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguageFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      languageFilter === "all"
                        ? "bg-accent text-white"
                        : "bg-muted text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {t("practice.wordSelection.all")}
                  </button>
                  {availableLanguages.includes("japanese") && (
                    <button
                      onClick={() => setLanguageFilter("japanese")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        languageFilter === "japanese"
                          ? "bg-accent text-white"
                          : "bg-muted text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {t("practice.wordSelection.japanese")}
                    </button>
                  )}
                  {availableLanguages.includes("english") && (
                    <button
                      onClick={() => setLanguageFilter("english")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        languageFilter === "english"
                          ? "bg-accent text-white"
                          : "bg-muted text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {t("practice.wordSelection.english")}
                    </button>
                  )}
                  {availableLanguages.includes("french") && (
                    <button
                      onClick={() => setLanguageFilter("french")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        languageFilter === "french"
                          ? "bg-accent text-white"
                          : "bg-muted text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {t("practice.wordSelection.french")}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {practiceWords.slice(0, 10).map((word) => (
                <button
                  key={word._id}
                  onClick={() => handleSelectWord(word)}
                  className="p-4 rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 hover:border-foreground-muted/30 dark:hover:border-white/20 dark:hover:shadow-[0_0_15px_rgba(255,132,0,0.08)] transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] text-left"
                >
                  <div
                    className="text-xl font-semibold text-foreground mb-1"
                    style={{
                      fontFamily: word.language === "japanese" ? "var(--font-japanese)" : "inherit",
                    }}
                  >
                    {word.word}
                  </div>
                  <div className="text-sm text-foreground-muted">
                    {word.definitions.slice(0, 2).join(", ")}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted capitalize">
                      {word.language}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 capitalize">
                      {word.masteryState}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Practice interface
          <div className="space-y-6">
            {/* Selected word */}
            <div className="rounded-2xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-foreground-muted mb-1">
                    {t("practice.practiceInterface.prompt")}
                  </div>
                  <div
                    className="text-3xl font-bold text-foreground mb-2"
                    style={{
                      fontFamily:
                        selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
                    }}
                  >
                    {selectedWord.word}
                  </div>
                  {selectedWord.reading && (
                    <div className="text-sm text-foreground-muted mb-2">{selectedWord.reading}</div>
                  )}
                  <div className="text-foreground">{selectedWord.definitions.join("; ")}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedWord(null)}
                  className="text-foreground-muted"
                >
                  {t("practice.practiceInterface.changeWord")}
                </Button>
              </div>
            </div>

            {/* Input area */}
            {!result && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("practice.practiceInterface.inputLabel")}
                  </label>
                  <textarea
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    placeholder={t("practice.practiceInterface.placeholder", {
                      word: selectedWord.word,
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
                    style={{
                      fontFamily:
                        selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
                    }}
                    rows={3}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={!sentence.trim() || isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("practice.practiceInterface.checking")}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {t("practice.practiceInterface.checkSentence")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-6 animate-fade-in-up">
                {/* Score summary */}
                <div className="rounded-2xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {result.isCorrect ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-foreground">
                          {result.isCorrect
                            ? t("practice.results.greatJob")
                            : t("practice.results.goodEffort")}
                        </div>
                        <div className="text-sm text-foreground-muted">
                          {t("practice.results.overallScore", { score: result.overallScore })}
                        </div>
                      </div>
                    </div>
                    {/* Difficulty badge */}
                    <DifficultyBadge
                      level={result.difficultyLevel}
                      explanation={result.difficultyExplanation}
                    />
                  </div>

                  {/* Score bars */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ScoreBar label={t("practice.scores.grammar")} score={result.grammarScore} />
                    <ScoreBar label={t("practice.scores.wordUsage")} score={result.usageScore} />
                    <ScoreBar
                      label={t("practice.scores.naturalness")}
                      score={result.naturalnessScore}
                    />
                  </div>
                </div>

                {/* Your sentence */}
                <div className="rounded-2xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="text-sm font-medium text-foreground-muted mb-2">
                    {t("practice.results.yourSentence")}
                  </div>
                  <div
                    className="text-lg text-foreground"
                    style={{
                      fontFamily:
                        selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
                    }}
                  >
                    {sentence}
                  </div>
                </div>

                {/* Corrections */}
                {result.corrections.length > 0 && (
                  <div className="rounded-2xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <div className="text-sm font-medium text-foreground-muted mb-3">
                      {t("practice.results.corrections")}
                    </div>
                    <div className="space-y-3">
                      {result.corrections.map((correction, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="line-through text-foreground-muted">
                              {correction.original}
                            </span>
                            <ChevronRight className="w-4 h-4 text-foreground-muted" />
                            <span className="text-amber-600 font-medium">
                              {correction.corrected}
                            </span>
                          </div>
                          <div className="text-sm text-foreground-muted">
                            {correction.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="rounded-2xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="text-sm font-medium text-foreground-muted mb-2">
                    {t("practice.results.feedback")}
                  </div>
                  <div className="text-foreground mb-4">{result.feedback}</div>
                  {result.improvedSentence && (
                    <div>
                      <div className="text-sm font-medium text-foreground-muted mb-2">
                        {result.improvedSentence === sentence
                          ? t("practice.results.alternativeExpression")
                          : t("practice.results.suggestedImprovement")}
                      </div>
                      <div
                        className="text-lg text-green-600 bg-green-500/5 p-3 rounded-lg border border-green-500/20"
                        style={{
                          fontFamily:
                            selectedWord.language === "japanese"
                              ? "var(--font-japanese)"
                              : "inherit",
                        }}
                      >
                        {result.improvedSentence}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleTryAgain} className="flex-1 gap-2">
                    <RefreshCw className="w-4 h-4" />
                    {t("practice.results.tryAgain")}
                  </Button>
                  <Button onClick={handleNextWord} className="flex-1 gap-2">
                    <ChevronRight className="w-4 h-4" />
                    {t("practice.results.nextWord")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="sentences" />
    </div>
  );
}

// Score bar component
function ScoreBar({ label, score }: { label: string; score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-foreground-muted">{label}</span>
        <span className="font-medium text-foreground">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// Difficulty badge component
function DifficultyBadge({ level, explanation }: { level: string; explanation: string }) {
  const t = useT();
  const config: Record<string, { color: string; labelKey: string }> = {
    beginner: {
      color: "bg-green-500/10 text-green-600 border-green-500/20",
      labelKey: "practice.difficulty.beginner",
    },
    intermediate: {
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      labelKey: "practice.difficulty.intermediate",
    },
    advanced: {
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      labelKey: "practice.difficulty.advanced",
    },
  };

  const { color, labelKey } = config[level.toLowerCase()] || config.beginner;
  const label = t(labelKey);

  return (
    <div className="group relative">
      <div className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${color}`}>{label}</div>
      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-surface border border-border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
        <div className="text-xs text-foreground-muted">{explanation}</div>
      </div>
    </div>
  );
}

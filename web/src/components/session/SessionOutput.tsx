import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { Check, ChevronRight, Loader2, PenLine, Send, SkipForward, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useT, useUILanguage } from "@/lib/i18n";

import { api } from "../../../convex/_generated/api";

interface SessionOutputProps {
  wordCount: number;
  onComplete: (sentenceCount: number) => void;
  onSkip: () => void;
}

export function SessionOutput({ wordCount, onComplete, onSkip }: SessionOutputProps) {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // Fetch vocabulary
  const vocabulary = useQuery(api.vocabulary.list, userId ? { userId } : "skip");
  const subscription = useQuery(api.subscriptions.get, userId ? { userId } : "skip");

  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Filter to practice words
  const practiceWords = useMemo(() => {
    if (!vocabulary) return [];
    return vocabulary
      .filter((v) => v.masteryState === "new" || v.masteryState === "learning")
      .slice(0, wordCount);
  }, [vocabulary, wordCount]);

  // State
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [sentence, setSentence] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentencesWritten, setSentencesWritten] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    overallScore: number;
    feedback: string;
    improvedSentence?: string;
  } | null>(null);

  const verifySentence = useAIAction(api.ai.verifySentence);
  const submitSentence = useMutation(api.userSentences.submit);

  const currentWord = practiceWords[currentWordIndex];

  // Handle submit
  const handleSubmit = async () => {
    if (!currentWord || !sentence.trim()) return;

    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      // Pass UI language for localized feedback
      const verification = await verifySentence({
        sentence: sentence.trim(),
        targetWord: currentWord.word,
        wordDefinitions: currentWord.definitions,
        language: currentWord.language as "japanese" | "english" | "french",
        feedbackLanguage: uiLanguage,
      });

      setResult({
        isCorrect: verification.isCorrect,
        overallScore: verification.overallScore,
        feedback: verification.feedback,
        improvedSentence: verification.improvedSentence,
      });

      // Save to database (verification results are stored separately or used locally)
      await submitSentence({
        userId,
        vocabularyId: currentWord._id as GenericId<"vocabulary">,
        targetWord: currentWord.word,
        sentence: sentence.trim(),
      });

      setSentencesWritten((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to verify sentence:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle next word
  const handleNextWord = () => {
    const nextIndex = currentWordIndex + 1;
    if (nextIndex >= practiceWords.length || nextIndex >= wordCount) {
      onComplete(sentencesWritten);
    } else {
      setCurrentWordIndex(nextIndex);
      setSentence("");
      setResult(null);
    }
  };

  // Loading state
  if (vocabulary === undefined) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No words to practice
  if (practiceWords.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <PenLine className="w-8 h-8 text-foreground-muted" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t("studySession.output.noWordsTitle")}
        </h2>
        <p className="text-foreground-muted mb-6">{t("studySession.output.noWordsDescription")}</p>
        <Button onClick={() => onComplete(0)}>{t("common.actions.continue")}</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border">
          <PenLine className="w-4 h-4 text-accent" />
          <span className="text-foreground-muted">
            {t("studySession.output.wordOf", {
              current: currentWordIndex + 1,
              total: Math.min(practiceWords.length, wordCount),
            })}
          </span>
        </div>
      </div>

      {/* Word card */}
      <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
        <div className="text-sm text-foreground-muted mb-2">
          {t("studySession.output.writeSentenceUsing")}
        </div>
        <div
          className="text-3xl font-bold text-foreground mb-2"
          style={{
            fontFamily: currentWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
          }}
        >
          {currentWord.word}
        </div>
        {currentWord.reading && (
          <div className="text-sm text-foreground-muted mb-2">{currentWord.reading}</div>
        )}
        <div className="text-foreground">{currentWord.definitions.join("; ")}</div>
      </div>

      {/* Input / Result */}
      {!result ? (
        <div className="space-y-4">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder={t("studySession.output.placeholder", { word: currentWord.word })}
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
            style={{
              fontFamily: currentWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
            }}
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onSkip} className="flex-1 gap-2">
              <SkipForward className="w-4 h-4" />
              {t("studySession.output.skipWriting")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!sentence.trim() || isSubmitting}
              className="flex-1 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("studySession.output.checking")}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t("studySession.output.check")}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {/* Result */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
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
                    ? t("studySession.output.greatJob")
                    : t("studySession.output.goodEffort")}
                </div>
                <div className="text-sm text-foreground-muted">
                  {t("studySession.output.score", { score: result.overallScore })}
                </div>
              </div>
            </div>

            <p className="text-foreground mb-4">{result.feedback}</p>

            {result.improvedSentence && result.improvedSentence !== sentence && (
              <div>
                <div className="text-sm text-foreground-muted mb-2">
                  {t("studySession.output.suggestedImprovement")}
                </div>
                <div
                  className="text-lg text-green-600 bg-green-500/5 p-3 rounded-lg border border-green-500/20"
                  style={{
                    fontFamily:
                      currentWord.language === "japanese" ? "var(--font-japanese)" : "inherit",
                  }}
                >
                  {result.improvedSentence}
                </div>
              </div>
            )}
          </div>

          {/* Next action */}
          <Button onClick={handleNextWord} className="w-full gap-2">
            {currentWordIndex + 1 >= Math.min(practiceWords.length, wordCount) ? (
              <>
                {t("studySession.output.complete")}
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                {t("studySession.output.nextWord")}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Paywall */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="sentences" />
    </div>
  );
}

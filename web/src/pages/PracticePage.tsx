import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useSearch } from "@tanstack/react-router";
import type { GenericId } from "convex/values";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Paywall } from "@/components/Paywall";
import {
  PenLine,
  Send,
  Loader2,
  Check,
  RefreshCw,
  ChevronRight,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

export function PracticePage() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? "anonymous";
  const search = useSearch({ strict: false }) as { vocabularyId?: string };

  // Get vocabulary for practice (prioritize words that need practice)
  const vocabulary = useQuery(
    api.vocabulary.list,
    isAuthenticated ? { userId } : "skip"
  );

  const [selectedWord, setSelectedWord] = useState<typeof vocabulary extends (infer T)[] ? T : never | null>(null);

  // Pre-select word from URL parameter
  useEffect(() => {
    if (search.vocabularyId && vocabulary && !selectedWord) {
      const word = vocabulary.find((v) => v._id === search.vocabularyId);
      if (word) {
        setSelectedWord(word);
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

  const verifySentence = useAction(api.ai.verifySentence);
  const submitSentence = useMutation(api.userSentences.submit);

  // Subscription check
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Filter vocabulary for practice (prefer new/learning words)
  const practiceWords = vocabulary?.filter(
    (v) => v.masteryState === "new" || v.masteryState === "learning"
  ) ?? [];

  const handleSelectWord = (word: typeof vocabulary extends (infer T)[] ? T : never) => {
    setSelectedWord(word);
    setSentence("");
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!selectedWord || !sentence.trim()) return;

    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      // Verify the sentence with AI
      const verification = await verifySentence({
        sentence: sentence.trim(),
        targetWord: selectedWord.word,
        wordDefinitions: selectedWord.definitions,
        language: selectedWord.language as "japanese" | "english" | "french",
      });

      setResult(verification);

      // Save the result to the database
      await submitSentence({
        userId,
        vocabularyId: selectedWord._id as GenericId<"vocabulary">,
        targetWord: selectedWord.word,
        sentence: sentence.trim(),
        isCorrect: verification.isCorrect,
        grammarScore: verification.grammarScore,
        usageScore: verification.usageScore,
        naturalnessScore: verification.naturalnessScore,
        overallScore: verification.overallScore,
        corrections: verification.corrections,
        feedback: verification.feedback,
        improvedSentence: verification.improvedSentence,
      });
    } catch (error) {
      console.error("Failed to verify sentence:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextWord = () => {
    if (!practiceWords.length) return;
    const currentIndex = practiceWords.findIndex((w) => w._id === selectedWord?._id);
    const nextIndex = (currentIndex + 1) % practiceWords.length;
    handleSelectWord(practiceWords[nextIndex]);
  };

  const handleTryAgain = () => {
    setSentence("");
    setResult(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <PenLine className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sign in to practice writing</h2>
          <p className="text-foreground-muted mb-4">
            Create sentences with your vocabulary and get AI feedback.
          </p>
          <SignInButton mode="modal">
            <Button>Sign In</Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (vocabulary === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <PenLine className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                Output Practice
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Write Sentences
            </h1>
            <p className="text-foreground-muted text-lg">
              Practice using your vocabulary in context
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        {practiceWords.length === 0 ? (
          // No words to practice
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-foreground-muted" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              No words to practice
            </h2>
            <p className="text-foreground-muted mb-6">
              Add vocabulary words to start practicing sentence writing.
            </p>
            <Button onClick={() => window.location.href = "/vocabulary"}>
              <BookOpen className="w-4 h-4 mr-2" />
              Go to Vocabulary
            </Button>
          </div>
        ) : !selectedWord ? (
          // Word selection
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Select a word to practice
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {practiceWords.slice(0, 10).map((word) => (
                <button
                  key={word._id}
                  onClick={() => handleSelectWord(word)}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-accent/50 hover:bg-accent/5 transition-all text-left"
                >
                  <div
                    className="text-xl font-semibold text-foreground mb-1"
                    style={{ fontFamily: word.language === "japanese" ? "var(--font-japanese)" : "inherit" }}
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
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-foreground-muted mb-1">Write a sentence using:</div>
                  <div
                    className="text-3xl font-bold text-foreground mb-2"
                    style={{ fontFamily: selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                  >
                    {selectedWord.word}
                  </div>
                  {selectedWord.reading && (
                    <div className="text-sm text-foreground-muted mb-2">
                      {selectedWord.reading}
                    </div>
                  )}
                  <div className="text-foreground">
                    {selectedWord.definitions.join("; ")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedWord(null)}
                  className="text-foreground-muted"
                >
                  Change word
                </Button>
              </div>
            </div>

            {/* Input area */}
            {!result && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Your sentence
                  </label>
                  <textarea
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    placeholder={`Write a sentence using "${selectedWord.word}"...`}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
                    style={{ fontFamily: selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit" }}
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
                        Checking...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Check Sentence
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
                <div className="bg-surface rounded-2xl border border-border p-6">
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
                          {result.isCorrect ? "Great job!" : "Good effort!"}
                        </div>
                        <div className="text-sm text-foreground-muted">
                          Overall score: {result.overallScore}/100
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
                    <ScoreBar label="Grammar" score={result.grammarScore} />
                    <ScoreBar label="Word Usage" score={result.usageScore} />
                    <ScoreBar label="Naturalness" score={result.naturalnessScore} />
                  </div>
                </div>

                {/* Your sentence */}
                <div className="bg-surface rounded-2xl border border-border p-6">
                  <div className="text-sm font-medium text-foreground-muted mb-2">Your sentence</div>
                  <div
                    className="text-lg text-foreground"
                    style={{ fontFamily: selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                  >
                    {sentence}
                  </div>
                </div>

                {/* Corrections */}
                {result.corrections.length > 0 && (
                  <div className="bg-surface rounded-2xl border border-border p-6">
                    <div className="text-sm font-medium text-foreground-muted mb-3">Corrections</div>
                    <div className="space-y-3">
                      {result.corrections.map((correction, i) => (
                        <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="line-through text-foreground-muted">{correction.original}</span>
                            <ChevronRight className="w-4 h-4 text-foreground-muted" />
                            <span className="text-amber-600 font-medium">{correction.corrected}</span>
                          </div>
                          <div className="text-sm text-foreground-muted">{correction.explanation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="bg-surface rounded-2xl border border-border p-6">
                  <div className="text-sm font-medium text-foreground-muted mb-2">Feedback</div>
                  <div className="text-foreground mb-4">{result.feedback}</div>
                  {result.improvedSentence && (
                    <div>
                      <div className="text-sm font-medium text-foreground-muted mb-2">
                        {result.improvedSentence === sentence ? "Alternative expression" : "Suggested improvement"}
                      </div>
                      <div
                        className="text-lg text-green-600 bg-green-500/5 p-3 rounded-lg border border-green-500/20"
                        style={{ fontFamily: selectedWord.language === "japanese" ? "var(--font-japanese)" : "inherit" }}
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
                    Try Again
                  </Button>
                  <Button onClick={handleNextWord} className="flex-1 gap-2">
                    <ChevronRight className="w-4 h-4" />
                    Next Word
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="sentences"
      />
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
  const config: Record<string, { color: string; label: string }> = {
    beginner: { color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Beginner" },
    intermediate: { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Intermediate" },
    advanced: { color: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Advanced" },
  };

  const { color, label } = config[level.toLowerCase()] || config.beginner;

  return (
    <div className="group relative">
      <div className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${color}`}>
        {label}
      </div>
      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-surface border border-border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
        <div className="text-xs text-foreground-muted">{explanation}</div>
      </div>
    </div>
  );
}

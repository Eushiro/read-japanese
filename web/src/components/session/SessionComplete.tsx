import { ArrowRight, BookOpen, Brain, Flame, PenLine, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SessionResults } from "@/contexts/StudySessionContext";
import { useT } from "@/lib/i18n";

interface SessionCompleteProps {
  results: SessionResults;
  onContinue: () => void;
  onDone: () => void;
}

export function SessionComplete({ results, onContinue, onDone }: SessionCompleteProps) {
  const t = useT();
  const hasActivity =
    results.cardsReviewed > 0 || results.contentConsumed || results.sentencesWritten > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in-up">
        {/* Celebration */}
        <div className="text-6xl mb-6">
          {results.streakInfo?.isNewRecord ? (
            <span role="img" aria-label="trophy">
              <Trophy className="w-20 h-20 text-yellow-500 mx-auto" />
            </span>
          ) : (
            <span role="img" aria-label="celebration">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <span className="text-5xl">🎉</span>
              </div>
            </span>
          )}
        </div>

        <h1
          className="text-3xl font-bold text-foreground mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("studySession.complete.title")}
        </h1>

        {/* Streak display */}
        {results.streakInfo && results.streakInfo.currentStreak > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-600 font-semibold mb-6">
            <Flame className="w-5 h-5" />
            <span>
              {t("studySession.complete.streak", { count: results.streakInfo.currentStreak })}
            </span>
            {results.streakInfo.isNewRecord && (
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full ml-1">
                {t("studySession.complete.newRecord")}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        {hasActivity && (
          <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
            <div className="space-y-3">
              {results.cardsReviewed > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <Brain className="w-4 h-4" />
                    <span>{t("studySession.complete.stats.cardsReviewed")}</span>
                  </div>
                  <span className="font-semibold text-foreground">{results.cardsReviewed}</span>
                </div>
              )}

              {results.contentConsumed && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <BookOpen className="w-4 h-4" />
                    <span>{results.contentConsumed.type === "story" ? "Read" : "Watched"}</span>
                  </div>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {results.contentConsumed.title}
                  </span>
                </div>
              )}

              {results.wordsAdded > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <BookOpen className="w-4 h-4" />
                    <span>Words added</span>
                  </div>
                  <span className="font-semibold text-foreground">{results.wordsAdded}</span>
                </div>
              )}

              {results.sentencesWritten > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground-muted">
                    <PenLine className="w-4 h-4" />
                    <span>Sentences written</span>
                  </div>
                  <span className="font-semibold text-foreground">{results.sentencesWritten}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Encouragement */}
        <p className="text-foreground-muted mb-8">
          Great work! Consistent practice is the key to mastery.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onDone} className="flex-1">
            Done for Today
          </Button>
          <Button onClick={onContinue} className="flex-1 gap-2">
            Continue Studying
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

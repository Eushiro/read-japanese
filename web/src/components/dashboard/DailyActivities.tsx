import { Link } from "@tanstack/react-router";
import { BookOpen, Brain, ChevronRight, PenLine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface DailyActivitiesProps {
  dueCards: number;
  wordsToPractice: number;
  continueReading?: {
    storyId: string;
    storyTitle: string;
    progress: number;
  } | null;
}

export function DailyActivities({
  dueCards,
  wordsToPractice,
  continueReading,
}: DailyActivitiesProps) {
  const t = useT();
  const hasActivities = dueCards > 0 || wordsToPractice > 0 || continueReading;

  if (!hasActivities) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2
          className="text-lg font-semibold text-foreground mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("dashboard.dailyActivities.title")}
        </h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <p className="text-foreground-muted mb-4">
            {t("dashboard.dailyActivities.noActivities")}
          </p>
          <Link to="/library">
            <Button>
              <BookOpen className="w-4 h-4 mr-2" />
              {t("common.actions.browseLibrary")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2
        className="text-lg font-semibold text-foreground mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("dashboard.dailyActivities.title")}
      </h2>

      <div className="space-y-3">
        {/* Due flashcards */}
        {dueCards > 0 && (
          <Link
            to="/learn"
            search={{ tab: "review" }}
            className="flex items-center justify-between p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {t("dashboard.dailyActivities.flashcardsDue", { count: dueCards })}
                </div>
                <div className="text-sm text-foreground-muted">
                  {t("dashboard.dailyActivities.flashcardsSubtitle")}
                </div>
              </div>
            </div>
            <Button size="sm" className="group-hover:bg-accent">
              {t("dashboard.dailyActivities.review")}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}

        {/* Words to practice */}
        {wordsToPractice > 0 && (
          <Link
            to="/learn"
            search={{ tab: "practice" }}
            className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <PenLine className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {t("dashboard.dailyActivities.wordsToPractice", { count: wordsToPractice })}
                </div>
                <div className="text-sm text-foreground-muted">
                  {t("dashboard.dailyActivities.wordsSubtitle")}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="group-hover:border-accent group-hover:text-accent"
            >
              {t("dashboard.dailyActivities.practice")}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}

        {/* Continue reading */}
        {continueReading && (
          <Link
            to="/read/$storyId"
            params={{ storyId: continueReading.storyId }}
            className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {t("dashboard.dailyActivities.continueReading")}
                </div>
                <div className="text-sm text-foreground-muted">
                  {t("dashboard.dailyActivities.readingProgress", {
                    title: continueReading.storyTitle,
                    progress: continueReading.progress,
                  })}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="group-hover:border-accent group-hover:text-accent"
            >
              {t("dashboard.dailyActivities.continue")}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

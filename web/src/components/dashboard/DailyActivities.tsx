import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brain, PenLine, BookOpen, ChevronRight, Sparkles } from "lucide-react";

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
  const hasActivities = dueCards > 0 || wordsToPractice > 0 || continueReading;

  if (!hasActivities) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2
          className="text-lg font-semibold text-foreground mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Today's Activities
        </h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <p className="text-foreground-muted mb-4">
            No activities pending. Start by reading a story!
          </p>
          <Link to="/library">
            <Button>
              <BookOpen className="w-4 h-4 mr-2" />
              Browse Library
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
        Today's Activities
      </h2>

      <div className="space-y-3">
        {/* Due flashcards */}
        {dueCards > 0 && (
          <Link
            to="/learn?tab=review"
            className="flex items-center justify-between p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {dueCards} flashcard{dueCards !== 1 ? "s" : ""} due
                </div>
                <div className="text-sm text-foreground-muted">
                  Review to strengthen memory
                </div>
              </div>
            </div>
            <Button size="sm" className="group-hover:bg-accent">
              Review
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}

        {/* Words to practice */}
        {wordsToPractice > 0 && (
          <Link
            to="/learn?tab=practice"
            className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <PenLine className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  {wordsToPractice} word{wordsToPractice !== 1 ? "s" : ""} to practice
                </div>
                <div className="text-sm text-foreground-muted">
                  Write sentences to master vocabulary
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" className="group-hover:border-accent group-hover:text-accent">
              Practice
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}

        {/* Continue reading */}
        {continueReading && (
          <Link
            to={`/read/${continueReading.storyId}`}
            className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">
                  Continue reading
                </div>
                <div className="text-sm text-foreground-muted">
                  {continueReading.storyTitle} ({continueReading.progress}% complete)
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" className="group-hover:border-accent group-hover:text-accent">
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

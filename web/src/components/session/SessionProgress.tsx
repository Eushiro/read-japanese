import { BookOpen, Brain, PenLine } from "lucide-react";

import type { SessionActivity } from "@/contexts/StudySessionContext";
import { useT } from "@/lib/i18n";

interface SessionProgressProps {
  activities: SessionActivity[];
  currentIndex: number;
}

export function SessionProgress({ activities, currentIndex }: SessionProgressProps) {
  const t = useT();

  const getActivityLabel = (activity: SessionActivity): string => {
    switch (activity.type) {
      case "review":
        return t("studySession.progress.review");
      case "input":
        return activity.contentType === "story" ? t("studySession.progress.read") : t("studySession.progress.watch");
      case "output":
        return t("studySession.progress.write");
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {activities.map((activity, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={`w-8 h-0.5 ${isComplete ? "bg-accent" : "bg-border"} transition-colors`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : isComplete
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-foreground-muted"
              }`}
            >
              <ActivityIcon type={activity.type} className="w-4 h-4" />
              <span className="hidden sm:inline">{getActivityLabel(activity)}</span>
              <span className="sm:hidden">{index + 1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityIcon({ type, className }: { type: SessionActivity["type"]; className?: string }) {
  switch (type) {
    case "review":
      return <Brain className={className} />;
    case "input":
      return <BookOpen className={className} />;
    case "output":
      return <PenLine className={className} />;
  }
}


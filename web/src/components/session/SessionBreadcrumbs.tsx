import { motion } from "framer-motion";
import { BookOpen, Brain, Check, PenLine, Video } from "lucide-react";

import type { SessionActivity } from "@/contexts/StudySessionContext";
import { useT } from "@/lib/i18n";

interface SessionBreadcrumbsProps {
  activities: SessionActivity[];
  currentIndex: number;
}

export function SessionBreadcrumbs({ activities, currentIndex }: SessionBreadcrumbsProps) {
  const t = useT();

  const getActivityIcon = (activity: SessionActivity) => {
    switch (activity.type) {
      case "review":
        return Brain;
      case "input":
        return activity.contentType === "story" ? BookOpen : Video;
      case "output":
        return PenLine;
    }
  };

  const getActivityLabel = (activity: SessionActivity) => {
    switch (activity.type) {
      case "review":
        return t("studySession.breadcrumbs.review");
      case "input":
        return activity.contentType === "story"
          ? t("studySession.breadcrumbs.read")
          : t("studySession.breadcrumbs.watch");
      case "output":
        return t("studySession.breadcrumbs.practice");
    }
  };

  const getActivityDetail = (activity: SessionActivity) => {
    switch (activity.type) {
      case "review":
        return t("studySession.breadcrumbs.cardCount", { count: activity.cardCount });
      case "input":
        return activity.title;
      case "output":
        return t("studySession.breadcrumbs.sentenceCount", { count: activity.wordCount });
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {activities.map((activity, index) => {
        const Icon = getActivityIcon(activity);
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={index} className="flex items-center gap-2 sm:gap-3">
            {/* Activity indicator */}
            <motion.div
              initial={false}
              animate={{
                scale: isCurrent ? 1.05 : 1,
                opacity: isPending ? 0.4 : 1,
              }}
              className="flex items-center gap-2"
            >
              {/* Icon bubble */}
              <div
                className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors ${
                  isComplete
                    ? "bg-accent text-white"
                    : isCurrent
                      ? "bg-accent/20 text-accent ring-2 ring-accent/30"
                      : "bg-muted text-foreground-muted"
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ opacity: 0.3 }}
                  />
                )}
              </div>

              {/* Labels - hidden on mobile */}
              <div className="hidden sm:block text-left">
                <div
                  className={`text-xs font-medium ${
                    isCurrent
                      ? "text-accent"
                      : isComplete
                        ? "text-foreground"
                        : "text-foreground-muted"
                  }`}
                >
                  {getActivityLabel(activity)}
                </div>
                <div className="text-xs text-foreground-muted truncate max-w-[80px]">
                  {getActivityDetail(activity)}
                </div>
              </div>
            </motion.div>

            {/* Connector line */}
            {index < activities.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 transition-colors ${
                  index < currentIndex ? "bg-accent" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight, BookmarkCheck, Brain, PenLine, PlayCircle } from "lucide-react";

import { useT } from "@/lib/i18n";

interface LearningLoopVizProps {
  stats: {
    contentConsumed: number;
    wordsSaved: number;
    cardsReviewed: number;
    sentencesWritten: number;
  };
}

export function LearningLoopViz({ stats }: LearningLoopVizProps) {
  const t = useT();

  const steps = [
    {
      icon: PlayCircle,
      step: 1,
      title: t("dashboard.learningLoop.steps.input.title"),
      stat: stats.contentConsumed,
      label: t("dashboard.learningLoop.labels.completed"),
      description: t("dashboard.learningLoop.steps.input.description"),
      to: "/library",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: BookmarkCheck,
      step: 2,
      title: t("dashboard.learningLoop.steps.capture.title"),
      stat: stats.wordsSaved,
      label: t("dashboard.learningLoop.labels.vocabulary"),
      description: t("dashboard.learningLoop.steps.capture.description"),
      to: "/learn?tab=words",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Brain,
      step: 3,
      title: t("dashboard.learningLoop.steps.review.title"),
      stat: stats.cardsReviewed,
      label: t("dashboard.learningLoop.labels.reviewed"),
      description: t("dashboard.learningLoop.steps.review.description"),
      to: "/learn?tab=review",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: PenLine,
      step: 4,
      title: t("dashboard.learningLoop.steps.output.title"),
      stat: stats.sentencesWritten,
      label: t("dashboard.learningLoop.labels.sentences"),
      description: t("dashboard.learningLoop.steps.output.description"),
      to: "/learn?tab=practice",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2
        className="text-lg font-semibold text-foreground mb-6 text-center"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("dashboard.learningLoop.title")}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <Link
            key={step.step}
            to={step.to}
            className="group relative flex flex-col items-center p-4 rounded-xl hover:bg-muted/50 transition-colors"
          >
            {/* Arrow connector (hidden on mobile, visible on sm+) */}
            {index < steps.length - 1 && (
              <ArrowRight className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted z-10" />
            )}

            {/* Step number badge */}
            <div className="relative mb-3">
              <div
                className={`w-14 h-14 rounded-2xl ${step.bgColor} flex items-center justify-center group-hover:scale-105 transition-transform`}
              >
                <step.icon className={`w-7 h-7 ${step.color}`} />
              </div>
              <div
                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center`}
              >
                {step.step}
              </div>
            </div>

            {/* Title */}
            <div className="text-sm font-medium text-foreground mb-1">{step.title}</div>

            {/* Stat */}
            <div className={`text-2xl font-bold ${step.color}`}>{step.stat}</div>
            <div className="text-xs text-foreground-muted">{step.label}</div>
          </Link>
        ))}
      </div>

      {/* Loop indicator */}
      <div className="flex items-center justify-center mt-4 text-xs text-foreground-muted">
        <span>{t("dashboard.learningLoop.completeLoop")}</span>
      </div>
    </div>
  );
}

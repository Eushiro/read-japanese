import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface QuestionNavigationProps {
  // Navigation state
  currentIndex: number;
  totalQuestions: number;
  isAnswered: boolean;

  // Callbacks
  onPrevious?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  onFinish?: () => void;

  // Loading states
  isSubmitting?: boolean;
  isGrading?: boolean;

  // Disable conditions
  canSubmit?: boolean;

  // Custom labels
  submitLabel?: string;
  nextLabel?: string;
  finishLabel?: string;

  // Layout variant
  variant?: "spread" | "stacked";
}

export function QuestionNavigation({
  currentIndex,
  totalQuestions,
  isAnswered,
  onPrevious,
  onNext,
  onSubmit,
  onFinish,
  isSubmitting = false,
  isGrading = false,
  canSubmit = true,
  submitLabel,
  nextLabel,
  finishLabel,
  variant = "spread",
}: QuestionNavigationProps) {
  const t = useT();

  // Use translated defaults if no custom labels provided
  const resolvedSubmitLabel = submitLabel ?? t("navigation.submitAnswer");
  const resolvedNextLabel = nextLabel ?? t("navigation.nextQuestion");
  const resolvedFinishLabel = finishLabel ?? t("navigation.finishQuiz");
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isLoading = isSubmitting || isGrading;

  const containerClass = variant === "spread" ? "flex justify-between" : "flex gap-3";

  return (
    <div className={`${containerClass} mt-6`}>
      {/* Previous button */}
      {variant === "spread" ? (
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstQuestion || !onPrevious}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("navigation.previous")}
        </Button>
      ) : (
        !isFirstQuestion &&
        onPrevious && (
          <Button variant="outline" onClick={onPrevious} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            {t("navigation.previous")}
          </Button>
        )
      )}

      {/* Main action button */}
      <div className={variant === "stacked" ? "flex-1" : ""}>
        {!isAnswered ? (
          // Submit button
          <Button
            onClick={isGrading ? undefined : onSubmit}
            disabled={!isGrading && (!canSubmit || isLoading)}
            aria-disabled={isGrading || undefined}
            className={cn(
              "gap-2",
              variant === "stacked" && "w-full",
              isGrading && "pointer-events-none animate-pulse"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isGrading ? t("navigation.grading") : t("navigation.submitting")}
              </>
            ) : (
              resolvedSubmitLabel
            )}
          </Button>
        ) : isLastQuestion ? (
          // Finish button
          <Button onClick={onFinish} className={`gap-2 ${variant === "stacked" ? "w-full" : ""}`}>
            {resolvedFinishLabel}
          </Button>
        ) : (
          // Next button
          <Button onClick={onNext} className={`gap-2 ${variant === "stacked" ? "w-full" : ""}`}>
            {resolvedNextLabel}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Progress dots component
export interface QuestionProgressProps {
  questions: Array<{ userAnswer?: string }>;
  currentIndex: number;
  onNavigate?: (index: number) => void;
}

export function QuestionProgress({ questions, currentIndex, onNavigate }: QuestionProgressProps) {
  const t = useT();

  return (
    <div className="flex items-center gap-1">
      {questions.map((q, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = q.userAnswer !== undefined;
        const questionLabel = t("navigation.questionNumber", {
          current: i + 1,
          total: questions.length,
        });
        const answeredSuffix = isAnswered ? ` (${t("navigation.answered")})` : "";

        return (
          <button
            key={i}
            onClick={() => onNavigate?.(i)}
            disabled={!onNavigate}
            className={`h-2 rounded-full transition-all hover:opacity-80 ${
              isCurrent ? "bg-accent w-4" : isAnswered ? "bg-green-500 w-2" : "bg-border w-2"
            } ${onNavigate ? "cursor-pointer" : "cursor-default"}`}
            title={`${questionLabel}${answeredSuffix}`}
          />
        );
      })}
    </div>
  );
}

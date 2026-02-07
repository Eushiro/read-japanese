import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";

import { ProgressSquares } from "./ProgressSquares";
import { ScoreBar } from "./ScoreBar";
import type { QuestionViewProps } from "./types";
import { getFontFamily } from "./types";

export function QuestionTranslation({
  question,
  language,
  totalQuestions,
  currentIndex,
  previousResults,
  showFeedback,
  isSubmitting,
  currentAnswer,
  selectedAnswer,
  onSelectAnswer,
  onSubmit,
  onNext,
  isLastQuestion,
}: QuestionViewProps) {
  const t = useT();
  const fontFamily = getFontFamily(language);
  const [localInput, setLocalInput] = useState("");

  const handleInputChange = (value: string) => {
    setLocalInput(value);
    onSelectAnswer(value);
  };

  const scorePercent = currentAnswer
    ? Math.round((currentAnswer.earnedPoints / question.points) * 100)
    : 0;

  const resultsWithCurrent = [...previousResults];
  if (showFeedback && currentAnswer) {
    if (scorePercent >= 80) resultsWithCurrent[currentIndex] = "correct";
    else if (scorePercent >= 50) resultsWithCurrent[currentIndex] = "partial";
    else resultsWithCurrent[currentIndex] = "incorrect";
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background w-full">
      {/* Progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <ProgressSquares
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          previousResults={resultsWithCurrent}
          isAnswered={showFeedback}
        />
      </div>

      {/* Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "45vh" }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Prompt */}
          {question.questionTranslation && (
            <motion.p
              className="text-lg md:text-xl mb-4 text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {question.questionTranslation}
            </motion.p>
          )}

          {/* Question text */}
          <motion.p
            className="text-3xl md:text-4xl lg:text-5xl leading-relaxed text-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ fontFamily }}
          >
            {question.question}
          </motion.p>
        </motion.div>
      </div>

      {/* Lower: Text input + button */}
      <div className="flex flex-col items-center px-6 w-full">
        <div className="w-full max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
          >
            <Textarea
              value={selectedAnswer || localInput}
              onChange={(e) => handleInputChange(e.target.value)}
              readOnly={showFeedback || isSubmitting}
              disabled={isSubmitting && !showFeedback}
              placeholder={t("adaptivePractice.typeAnswer")}
              rows={2}
              className={`rounded-xl px-6 py-5 text-xl resize-none ${
                isSubmitting && !showFeedback
                  ? "border-accent animate-pulse"
                  : showFeedback
                    ? scorePercent >= 80
                      ? "border-[#4ade80] focus-visible:border-[#4ade80] focus-visible:ring-[#4ade80]/20"
                      : scorePercent >= 50
                        ? "border-[#f59e0b] focus-visible:border-[#f59e0b] focus-visible:ring-[#f59e0b]/20"
                        : "border-[#ef4444] focus-visible:border-[#ef4444] focus-visible:ring-[#ef4444]/20"
                    : ""
              }`}
              style={{ fontFamily: "var(--font-sans)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !showFeedback) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
          </motion.div>
        </div>

        <div className="mt-3">
          <Button
            variant="default"
            className="px-6 text-base rounded-xl"
            onClick={showFeedback ? onNext : onSubmit}
            disabled={!showFeedback && (!selectedAnswer?.trim() || isSubmitting)}
          >
            {showFeedback
              ? isLastQuestion
                ? t("adaptivePractice.finishPractice")
                : `${t("adaptivePractice.nextQuestion")} \u2192`
              : isSubmitting
                ? t("adaptivePractice.grading")
                : t("common.actions.submit")}
          </Button>
        </div>

        {/* Feedback after submission */}
        <div className="w-full max-w-xl">
          <AnimatePresence>
            {showFeedback && currentAnswer && (
              <motion.div
                className="mt-3 space-y-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.2 }}
              >
                {scorePercent >= 80 ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5" style={{ color: "#4ade80" }} />
                    <span style={{ color: "#4ade80" }} className="text-lg font-medium">
                      {t("adaptivePractice.feedback.correct")}
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-foreground-muted text-sm">
                      {t("adaptivePractice.feedback.correctAnswer")}:
                    </p>
                    <p className="text-accent text-lg font-medium" style={{ fontFamily }}>
                      {question.correctAnswer}
                    </p>
                  </div>
                )}

                {/* AI Score Bar */}
                <ScoreBar label={t("adaptivePractice.aiScore")} score={scorePercent} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

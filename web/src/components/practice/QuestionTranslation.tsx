import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { difficultyToExamLabel, getLevelVariant } from "@/lib/levels";

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
  onGoToQuestion,
  isLastQuestion,
  isGeneratingMore,
  generatingMessage,
}: QuestionViewProps) {
  const t = useT();
  const fontFamily = getFontFamily(language);
  const [localInput, setLocalInput] = useState(currentAnswer?.userAnswer ?? "");
  const levelLabel = question.difficulty
    ? difficultyToExamLabel(question.difficulty, language as ContentLanguage)
    : undefined;

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
          onGoToQuestion={onGoToQuestion}
          isGeneratingMore={isGeneratingMore}
          generatingMessage={generatingMessage}
          difficultyBadge={
            levelLabel ? (
              <Badge variant={getLevelVariant(levelLabel)} className="text-[10px] px-1.5 py-0">
                {levelLabel}
              </Badge>
            ) : undefined
          }
        />
      </div>

      {/* Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16 pb-8"
        style={{ height: "40vh" }}
      >
        <div className="max-w-2xl w-full space-y-4 text-center">
          {question.passageText ? (
            /* ── Layout with separate passage + instruction ── */
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <motion.p
                className="text-3xl md:text-4xl leading-relaxed text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ fontFamily }}
              >
                {question.passageText}
              </motion.p>

              <motion.p
                className="text-2xl text-foreground/80"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {question.question}
              </motion.p>

              {question.questionTranslation &&
                question.questionTranslation !== question.question &&
                question.type !== "translation" && (
                  <motion.p
                    className="text-lg italic text-foreground/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {question.questionTranslation}
                  </motion.p>
                )}
            </motion.div>
          ) : (
            /* ── Backward compat (no passageText) ── */
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <motion.p
                className="text-3xl md:text-4xl leading-relaxed text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ fontFamily }}
              >
                {question.question}
              </motion.p>

              {question.questionTranslation &&
                question.questionTranslation !== question.question &&
                question.type !== "translation" && (
                  <motion.p
                    className="text-lg italic text-foreground/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {question.questionTranslation}
                  </motion.p>
                )}
            </motion.div>
          )}
        </div>
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
            disabled={
              (!showFeedback && (!selectedAnswer?.trim() || isSubmitting)) ||
              (showFeedback && isLastQuestion && isGeneratingMore)
            }
          >
            {showFeedback
              ? isLastQuestion && isGeneratingMore
                ? t("adaptivePractice.waiting")
                : isLastQuestion
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

                {/* AI Feedback */}
                {currentAnswer.feedback && (
                  <p
                    className="text-foreground-muted text-sm"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {currentAnswer.feedback}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

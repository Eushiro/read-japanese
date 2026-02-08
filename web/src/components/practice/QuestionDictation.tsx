import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { difficultyToExamLabel, getLevelVariant } from "@/lib/levels";

import { ProgressSquares } from "./ProgressSquares";
import { ScoreBar } from "./ScoreBar";
import type { QuestionViewProps } from "./types";
import { getDiff, getFontFamily } from "./types";

export function QuestionDictation({
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
  isAdmin,
  isLastQuestion,
  isGeneratingMore,
  generatingMessage,
}: QuestionViewProps) {
  const t = useT();
  const fontFamily = getFontFamily(language);
  const levelLabel = question.difficulty
    ? difficultyToExamLabel(question.difficulty, language as ContentLanguage)
    : undefined;
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [localInput, setLocalInput] = useState(currentAnswer?.userAnswer ?? "");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else if (question.audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(question.audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audio.play().catch(() => setIsPlaying(false));
      setHasPlayed(true);
    }
  }, [isPlaying, question.audioUrl]);

  const handleInputChange = (value: string) => {
    setLocalInput(value);
    onSelectAnswer(value);
  };

  // Calculate diff and accuracy for display
  const diff = showFeedback ? getDiff((selectedAnswer || "").trim(), question.correctAnswer) : [];
  const matchCount = diff.filter((d) => d.status === "match").length;
  const accuracy = diff.length > 0 ? Math.round((matchCount / diff.length) * 100) : 0;

  const resultsWithCurrent = [...previousResults];
  if (showFeedback && currentAnswer) {
    if (accuracy >= 80) resultsWithCurrent[currentIndex] = "correct";
    else if (accuracy >= 50) resultsWithCurrent[currentIndex] = "partial";
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
          isAdmin={isAdmin}
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

      {/* Upper: Audio Player */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "45vh" }}
      >
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.button
            onClick={handlePlayToggle}
            className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer outline-none relative"
            style={{
              border: `2px solid ${isPlaying ? "var(--color-accent)" : "var(--color-border)"}`,
              backgroundColor: "transparent",
            }}
            whileHover={{ borderColor: "var(--color-accent)" }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying && (
              <motion.div
                className="absolute w-20 h-20 rounded-full"
                style={{ border: "2px solid var(--color-accent)" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {isPlaying ? (
              <Pause className="w-8 h-8 text-accent" />
            ) : (
              <Play className="w-8 h-8 text-foreground-muted ml-1" />
            )}
          </motion.button>

          <motion.p
            className="text-sm text-foreground-muted mt-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {isPlaying
              ? t("adaptivePractice.playing")
              : hasPlayed
                ? t("adaptivePractice.playAgain")
                : t("adaptivePractice.listenAndType")}
          </motion.p>
        </motion.div>

        {/* After submit: reveal correct sentence with diff */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <p
                className="text-sm text-foreground-muted mb-2"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {t("adaptivePractice.feedback.correctAnswer")}:
              </p>
              <p className="text-2xl md:text-3xl leading-relaxed" style={{ fontFamily }}>
                {diff.map((d, i) => (
                  <span
                    key={i}
                    style={{
                      color:
                        d.status === "match"
                          ? "var(--color-foreground)"
                          : d.status === "wrong"
                            ? "var(--color-accent)"
                            : d.status === "extra"
                              ? "#ef4444"
                              : undefined,
                      textDecoration:
                        d.status === "missing"
                          ? "underline"
                          : d.status === "extra"
                            ? "line-through"
                            : undefined,
                      textDecorationColor:
                        d.status === "missing" || d.status === "extra" ? "#ef4444" : undefined,
                    }}
                    className={d.status === "missing" ? "text-accent" : ""}
                  >
                    {d.char}
                  </span>
                ))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
                    ? accuracy >= 80
                      ? "border-[#4ade80] focus-visible:border-[#4ade80] focus-visible:ring-[#4ade80]/20"
                      : accuracy >= 50
                        ? "border-[#f59e0b] focus-visible:border-[#f59e0b] focus-visible:ring-[#f59e0b]/20"
                        : "border-[#ef4444] focus-visible:border-[#ef4444] focus-visible:ring-[#ef4444]/20"
                    : ""
              }`}
              style={{ fontFamily }}
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

        {/* Accuracy score after submission */}
        <div className="w-full max-w-xl mt-3">
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ScoreBar label={t("adaptivePractice.accuracy")} score={accuracy} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

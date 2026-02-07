import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/lib/i18n";

import { MCQGrid } from "./MCQGrid";
import { ProgressSquares } from "./ProgressSquares";
import type { QuestionViewProps } from "./types";
import { getFontFamily } from "./types";

export function QuestionListening({
  question,
  language,
  totalQuestions,
  currentIndex,
  previousResults,
  onSelectAnswer,
  onSubmit,
  onNext,
  isLastQuestion,
}: QuestionViewProps) {
  const t = useT();
  const [confirmedOption, setConfirmedOption] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stable ref prevents re-fire when callback identity changes
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Auto-submit answer when user selects an option so it gets recorded
  useEffect(() => {
    if (confirmedOption !== null) {
      onSubmitRef.current();
    }
  }, [confirmedOption]);

  const options = useMemo(() => question.options ?? [], [question.options]);
  const correctAnswerIndex = options.indexOf(question.correctAnswer);
  const isCorrect = confirmedOption !== null && confirmedOption === correctAnswerIndex;
  const fontFamily = getFontFamily(language);

  // Cleanup audio on unmount
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

  const handleOptionClick = useCallback(
    (index: number) => {
      if (confirmedOption !== null) return;
      setConfirmedOption(index);
      onSelectAnswer(options[index]);

      if (index === correctAnswerIndex) {
        setTimeout(() => setShowCompleted(true), 500);
      }
    },
    [confirmedOption, correctAnswerIndex, onSelectAnswer, options]
  );

  const resultsWithCurrent = [...previousResults];
  if (confirmedOption !== null) {
    resultsWithCurrent[currentIndex] = isCorrect ? "correct" : "incorrect";
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background w-full">
      {/* Progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <ProgressSquares
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          previousResults={resultsWithCurrent}
          isAnswered={confirmedOption !== null}
        />
      </div>

      {/* Upper: Audio Player + Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "45vh" }}
      >
        {/* Audio Player */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
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
            {isPlaying ? (
              <>
                <motion.div
                  className="absolute w-20 h-20 rounded-full"
                  style={{ border: "2px solid var(--color-accent)" }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <Pause className="w-8 h-8 text-accent" />
              </>
            ) : (
              <Play className="w-8 h-8 text-foreground-muted ml-1" />
            )}
          </motion.button>

          <motion.p
            className="text-sm text-foreground-muted mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {isPlaying
              ? t("adaptivePractice.playingAudio")
              : hasPlayed
                ? t("adaptivePractice.tapToReplay")
                : t("adaptivePractice.tapToPlayAudio")}
          </motion.p>
        </motion.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          {showCompleted ? (
            <motion.p
              key="completed"
              className="text-2xl md:text-3xl text-center leading-relaxed text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{ fontFamily }}
            >
              {question.question}
            </motion.p>
          ) : (
            <motion.p
              key="question"
              className="text-2xl md:text-3xl text-center leading-relaxed text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.4 }}
              style={{ fontFamily }}
            >
              {question.question}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* MCQ Grid */}
      <MCQGrid
        options={options}
        correctAnswer={question.correctAnswer}
        confirmedOption={confirmedOption}
        onOptionClick={handleOptionClick}
        fontFamily={fontFamily}
        isCorrect={isCorrect}
        onNext={onNext}
        isLastQuestion={isLastQuestion}
        entranceDelay={0.5}
      />
    </div>
  );
}

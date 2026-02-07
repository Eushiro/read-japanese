import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MCQGrid } from "./MCQGrid";
import { ProgressSquares } from "./ProgressSquares";
import type { QuestionViewProps } from "./types";
import { getFontFamily, splitBlankQuestion } from "./types";

const BLANK = "\uFF3F\uFF3F\uFF3F";

export function QuestionReading({
  question,
  content,
  language,
  totalQuestions,
  currentIndex,
  previousResults,
  onSelectAnswer,
  onSubmit,
  onNext,
  isLastQuestion,
}: QuestionViewProps) {
  const [confirmedOption, setConfirmedOption] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

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
  const blank = splitBlankQuestion(question.question);

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

      {/* Upper: Passage + Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "55vh" }}
      >
        <div className="max-w-lg w-full space-y-4">
          {/* Passage */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-xl leading-relaxed text-foreground" style={{ fontFamily }}>
              {question.passageText ?? content.content}
            </p>
            {content.translation && !question.passageText && (
              <p
                className="text-sm italic text-foreground/60 mt-2"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {content.translation}
              </p>
            )}
          </motion.div>

          {/* Separator */}
          <div className="border-b border-border" />

          {/* Question */}
          <AnimatePresence mode="wait">
            {showCompleted && blank ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <p
                  className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-foreground"
                  style={{ fontFamily }}
                >
                  {blank.before}
                  <span style={{ color: "#4ade80" }}>{question.correctAnswer}</span>
                  {blank.after}
                </p>
                {question.questionTranslation && (
                  <p
                    className="text-base mt-3 italic text-foreground/60"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {question.questionTranslation}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="question"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p
                  className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-foreground"
                  style={{ fontFamily }}
                >
                  {blank ? (
                    <>
                      {blank.before}
                      <span className="text-accent">{BLANK}</span>
                      {blank.after}
                    </>
                  ) : (
                    question.question
                  )}
                </p>
                {question.questionTranslation && (
                  <motion.p
                    className="text-base mt-3 italic text-foreground/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {question.questionTranslation}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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

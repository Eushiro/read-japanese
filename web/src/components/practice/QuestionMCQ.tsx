import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";

import { MCQGrid } from "./MCQGrid";
import { ProgressSquares } from "./ProgressSquares";
import type { QuestionViewProps } from "./types";
import { getFontFamily, splitBlankQuestion } from "./types";

const BLANK = "\uFF3F\uFF3F\uFF3F";

export function QuestionMCQ({
  question,
  language,
  totalQuestions,
  currentIndex,
  previousResults,
  onSelectAnswer,
  onNext,
  isLastQuestion,
}: QuestionViewProps) {
  const [confirmedOption, setConfirmedOption] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

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

  // Build results including the current answer
  const resultsWithCurrent = [...previousResults];
  if (confirmedOption !== null) {
    resultsWithCurrent[currentIndex] = isCorrect ? "correct" : "incorrect";
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background">
      {/* Progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <ProgressSquares
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          previousResults={resultsWithCurrent}
          isAnswered={confirmedOption !== null}
        />
      </div>

      {/* Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "45vh" }}
      >
        <AnimatePresence mode="wait">
          {showCompleted && blank ? (
            <motion.div
              key="completed"
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <p
                className="text-3xl md:text-4xl lg:text-5xl leading-relaxed text-foreground"
                style={{ fontFamily }}
              >
                {blank.before}
                <span style={{ color: "#4ade80" }}>{question.correctAnswer}</span>
                {blank.after}
              </p>
              {question.questionTranslation && (
                <p
                  className="text-base mt-6 italic text-foreground/60"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {question.questionTranslation}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="question"
              className="text-center"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p
                className="text-3xl md:text-4xl lg:text-5xl leading-relaxed text-foreground"
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
                  className="text-base mt-6 italic text-foreground/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {question.questionTranslation}
                </motion.p>
              )}
            </motion.div>
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
      />
    </div>
  );
}

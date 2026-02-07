import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  currentAnswer,
  onSelectAnswer,
  onSubmit,
  onNext,
  onGoToQuestion,
  isLastQuestion,
  isGeneratingMore,
  generatingMessage,
}: QuestionViewProps) {
  // When revisiting an answered question, initialize from the existing answer
  const initOptions = question.options ?? [];
  const initialOption = currentAnswer?.userAnswer
    ? initOptions.indexOf(currentAnswer.userAnswer)
    : null;
  const initialConfirmed = initialOption !== null && initialOption !== -1 ? initialOption : null;

  const [confirmedOption, setConfirmedOption] = useState<number | null>(initialConfirmed);
  const [showCompleted, setShowCompleted] = useState(
    initialConfirmed !== null && currentAnswer?.isCorrect === true
  );

  // Stable ref prevents re-fire when callback identity changes
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Track whether this is a revisit (already answered on mount)
  const isRevisit = useRef(initialConfirmed !== null);

  // Auto-submit answer when user selects an option so it gets recorded
  useEffect(() => {
    if (confirmedOption !== null && !isRevisit.current) {
      onSubmitRef.current();
    }
    // Clear revisit flag after first render
    isRevisit.current = false;
  }, [confirmedOption]);

  const options = useMemo(() => question.options ?? [], [question.options]);
  const correctAnswerIndex = options.indexOf(question.correctAnswer);
  const isCorrect = confirmedOption !== null && confirmedOption === correctAnswerIndex;
  const fontFamily = getFontFamily(language);
  const hasPassage = !!question.passageText;
  const blank = splitBlankQuestion(question.passageText ?? question.question);

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
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background w-full">
      {/* Progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <ProgressSquares
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          previousResults={resultsWithCurrent}
          isAnswered={confirmedOption !== null}
          onGoToQuestion={onGoToQuestion}
          isGeneratingMore={isGeneratingMore}
          generatingMessage={generatingMessage}
        />
      </div>

      {/* Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16 pb-8"
        style={{ height: "40vh" }}
      >
        {hasPassage ? (
          /* ── Layout with separate passage + instruction ── */
          <div className="max-w-2xl w-full space-y-4 text-center">
            <AnimatePresence mode="wait">
              {showCompleted && blank ? (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <p
                    className="text-3xl md:text-4xl leading-relaxed text-foreground"
                    style={{ fontFamily }}
                  >
                    {blank.before}
                    <span style={{ color: "#4ade80" }}>{question.correctAnswer}</span>
                    {blank.after}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="passage"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p
                    className="text-3xl md:text-4xl leading-relaxed text-foreground"
                    style={{ fontFamily }}
                  >
                    {blank ? (
                      <>
                        {blank.before}
                        <span className="text-accent">{BLANK}</span>
                        {blank.after}
                      </>
                    ) : (
                      question.passageText
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-2xl text-foreground/80">{question.question}</p>
            {question.questionTranslation && question.questionTranslation !== question.question && (
              <p
                className="text-lg italic text-foreground/60"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {question.questionTranslation}
              </p>
            )}
          </div>
        ) : (
          /* ── Original layout (no passageText — backward compat) ── */
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
                {question.questionTranslation &&
                  question.questionTranslation !== question.question && (
                    <p
                      className="text-lg mt-3 italic text-foreground/60"
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
                {question.questionTranslation &&
                  question.questionTranslation !== question.question && (
                    <motion.p
                      className="text-lg mt-3 italic text-foreground/60"
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
        )}
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
        isGeneratingMore={isGeneratingMore}
      />
    </div>
  );
}

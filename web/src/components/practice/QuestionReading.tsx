import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useUILanguage } from "@/lib/i18n";
import { difficultyToExamLabel, getLevelVariant } from "@/lib/levels";

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
    isRevisit.current = false;
  }, [confirmedOption]);

  const options = useMemo(() => question.options ?? [], [question.options]);
  const correctAnswerIndex = options.indexOf(question.correctAnswer);
  const isCorrect = confirmedOption !== null && confirmedOption === correctAnswerIndex;
  const { language: uiLanguage } = useUILanguage();
  const fontFamily = getFontFamily(language);
  const blank = splitBlankQuestion(question.question);
  const levelLabel = question.difficulty
    ? difficultyToExamLabel(question.difficulty, language as ContentLanguage)
    : undefined;

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

      {/* Upper: Passage + Question */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16 pb-8"
        style={{ height: "40vh" }}
      >
        <div className="max-w-2xl w-full space-y-4 text-center">
          {/* Passage (hidden when no passage text) */}
          {(question.passageText ?? content.content) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p
                className="text-3xl md:text-4xl leading-relaxed text-foreground"
                style={{ fontFamily }}
              >
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
          )}

          {/* Question */}
          <AnimatePresence mode="wait">
            {showCompleted && blank ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-2xl leading-relaxed text-foreground/80" style={{ fontFamily }}>
                  {blank.before}
                  <span style={{ color: "#4ade80" }}>{question.correctAnswer}</span>
                  {blank.after}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="question"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-2xl leading-relaxed text-foreground/80" style={{ fontFamily }}>
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
                {question.translations?.[uiLanguage] &&
                  question.translations?.[uiLanguage] !== question.question &&
                  !blank && (
                    <motion.p
                      className="text-lg mt-3 italic text-foreground/60"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {question.translations?.[uiLanguage]}
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
        isGeneratingMore={isGeneratingMore}
        entranceDelay={0.5}
        optionTranslations={question.optionTranslations?.[uiLanguage]}
      />
    </div>
  );
}

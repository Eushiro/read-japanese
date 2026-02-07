import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

const ERROR = "#ef4444";

interface MCQGridProps {
  options: string[];
  correctAnswer: string;
  confirmedOption: number | null;
  onOptionClick: (index: number) => void;
  fontFamily: string;
  /** Whether the correct option was selected */
  isCorrect: boolean;
  /** Show next button and trigger callback */
  onNext: () => void;
  isLastQuestion: boolean;
  /** Whether more questions are being generated */
  isGeneratingMore?: boolean;
  /** Delay entrance animation (for reading/listening where content appears first) */
  entranceDelay?: number;
}

export function MCQGrid({
  options,
  correctAnswer,
  confirmedOption,
  onOptionClick,
  fontFamily,
  isCorrect,
  onNext,
  isLastQuestion,
  isGeneratingMore,
  entranceDelay = 0.3,
}: MCQGridProps) {
  const t = useT();
  const [hasInteracted, setHasInteracted] = useState(false);
  const isIncorrect = confirmedOption !== null && !isCorrect;
  const correctAnswerIndex = options.indexOf(correctAnswer);

  const handleClick = (index: number) => {
    if (confirmedOption !== null) return;
    setHasInteracted(true);
    onOptionClick(index);
  };

  return (
    <div className="flex flex-col items-center px-6 w-full">
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {options.map((option, index) => {
          const isConfirmed = confirmedOption === index;
          const isCorrectOption = index === correctAnswerIndex;

          let textColor = "var(--color-foreground)";
          let textDecoration: string | undefined = undefined;
          let scale = 1;
          let opacity = 1;
          let borderColor = "var(--color-border)";
          let bgColor = "color-mix(in srgb, var(--color-foreground) 4%, transparent)";

          if (confirmedOption !== null) {
            if (isCorrect) {
              if (isConfirmed) {
                textColor = "#4ade80";
                borderColor = "#4ade80";
                bgColor = "rgba(74,222,128,0.12)";
                scale = 1.03;
              } else {
                opacity = 0.3;
              }
            } else if (isIncorrect) {
              if (isConfirmed) {
                textColor = ERROR;
                borderColor = ERROR;
                bgColor = "rgba(239,68,68,0.1)";
                textDecoration = "line-through";
              } else if (isCorrectOption) {
                textColor = "#4ade80";
                borderColor = "#4ade80";
                bgColor = "rgba(74,222,128,0.12)";
              } else {
                opacity = 0.3;
              }
            }
          }

          return (
            <motion.button
              key={option}
              onClick={() => handleClick(index)}
              disabled={confirmedOption !== null}
              className="cursor-pointer disabled:cursor-default rounded-xl px-8 py-7 outline-none text-center"
              style={{
                fontFamily,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor,
                backgroundColor: bgColor,
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity,
                y: 0,
                scale,
                color: textColor,
                ...(isIncorrect && isCorrectOption
                  ? {
                      color: [
                        "#4ade80",
                        "rgba(74,222,128,0.5)",
                        "#4ade80",
                        "rgba(74,222,128,0.5)",
                        "#4ade80",
                      ],
                    }
                  : {}),
              }}
              transition={{
                opacity: {
                  duration: 0.4,
                  delay:
                    confirmedOption !== null
                      ? 0.1
                      : hasInteracted
                        ? 0
                        : entranceDelay + index * 0.08,
                },
                y: {
                  duration: 0.5,
                  delay: hasInteracted ? 0 : entranceDelay + index * 0.08,
                  ease: [0.19, 1, 0.22, 1],
                },
                scale: { duration: 0.4 },
                color:
                  isIncorrect && isCorrectOption
                    ? { duration: 2.4, ease: "easeInOut" }
                    : { duration: 0.3 },
              }}
              whileHover={
                confirmedOption === null
                  ? {
                      scale: 1.03,
                      borderColor: "color-mix(in srgb, var(--color-foreground) 40%, transparent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--color-foreground) 8%, transparent)",
                    }
                  : undefined
              }
            >
              <span className="text-2xl md:text-3xl" style={{ textDecoration }}>
                {option}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Next button */}
      <div className="mt-4">
        <AnimatePresence>
          {confirmedOption !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <Button
                variant="default"
                size="lg"
                onClick={onNext}
                disabled={isLastQuestion && isGeneratingMore}
              >
                {isLastQuestion && isGeneratingMore
                  ? t("adaptivePractice.waiting")
                  : isLastQuestion
                    ? t("adaptivePractice.finishPractice")
                    : t("adaptivePractice.nextQuestion")}
                {!(isLastQuestion && isGeneratingMore) && <>&nbsp;→</>}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

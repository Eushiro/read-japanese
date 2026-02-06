import { motion } from "framer-motion";

import type { QuestionResult } from "./types";

interface ProgressSquaresProps {
  totalQuestions: number;
  currentIndex: number;
  previousResults: QuestionResult[];
  /** Whether the current question has been answered (stops pulsing) */
  isAnswered: boolean;
}

export function ProgressSquares({
  totalQuestions,
  currentIndex,
  previousResults,
  isAnswered,
}: ProgressSquaresProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalQuestions }).map((_, i) => {
        const result = previousResults[i];
        const isCurrent = i === currentIndex;
        const isFuture = result === null && !isCurrent;

        let bgColor = "transparent";
        let borderColor = "var(--color-border)";

        if (result === "correct") {
          bgColor = "#4ade80";
          borderColor = "#4ade80";
        } else if (result === "incorrect") {
          bgColor = "rgba(239,68,68,0.6)";
          borderColor = "rgba(239,68,68,0.6)";
        } else if (isCurrent) {
          borderColor = "var(--color-accent)";
        }

        return (
          <motion.div
            key={i}
            className="rounded-sm"
            style={{
              width: 12,
              height: 12,
              backgroundColor: bgColor,
              border: `1.5px solid ${isFuture ? "var(--color-foreground-muted)" : borderColor}`,
            }}
            animate={isCurrent && !isAnswered ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
            transition={
              isCurrent && !isAnswered
                ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

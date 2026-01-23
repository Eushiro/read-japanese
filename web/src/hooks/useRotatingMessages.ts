import { useState, useEffect, useMemo } from "react";

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Hook that cycles through an array of messages at a specified interval
 * Messages are shuffled once when isActive becomes true, and don't repeat until all are shown
 */
export function useRotatingMessages(
  messages: string[],
  isActive: boolean,
  intervalMs: number = 2500
): string {
  const [index, setIndex] = useState(0);
  const [shuffledMessages, setShuffledMessages] = useState<string[]>([]);

  // Shuffle messages when isActive becomes true
  useEffect(() => {
    if (isActive) {
      setShuffledMessages(shuffleArray(messages));
      setIndex(0);
    }
  }, [isActive, messages]);

  // Cycle through messages
  useEffect(() => {
    if (!isActive || shuffledMessages.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % shuffledMessages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isActive, shuffledMessages.length, intervalMs]);

  return shuffledMessages[index] || messages[0];
}

import { useState, useEffect } from "react";

/**
 * Hook that cycles through an array of messages at a specified interval
 * Resets to first message when isActive becomes false
 */
export function useRotatingMessages(
  messages: string[],
  isActive: boolean,
  intervalMs: number = 2500
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isActive, messages.length, intervalMs]);

  return messages[index];
}

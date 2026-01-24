import { useEffect, useMemo,useRef, useState } from "react";

/**
 * Shuffle array using Fisher-Yates algorithm with optional seed
 */
function shuffleArray<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  // Simple seeded PRNG if seed provided
  let random: () => number;
  if (seed !== undefined) {
    let s = seed;
    random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  } else {
    random = Math.random;
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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
  // Track activation count to create a new shuffle seed each time isActive becomes true
  const [activationCount, setActivationCount] = useState(0);
  const wasActiveRef = useRef(false);

  // Detect when isActive transitions from false to true
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      // Transitioned to active - increment counter to trigger new shuffle
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset on activation transition
      setActivationCount((c) => c + 1);
      setIndex(0);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Compute shuffled messages based on activation count (stable per activation)
  const shuffledMessages = useMemo(() => {
    if (!isActive || messages.length === 0) return messages;
    // Use activationCount as seed for reproducible-but-varied shuffle
    return shuffleArray(messages, activationCount * 12345 + messages.length);
  }, [messages, isActive, activationCount]);

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

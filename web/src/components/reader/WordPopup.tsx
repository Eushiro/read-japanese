import type { Token } from "@/types/story";

interface WordPopupProps {
  token: Token;
  position: { x: number; y: number };
  onClose: () => void;
  // From ReaderPage
  storyId?: string;
  storyTitle?: string;
  sourceContext?: string;
  // From EmbeddedStoryReader
  segmentText?: string;
  userId?: string;
}

// Placeholder component - to be implemented
export function WordPopup(_props: WordPopupProps) {
  return null;
}

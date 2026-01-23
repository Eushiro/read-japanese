import { useEffect } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

/**
 * Preloads audio and image assets from a flashcard.
 * Can be used standalone or is called automatically by useFlashcard hook.
 */
export function preloadFlashcardAssets(flashcard: {
  wordAudioUrl?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
} | null | undefined) {
  if (!flashcard) return;

  // Preload word audio
  if (flashcard.wordAudioUrl) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = flashcard.wordAudioUrl;
  }

  // Preload sentence audio
  if (flashcard.audioUrl) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = flashcard.audioUrl;
  }

  // Preload image
  if (flashcard.imageUrl) {
    const img = new Image();
    img.src = flashcard.imageUrl;
  }
}

/**
 * Hook to fetch a flashcard by vocabulary ID with automatic asset preloading.
 * When the flashcard data loads or URLs are updated (e.g., after generation),
 * images and audio are automatically preloaded.
 */
export function useFlashcard(vocabularyId: Id<"vocabulary"> | string | undefined) {
  const flashcard = useQuery(
    api.flashcards.getByVocabulary,
    vocabularyId ? { vocabularyId: vocabularyId as Id<"vocabulary"> } : "skip"
  );

  // Preload assets when URLs change (initial load or after generation)
  useEffect(() => {
    preloadFlashcardAssets(flashcard);
  }, [flashcard?.wordAudioUrl, flashcard?.audioUrl, flashcard?.imageUrl]);

  return flashcard;
}

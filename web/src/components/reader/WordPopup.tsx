import { useAction,useMutation, useQuery } from "convex/react";
import { Check, Minus,Plus } from "lucide-react";
import { useEffect, useRef,useState } from "react";

import { type DictionaryEntry,lookupWord } from "@/api/dictionary";
import { getCurrentUserId } from "@/hooks/useSettings";
import { useT } from "@/lib/i18n";
import type { Token } from "@/types/story";
import { getTokenReading } from "@/types/story";

import { api } from "../../../convex/_generated/api";

// Clean up verbose part of speech strings from dictionary
function cleanPartOfSpeech(pos: string): string {
  // Remove Japanese terms in parentheses like (futsuumeishi), (fukushi), etc.
  let cleaned = pos.replace(/\s*\([^)]*meishi[^)]*\)/gi, "");
  cleaned = cleaned.replace(/\s*\(fukushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(keiyoushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(keiyoudoushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(doushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(rentaishi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(kandoushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(setsuzokushi\)/gi, "");
  cleaned = cleaned.replace(/\s*\(jodoushi\)/gi, "");
  // Clean up multiple spaces and trailing commas
  cleaned = cleaned.replace(/,\s*,/g, ",").replace(/,\s*$/g, "").trim();
  return cleaned;
}

interface WordPopupProps {
  token: Token;
  position: { x: number; y: number };
  storyId: string;
  storyTitle: string;
  sourceContext?: string; // The sentence where the word appears
  onClose: () => void;
}

export function WordPopup({
  token,
  position,
  storyId,
  storyTitle,
  sourceContext,
  onClose,
}: WordPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justRemoved, setJustRemoved] = useState(false);

  const userId = getCurrentUserId();
  const addVocabulary = useMutation(api.vocabulary.add);
  const removeVocabulary = useMutation(api.vocabulary.remove);
  const generateFlashcardWithAudio = useAction(api.ai.generateFlashcardWithAudio);

  const word = token.baseForm || token.surface;
  const reading = getTokenReading(token) || token.surface;

  // Check subscription for premium features
  const subscription = useQuery(api.subscriptions.get, { userId });
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Check if word is already in vocabulary
  const existingVocab = useQuery(api.vocabulary.getByWord, {
    userId,
    word: token.surface,
  });

  // Determine saved state (query result, but allow local override for immediate feedback)
  const isSaved =
    justSaved || (existingVocab !== null && existingVocab !== undefined && !justRemoved);

  // Look up the word
  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      try {
        const result = await lookupWord(word);
        if (!cancelled) {
          setEntry(result);
        }
      } catch {
        // Silently fail - we'll just show the word without definition
      }
    }

    lookup();

    return () => {
      cancelled = true;
    };
  }, [word]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Small delay to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const vocabId = await addVocabulary({
        userId,
        word: token.surface,
        reading: reading,
        definitions: entry?.meanings || ["(No definition)"],
        partOfSpeech: entry?.partOfSpeech || token.partOfSpeech,
        language: "japanese",
        sourceType: "story",
        sourceStoryId: storyId,
        sourceStoryTitle: storyTitle,
        sourceContext: sourceContext, // The sentence where the word was found
        flashcardPending: isPremiumUser ? true : undefined, // Mark as pending if premium user will generate flashcard
      });
      setJustSaved(true);
      setJustRemoved(false);

      // Auto-generate AI flashcard in background for premium users only
      if (vocabId && isPremiumUser) {
        generateFlashcardWithAudio({
          vocabularyId: vocabId,
          includeAudio: true,
          includeImage: true,
        }).catch((err) => {
          console.error("Background AI flashcard generation failed:", err);
        });
      }
    } catch (err) {
      console.error("Failed to save vocabulary:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || !existingVocab) return;

    setIsProcessing(true);
    try {
      await removeVocabulary({ id: existingVocab._id });
      setJustRemoved(true);
      setJustSaved(false);
    } catch (err) {
      console.error("Failed to remove vocabulary:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate position - keep popup within viewport
  const calculatePosition = () => {
    const popupWidth = 280;
    const popupHeight = 160;
    const padding = 12;

    let left = position.x - popupWidth / 2;
    let top = position.y;

    // Keep within horizontal bounds
    if (left < padding) left = padding;
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding;
    }

    // If popup would go below viewport, show above the word
    if (top + popupHeight > window.innerHeight - padding) {
      top = position.y - popupHeight - 40; // 40px to account for the word height
    }

    return { left, top };
  };

  const pos = calculatePosition();

  const displayMeaning = entry?.meanings[0];
  const displayReading = entry?.reading || reading;
  const displayPos = entry?.partOfSpeech || token.partOfSpeech;

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 100,
      }}
      className="w-70 bg-surface border border-border rounded-xl shadow-lg overflow-hidden animate-scale-in"
      role="tooltip"
    >
      {/* Main content */}
      <div className="p-3">
        {/* Word and reading */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-lg font-semibold text-foreground leading-tight"
              style={{ fontFamily: "var(--font-japanese)" }}
            >
              {token.surface}
            </div>
            {displayReading !== token.surface && (
              <div className="text-sm text-foreground-muted">{displayReading}</div>
            )}
          </div>

          {/* Save/Remove button */}
          {isSaved ? (
            <button
              onClick={handleRemove}
              disabled={isProcessing}
              className="shrink-0 p-1.5 rounded-lg transition-all bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive"
              title="Remove from vocabulary"
            >
              {isProcessing ? (
                <Check className="w-4 h-4 animate-pulse" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="shrink-0 p-1.5 rounded-lg transition-all bg-accent/10 text-accent hover:bg-accent/20"
              title="Save to vocabulary"
            >
              {isProcessing ? (
                <Plus className="w-4 h-4 animate-pulse" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Meaning */}
        {displayMeaning && (
          <div className="mt-2 text-sm text-foreground line-clamp-2">{displayMeaning}</div>
        )}

        {/* Part of speech */}
        {displayPos && (
          <div className="mt-1.5 text-xs text-foreground-muted">
            {cleanPartOfSpeech(displayPos)}
          </div>
        )}
      </div>
    </div>
  );
}

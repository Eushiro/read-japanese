import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { lookupWord, type DictionaryEntry } from "@/api/dictionary";
import type { Token } from "@/types/story";
import { getTokenReading } from "@/types/story";
import { Plus, Check, ExternalLink } from "lucide-react";
import { getCurrentUserId } from "@/hooks/useSettings";

interface WordPopupProps {
  token: Token;
  position: { x: number; y: number };
  storyId: string;
  storyTitle: string;
  onClose: () => void;
}

export function WordPopup({
  token,
  position,
  storyId,
  storyTitle,
  onClose,
}: WordPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addVocabulary = useMutation(api.vocabulary.add);

  const word = token.baseForm || token.surface;
  const reading = getTokenReading(token) || token.surface;

  // Look up the word
  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      try {
        const result = await lookupWord(word);
        if (!cancelled) {
          setEntry(result);
        }
      } catch (err) {
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
    if (isSaved || isSaving) return;

    setIsSaving(true);
    try {
      await addVocabulary({
        userId: getCurrentUserId(),
        word: token.surface,
        reading: reading,
        meaning: entry?.meanings[0] || "(No definition)",
        partOfSpeech: entry?.partOfSpeech || token.partOfSpeech,
        sourceStoryId: storyId,
        sourceStoryTitle: storyTitle,
      });
      setIsSaved(true);
    } catch (err) {
      console.error("Failed to save vocabulary:", err);
    } finally {
      setIsSaving(false);
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
              style={{ fontFamily: 'var(--font-japanese)' }}
            >
              {token.surface}
            </div>
            {displayReading !== token.surface && (
              <div className="text-sm text-foreground-muted">{displayReading}</div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className={`shrink-0 p-1.5 rounded-lg transition-all ${
              isSaved
                ? "bg-success/10 text-success"
                : "bg-accent/10 text-accent hover:bg-accent/20"
            }`}
            title={isSaved ? "Saved" : "Save to vocabulary"}
          >
            {isSaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Part of speech */}
        {displayPos && (
          <div className="mt-1.5 text-xs text-foreground-muted">
            {displayPos}
          </div>
        )}

        {/* Meaning */}
        {displayMeaning && (
          <div className="mt-2 text-sm text-foreground line-clamp-2">
            {displayMeaning}
          </div>
        )}

        {/* Jisho link */}
        <a
          href={`https://jisho.org/search/${encodeURIComponent(word)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:underline"
        >
          More on Jisho
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

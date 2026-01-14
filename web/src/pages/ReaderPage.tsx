import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ChapterView } from "@/components/reader/ChapterView";
import { WordPopup } from "@/components/reader/WordPopup";
import { AudioPlayer } from "@/components/reader/AudioPlayer";
import { FuriganaText } from "@/components/reader/FuriganaText";
import { useStory } from "@/hooks/useStory";
import { useSettings } from "@/hooks/useSettings";
import { getAudioUrl } from "@/api/stories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Token, JLPTLevel } from "@/types/story";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const levelVariantMap: Record<JLPTLevel, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

export function ReaderPage() {
  const { storyId } = useParams({ from: "/read/$storyId" });
  const navigate = useNavigate();
  const { story, isLoading, error } = useStory(storyId);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [audioTime, setAudioTime] = useState(0);
  const [manualNavigation, setManualNavigation] = useState(false);

  // Reset scroll position when entering the reader or changing story
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [storyId]);

  // Get settings from Convex
  const { settings, setShowFurigana } = useSettings();
  const showFurigana = settings.showFurigana;

  const chapters = story?.chapters || [];
  const currentChapter = chapters[currentChapterIndex];

  // Auto-advance chapters based on audio time (skip if user manually navigated)
  useEffect(() => {
    if (!chapters.length || audioTime === 0 || manualNavigation) return;

    // Find which chapter contains the current audio time
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const segments = chapter.segments || chapter.content || [];

      if (segments.length === 0) continue;

      // Get the time range for this chapter
      const firstSegmentWithTime = segments.find(s => s.audioStartTime !== undefined);
      const lastSegmentWithTime = [...segments].reverse().find(s => s.audioEndTime !== undefined);

      if (!firstSegmentWithTime || !lastSegmentWithTime) continue;

      const chapterStart = firstSegmentWithTime.audioStartTime!;
      const chapterEnd = lastSegmentWithTime.audioEndTime!;

      // Check if audio time falls within this chapter
      if (audioTime >= chapterStart && audioTime <= chapterEnd) {
        if (i !== currentChapterIndex) {
          setCurrentChapterIndex(i);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        break;
      }
    }
  }, [audioTime, chapters, currentChapterIndex, manualNavigation]);

  // Re-enable auto-advance when audio catches up to manually selected chapter
  useEffect(() => {
    if (!manualNavigation || !chapters.length) return;

    const currentChapter = chapters[currentChapterIndex];
    const segments = currentChapter?.segments || currentChapter?.content || [];
    if (segments.length === 0) return;

    const firstSegmentWithTime = segments.find(s => s.audioStartTime !== undefined);
    const lastSegmentWithTime = [...segments].reverse().find(s => s.audioEndTime !== undefined);
    if (!firstSegmentWithTime || !lastSegmentWithTime) return;

    // If audio time is now within the manually selected chapter, re-enable auto-advance
    if (audioTime >= firstSegmentWithTime.audioStartTime! && audioTime <= lastSegmentWithTime.audioEndTime!) {
      setManualNavigation(false);
    }
  }, [audioTime, chapters, currentChapterIndex, manualNavigation]);

  const handlePreviousChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setManualNavigation(true);
      setCurrentChapterIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentChapterIndex]);

  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      setManualNavigation(true);
      setCurrentChapterIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentChapterIndex, chapters.length]);

  const handleTokenClick = useCallback(
    (token: Token, event: React.MouseEvent) => {
      // Don't show popup for punctuation
      if (token.partOfSpeech === "punctuation" || token.partOfSpeech === "symbol") {
        return;
      }

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
      setSelectedToken(token);
    },
    []
  );

  const handleClosePopup = useCallback(() => {
    setSelectedToken(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded-lg w-1/3" />
            <div className="h-6 bg-muted rounded-lg w-1/4" />
            <div className="aspect-[16/9] bg-muted rounded-xl" />
            <div className="space-y-3 pt-4">
              <div className="h-5 bg-muted rounded" />
              <div className="h-5 bg-muted rounded w-5/6" />
              <div className="h-5 bg-muted rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-foreground-muted">
            <p className="text-lg font-medium text-destructive">
              {error?.message || "Story not found"}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/library" })}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/library" })}
                className="shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1
                  className="font-semibold text-foreground truncate"
                  style={{ fontFamily: 'var(--font-japanese)' }}
                >
                  {story.metadata.titleTokens ? (
                    story.metadata.titleTokens.map((token, i) => (
                      <FuriganaText
                        key={i}
                        token={token}
                        showFurigana={showFurigana}
                        onClick={(e) => handleTokenClick(token, e)}
                      />
                    ))
                  ) : (
                    story.metadata.titleJapanese || story.metadata.title
                  )}
                </h1>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Badge
                    variant={levelVariantMap[story.metadata.jlptLevel]}
                    className="text-xs"
                  >
                    {story.metadata.jlptLevel}
                  </Badge>
                  <span>{story.metadata.genre}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Player (compact in header) */}
              {story.metadata.audioURL && (
                <div className="hidden sm:block">
                  <AudioPlayer
                    src={getAudioUrl(story.metadata.audioURL)}
                    onTimeUpdate={setAudioTime}
                  />
                </div>
              )}

              {/* Furigana Toggle */}
              <button
                onClick={() => setShowFurigana(!showFurigana)}
                title={showFurigana ? "Hide furigana" : "Show furigana"}
                className={`relative px-2 py-1 rounded-lg transition-all ${
                  showFurigana
                    ? "bg-accent/10 text-accent"
                    : "bg-muted text-foreground-muted hover:bg-background-subtle"
                }`}
                style={{ fontFamily: 'var(--font-japanese)' }}
              >
                <span className="text-[10px] block leading-none mb-0.5 opacity-70">
                  {showFurigana ? "あ" : ""}
                </span>
                <span className="text-sm font-medium leading-none">漢</span>
                {!showFurigana && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-6 h-[2px] bg-foreground-muted rotate-[-20deg] rounded-full" />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Audio Player (shown below header on small screens) */}
          {story.metadata.audioURL && (
            <div className="sm:hidden mt-3">
              <AudioPlayer
                src={getAudioUrl(story.metadata.audioURL)}
                onTimeUpdate={setAudioTime}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Book-like reading area */}
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">

        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          {currentChapter ? (
            <ChapterView
              chapter={currentChapter}
              chapterIndex={currentChapterIndex}
              totalChapters={chapters.length}
              showFurigana={showFurigana}
              onTokenClick={handleTokenClick}
              currentAudioTime={audioTime}
            />
          ) : (
            <div className="text-center text-foreground-muted py-12">
              No chapters available
            </div>
          )}
        </div>
      </main>

      {/* Chapter Navigation */}
      {chapters.length > 1 && (
        <nav className="sticky bottom-0 border-t border-border bg-surface/95 backdrop-blur-md">
          <div className="container mx-auto px-4 sm:px-6 py-4 max-w-3xl">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePreviousChapter}
                disabled={currentChapterIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {chapters.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setManualNavigation(true);
                      setCurrentChapterIndex(index);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentChapterIndex
                        ? "bg-accent w-6"
                        : "bg-border hover:bg-foreground-muted"
                    }`}
                    aria-label={`Go to chapter ${index + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                onClick={handleNextChapter}
                disabled={currentChapterIndex === chapters.length - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </nav>
      )}

      {/* Word Popup */}
      {selectedToken && (
        <WordPopup
          token={selectedToken}
          position={popupPosition}
          storyId={story.id}
          storyTitle={story.metadata.title}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}

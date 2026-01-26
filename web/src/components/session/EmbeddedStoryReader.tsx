import { BookOpen, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { ChapterView } from "@/components/reader/ChapterView";
import { WordPopup } from "@/components/reader/WordPopup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { useStory } from "@/hooks/useStory";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { ProficiencyLevel, Token } from "@/types/story";

type BadgeVariant = "n5" | "n4" | "n3" | "n2" | "n1" | "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

const levelVariantMap: Record<ProficiencyLevel, BadgeVariant> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
  A1: "a1",
  A2: "a2",
  B1: "b1",
  B2: "b2",
  C1: "c1",
  C2: "c2",
};

interface EmbeddedStoryReaderProps {
  storyId: string;
  language: ContentLanguage;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function EmbeddedStoryReader({
  storyId,
  language,
  isOpen,
  onClose,
  onComplete,
}: EmbeddedStoryReaderProps) {
  const t = useT();
  const { story, isLoading, error } = useStory(isOpen ? storyId : undefined, language);
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const showFurigana = settings.showFurigana;

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedSegmentText, setSelectedSegmentText] = useState<string | undefined>(undefined);

  const chapters = story?.chapters || [];
  const currentChapter = chapters[currentChapterIndex];
  const totalChapters = chapters.length;

  // Handle token click for vocabulary popup
  const handleTokenClick = useCallback(
    (token: Token, event: React.MouseEvent, segmentText?: string) => {
      if (!token.isWord) return;

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
      setSelectedToken(token);
      setSelectedSegmentText(segmentText);
    },
    []
  );

  const closePopup = useCallback(() => {
    setSelectedToken(null);
    setSelectedSegmentText(undefined);
  }, []);

  const goToNextChapter = () => {
    if (currentChapterIndex < totalChapters - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      closePopup();
    }
  };

  const goToPrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      closePopup();
    }
  };

  const handleClose = () => {
    closePopup();
    setCurrentChapterIndex(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-8">
              <DialogTitle className="text-lg truncate">
                {story?.metadata?.title ?? "Loading..."}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {story?.metadata?.level && levelVariantMap[story.metadata.level] && (
                  <Badge variant={levelVariantMap[story.metadata.level]}>
                    {story.metadata.level}
                  </Badge>
                )}
                {totalChapters > 1 && (
                  <span className="text-sm text-foreground-muted">
                    {t("reader.chapter.progress", { current: currentChapterIndex + 1, total: totalChapters })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 pt-2 max-h-[calc(90vh-160px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : error || !story ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-foreground-muted mb-3" />
              <p className="text-foreground-muted">
                {error ? t("reader.errors.failedToLoad") : t("reader.errors.storyNotFound")}
              </p>
            </div>
          ) : currentChapter ? (
            <ChapterView
              chapter={currentChapter}
              chapterIndex={currentChapterIndex}
              totalChapters={totalChapters}
              showFurigana={showFurigana}
              onTokenClick={handleTokenClick}
              selectedToken={selectedToken}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-foreground-muted">{t("reader.errors.noContent")}</p>
            </div>
          )}
        </div>

        {/* Footer with navigation and complete button */}
        <div className="p-4 pt-0 border-t border-border">
          <div className="flex items-center justify-between gap-3">
            {/* Chapter navigation */}
            <div className="flex items-center gap-2">
              {totalChapters > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevChapter}
                    disabled={currentChapterIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextChapter}
                    disabled={currentChapterIndex === totalChapters - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Complete button */}
            <Button onClick={onComplete} className="gap-2">
              <Check className="w-4 h-4" />
              {t("reader.actions.doneReading")}
            </Button>
          </div>
        </div>

        {/* Word Popup */}
        {selectedToken && isAuthenticated && user && (
          <WordPopup
            token={selectedToken}
            segmentText={selectedSegmentText}
            position={popupPosition}
            onClose={closePopup}
            userId={user.id}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

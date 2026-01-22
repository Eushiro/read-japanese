import { Segment } from "./Segment";
import { FuriganaText } from "./FuriganaText";
import { getCdnUrl } from "@/api/stories";
import type { Chapter, Token } from "@/types/story";
import { CheckCircle2 } from "lucide-react";

interface ChapterViewProps {
  chapter: Chapter;
  chapterIndex: number;
  totalChapters: number;
  showFurigana?: boolean;
  onTokenClick?: (token: Token, event: React.MouseEvent, segmentText?: string) => void;
  currentAudioTime?: number;
}

export function ChapterView({
  chapter,
  chapterIndex,
  totalChapters,
  showFurigana = true,
  onTokenClick,
  currentAudioTime,
}: ChapterViewProps) {
  const segments = chapter.segments || chapter.content || [];
  const imageUrl = chapter.imageURL ? getCdnUrl(chapter.imageURL) : null;

  return (
    <article className="space-y-6">
      {/* Chapter Header */}
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">
          Chapter {chapterIndex + 1} of {totalChapters}
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {chapter.titleTokens ? (
            <span className="leading-loose">
              {chapter.titleTokens.map((token, i) => (
                <FuriganaText
                  key={i}
                  token={token}
                  showFurigana={showFurigana}
                  onClick={(event) => onTokenClick?.(token, event)}
                />
              ))}
            </span>
          ) : (
            chapter.titleJapanese || chapter.title
          )}
        </h2>
        {chapter.titleEnglish && (
          <p className="text-lg text-muted-foreground">{chapter.titleEnglish}</p>
        )}
      </header>

      {/* Chapter Image */}
      {imageUrl && (
        <div className="rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={chapter.title}
            className="w-full max-h-96 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {segments.map((segment) => (
          <Segment
            key={segment.id}
            segment={segment}
            showFurigana={showFurigana}
            onTokenClick={onTokenClick}
            currentAudioTime={currentAudioTime}
          />
        ))}
      </div>

      {/* End of Story Indicator */}
      {chapterIndex === totalChapters - 1 && (
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-japanese)' }}>
                おめでとう！
              </p>
              <p className="text-sm text-foreground-muted mt-1">
                You've finished the story
              </p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

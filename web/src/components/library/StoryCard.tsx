import { Badge } from "@/components/ui/badge";
import { getCoverImageUrl } from "@/api/stories";
import type { StoryListItem, JLPTLevel } from "@/types/story";
import { Crown, BookOpen } from "lucide-react";

interface StoryCardProps {
  story: StoryListItem;
  progress?: number; // 0-100 percentage
  isPremiumUser?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const levelVariantMap: Record<JLPTLevel, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

export function StoryCard({
  story,
  progress,
  isPremiumUser = false,
  onClick,
  style,
}: StoryCardProps) {
  const isLocked = story.isPremium && !isPremiumUser;
  const coverUrl = getCoverImageUrl(story.coverImageURL);

  return (
    <article
      className="group cursor-pointer card-elevated overflow-hidden"
      onClick={onClick}
      style={style}
    >
      {/* Cover Image */}
      <div className="aspect-[3/4] relative bg-background-subtle overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={story.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted bg-gradient-to-br from-background-subtle to-muted">
            <BookOpen className="w-12 h-12 mb-2 opacity-30" />
            <span className="text-xs opacity-50">No cover</span>
          </div>
        )}

        {/* Gradient overlay for better badge visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* JLPT Level Badge */}
        <Badge
          variant={levelVariantMap[story.jlptLevel]}
          className="absolute top-3 left-3 shadow-sm"
        >
          {story.jlptLevel}
        </Badge>

        {/* Progress Bar */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Premium Lock Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] flex items-end justify-center pb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface/95 rounded-full shadow-sm border border-border">
              <Crown className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-foreground">
                Premium
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3
          className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-accent transition-colors"
          style={{ fontFamily: 'var(--font-japanese)' }}
        >
          {story.titleJapanese || story.title}
        </h3>
        {story.titleJapanese && (
          <p className="text-sm text-foreground-muted line-clamp-1 mt-0.5">
            {story.title}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-2 mt-3 text-xs text-foreground-muted">
          <span className="px-2 py-0.5 rounded-full bg-muted">{story.genre}</span>
          <span>•</span>
          <span>
            {story.chapterCount} {story.chapterCount === 1 ? "chapter" : "chapters"}
          </span>
        </div>
      </div>
    </article>
  );
}

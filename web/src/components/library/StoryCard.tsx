import { BookOpen, Crown } from "lucide-react";
import { useCallback, useState } from "react";

import { getCoverImageUrl, prefetchStory } from "@/api/stories";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import type { ProficiencyLevel, StoryListItem } from "@/types/story";

interface StoryCardProps {
  story: StoryListItem;
  progress?: number; // 0-100 percentage
  isPremiumUser?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

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

export function StoryCard({
  story,
  progress,
  isPremiumUser = false,
  onClick,
  style,
}: StoryCardProps) {
  const t = useT();
  const isLocked = story.isPremium && !isPremiumUser;
  const coverUrl = getCoverImageUrl(story.coverImageURL);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleMouseEnter = useCallback(() => {
    prefetchStory(story.id, story.language);
  }, [story.id, story.language]);

  return (
    <article
      className="group cursor-pointer card-elevated overflow-hidden"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      style={style}
    >
      {/* Cover Image */}
      <div className="aspect-[3/3.2] relative bg-background-subtle overflow-hidden">
        {coverUrl ? (
          <>
            {/* Skeleton while image loads */}
            {!imageLoaded && <div className="absolute inset-0 bg-border animate-pulse" />}
            <img
              src={coverUrl}
              alt={story.title}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted bg-gradient-to-br from-background-subtle to-muted">
            <BookOpen className="w-12 h-12 mb-2 opacity-30" />
            <span className="text-xs opacity-50">{t("common.content.noCover")}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/20 opacity-60 group-hover:opacity-40 transition-opacity duration-300" />

        {/* Level Badge - Prominent */}
        <Badge
          variant={levelVariantMap[story.level]}
          className="absolute top-2 left-2 px-2.5 py-1 text-sm font-bold shadow-xl ring-2 ring-white/30"
        >
          {story.level}
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
              <span className="text-xs font-medium text-foreground">{t("common.content.premium")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title - primary title with English translation for non-English stories */}
        <h3
          className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-accent transition-colors"
          style={{ fontFamily: story.language === "japanese" ? "var(--font-japanese)" : undefined }}
        >
          {story.title}
        </h3>
        {story.language !== "english" && (
          <p className="text-xs text-foreground-muted line-clamp-1 mt-1">
            {story.titleTranslations.en}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-2 mt-2 text-xs text-foreground">
          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground truncate max-w-[80px]">
            {story.genre}
          </span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">
            {story.chapterCount} {t("common.content.chapter", { count: story.chapterCount })}
          </span>
        </div>
      </div>
    </article>
  );
}

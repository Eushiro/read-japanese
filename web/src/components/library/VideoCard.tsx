import { Clock, Video } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { type Language, LANGUAGE_COLORS } from "@/lib/languages";
import { getLevelVariant } from "@/lib/levels";
import { getYoutubeThumbnailUrl, isValidYoutubeId } from "@/lib/youtube";

export interface VideoItem {
  _id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  language: Language;
  level?: string;
}

interface VideoCardProps {
  video: VideoItem;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function VideoCard({ video, onClick, style }: VideoCardProps) {
  const t = useT();
  const isRealVideo = isValidYoutubeId(video.videoId);
  const thumbnailUrl =
    video.thumbnailUrl || (isRealVideo ? getYoutubeThumbnailUrl(video.videoId) : null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const duration = formatDuration(video.duration);
  const langColor = LANGUAGE_COLORS[video.language] || LANGUAGE_COLORS.english;

  // Show placeholder if no valid thumbnail or image failed to load
  const showPlaceholder = !thumbnailUrl || imageError;

  return (
    <article
      className="group cursor-pointer card-elevated overflow-hidden"
      onClick={onClick}
      style={style}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative bg-background-subtle overflow-hidden">
        {showPlaceholder ? (
          /* Placeholder for demo videos */
          <div
            className={`absolute inset-0 ${langColor.bg} flex flex-col items-center justify-center`}
          >
            <Video className="w-12 h-12 text-white/60 mb-2" />
            <span className="text-white/80 font-medium text-lg">{langColor.text}</span>
          </div>
        ) : (
          <>
            {/* Skeleton while image loads */}
            {!imageLoaded && <div className="absolute inset-0 bg-border animate-pulse" />}
            <img
              src={thumbnailUrl}
              alt={video.title}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Gradient overlay for badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/30 opacity-70 group-hover:opacity-50 transition-opacity duration-300" />

        {/* Level Badge */}
        {getLevelVariant(video.level) && (
          <Badge
            variant={getLevelVariant(video.level)}
            className="absolute top-3 left-3 shadow-lg ring-2 ring-white/20"
          >
            {video.level}
          </Badge>
        )}

        {/* Duration Badge */}
        {duration && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
            <Clock className="w-3 h-3" />
            {duration}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-base text-foreground line-clamp-2 group-hover:text-accent transition-colors">
          {video.title}
        </h3>

        {video.description && (
          <p className="text-sm text-foreground-muted line-clamp-2 mt-1">{video.description}</p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-2 mt-3 text-xs text-foreground">
          <span className="px-2 py-0.5 rounded-full bg-muted text-foreground capitalize">
            {t("library.languages." + video.language)}
          </span>
          <span>•</span>
          <span>{t("library.video.badge")}</span>
        </div>
      </div>
    </article>
  );
}

export function VideoCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-surface animate-pulse"
      style={{
        boxShadow: "var(--shadow-card)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="aspect-video bg-border" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-border rounded w-4/5" />
        <div className="h-3 bg-border rounded w-full" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 bg-border rounded-full w-16" />
          <div className="h-5 bg-border rounded w-12" />
        </div>
      </div>
    </div>
  );
}

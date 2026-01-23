import { Badge } from "@/components/ui/badge";
import type { ProficiencyLevel } from "@/types/story";
import { Play, Clock, Video } from "lucide-react";
import { useState } from "react";

// Language-specific placeholder colors
const LANGUAGE_COLORS: Record<string, { bg: string; text: string }> = {
  japanese: { bg: "bg-red-600", text: "日本語" },
  english: { bg: "bg-blue-600", text: "English" },
  french: { bg: "bg-violet-600", text: "Français" },
};

// Check if video ID is a real YouTube ID
function isValidYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export interface VideoItem {
  _id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  language: "japanese" | "english" | "french";
  level?: string;
}

interface VideoCardProps {
  video: VideoItem;
  onClick?: () => void;
  style?: React.CSSProperties;
}

type BadgeVariant = "n5" | "n4" | "n3" | "n2" | "n1" | "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

const levelVariantMap: Record<string, BadgeVariant> = {
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

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function VideoCard({ video, onClick, style }: VideoCardProps) {
  const isRealVideo = isValidYoutubeId(video.videoId);
  const thumbnailUrl = video.thumbnailUrl || (isRealVideo ? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg` : null);
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
          <div className={`absolute inset-0 ${langColor.bg} flex flex-col items-center justify-center`}>
            <Video className="w-12 h-12 text-white/60 mb-2" />
            <span className="text-white/80 font-medium text-lg">{langColor.text}</span>
          </div>
        ) : (
          <>
            {/* Skeleton while image loads */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-border animate-pulse" />
            )}
            <img
              src={thumbnailUrl}
              alt={video.title}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-accent/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-white ml-1" fill="white" />
          </div>
        </div>

        {/* Gradient overlay for badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Level Badge */}
        {video.level && levelVariantMap[video.level] && (
          <Badge
            variant={levelVariantMap[video.level]}
            className="absolute top-3 left-3 shadow-sm"
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
        <h3
          className="font-semibold text-base text-foreground line-clamp-2 group-hover:text-accent transition-colors"
        >
          {video.title}
        </h3>

        {video.description && (
          <p className="text-sm text-foreground-muted line-clamp-2 mt-1">
            {video.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-2 mt-3 text-xs text-foreground-muted">
          <span className="px-2 py-0.5 rounded-full bg-muted capitalize">
            {video.language}
          </span>
          <span>•</span>
          <span>Video</span>
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
        boxShadow: 'var(--shadow-card)',
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

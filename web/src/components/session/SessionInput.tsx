import { useQuery } from "convex/react";
import { BookOpen, Loader2, Play, SkipForward } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmbeddedStoryReader } from "./EmbeddedStoryReader";
import { EmbeddedVideoPlayer } from "./EmbeddedVideoPlayer";

interface SessionInputProps {
  contentType: "story" | "video";
  contentId: string;
  title: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function SessionInput({
  contentType,
  contentId,
  title,
  onComplete,
  onSkip,
}: SessionInputProps) {
  const t = useT();
  const [isContentOpen, setIsContentOpen] = useState(false);

  // Fetch video details if it's a video
  const video = useQuery(
    api.youtubeContent.getById,
    contentType === "video" ? { id: contentId as Id<"youtubeContent"> } : "skip"
  );

  // Handle opening content in modal
  const handleOpenContent = () => {
    setIsContentOpen(true);
  };

  // Handle content modal close
  const handleContentClose = () => {
    setIsContentOpen(false);
  };

  // Handle content complete
  const handleContentComplete = () => {
    setIsContentOpen(false);
    onComplete();
  };

  // Show content preview card
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border mb-4">
          {contentType === "story" ? (
            <BookOpen className="w-4 h-4 text-accent" />
          ) : (
            <Play className="w-4 h-4 text-accent" />
          )}
          <span className="text-foreground-muted">
            {contentType === "story"
              ? t("studySession.input.readingTime")
              : t("studySession.input.listeningTime")}
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {contentType === "story"
            ? t("studySession.input.readAStory")
            : t("studySession.input.watchAVideo")}
        </h2>
        <p className="text-foreground-muted mt-2">
          {contentType === "story"
            ? t("studySession.input.storyDescription")
            : t("studySession.input.videoDescription")}
        </p>
      </div>

      {/* Content preview card */}
      <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
        {contentType === "video" && video ? (
          <>
            {/* Video thumbnail */}
            <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-4">
              {video.videoId && video.videoId.length === 11 ? (
                <img
                  src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-16 h-16 text-foreground-muted" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{video.title}</h3>
            {video.description && (
              <p className="text-sm text-foreground-muted line-clamp-2">{video.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3 text-sm text-foreground-muted">
              <span className="px-2 py-0.5 rounded-full bg-muted capitalize">{video.language}</span>
              {video.level && (
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  {video.level}
                </span>
              )}
              {video.duration && (
                <span>
                  {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
                </span>
              )}
            </div>
          </>
        ) : contentType === "story" ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-foreground-muted">{t("studySession.input.gradedStory")}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1 gap-2">
          <SkipForward className="w-4 h-4" />
          {t("studySession.buttons.skip")}
        </Button>
        <Button onClick={handleOpenContent} className="flex-1 gap-2">
          {contentType === "story" ? (
            <>
              <BookOpen className="w-4 h-4" />
              {t("studySession.buttons.startReading")}
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {t("studySession.buttons.startWatching")}
            </>
          )}
        </Button>
      </div>

      {/* Embedded Video Player Modal */}
      {contentType === "video" && (
        <EmbeddedVideoPlayer
          videoId={contentId}
          isOpen={isContentOpen}
          onClose={handleContentClose}
          onComplete={handleContentComplete}
        />
      )}

      {/* Embedded Story Reader Modal */}
      {contentType === "story" && (
        <EmbeddedStoryReader
          storyId={contentId}
          isOpen={isContentOpen}
          onClose={handleContentClose}
          onComplete={handleContentComplete}
        />
      )}
    </div>
  );
}

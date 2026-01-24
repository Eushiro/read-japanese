import { useQuery } from "convex/react";
import { Check,Clock, FileText, Video } from "lucide-react";
import { useCallback,useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";
import { levelVariantMap } from "@/lib/levels";
import { isValidYoutubeId } from "@/lib/youtube";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface EmbeddedVideoPlayerProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function EmbeddedVideoPlayer({
  videoId,
  isOpen,
  onClose,
  onComplete,
}: EmbeddedVideoPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<YT.Player | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const playerContainerId = `embedded-youtube-player-${videoId}`;

  // Fetch video content from Convex
  const video = useQuery(api.youtubeContent.get, {
    id: videoId as Id<"youtubeContent">,
  });

  const isRealYoutubeVideo = video?.videoId ? isValidYoutubeId(video.videoId) : false;

  // Load YouTube IFrame API
  useEffect(() => {
    if (!isOpen) return;
    if (window.YT) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as unknown as { onYouTubeIframeAPIReady: () => void }).onYouTubeIframeAPIReady = () => {
      // API is ready
    };
  }, [isOpen]);

  // Initialize YouTube player when dialog opens
  useEffect(() => {
    if (!isOpen || !video?.videoId || !window.YT?.Player || !isRealYoutubeVideo) return;

    // Wait a tick for the container to be rendered
    const timeout = setTimeout(() => {
      const container = document.getElementById(playerContainerId);
      if (!container) return;

      // Destroy existing player if any
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore errors
        }
      }

      playerRef.current = new window.YT.Player(playerContainerId, {
        videoId: video.videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: (_event: YT.OnStateChangeEvent) => {
            // Player state change handler
          },
          onReady: () => {
            const interval = setInterval(() => {
              if (playerRef.current) {
                const time = playerRef.current.getCurrentTime?.() || 0;
                setCurrentTime(time);
              }
            }, 500);
            return () => clearInterval(interval);
          },
        },
      });
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore errors
        }
        playerRef.current = null;
      }
    };
  }, [isOpen, video?.videoId, isRealYoutubeVideo, playerContainerId]);

  // Auto-scroll transcript to current segment
  useEffect(() => {
    if (!transcriptRef.current || !video?.transcript) return;

    const activeSegment = transcriptRef.current.querySelector('[data-active="true"]');
    if (activeSegment) {
      activeSegment.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime, video?.transcript]);

  // Seek to timestamp
  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo?.(time, true);
    playerRef.current?.playVideo?.();
  }, []);

  // Get current segment index
  const getCurrentSegmentIndex = () => {
    if (!video?.transcript) return -1;
    return video.transcript.findIndex((seg, i) => {
      const nextSeg = video.transcript?.[i + 1];
      return currentTime >= seg.start && (!nextSeg || currentTime < nextSeg.start);
    });
  };

  const currentSegmentIndex = getCurrentSegmentIndex();
  const hasTranscript = video?.transcript && video.transcript.length > 0;

  // Handle dialog close and cleanup
  const handleClose = () => {
    if (playerRef.current) {
      try {
        playerRef.current.pauseVideo?.();
      } catch {
        // Ignore errors
      }
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-8">
              <DialogTitle className="text-lg truncate">{video?.title ?? "Loading..."}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {video?.level && levelVariantMap[video.level] && (
                  <Badge variant={levelVariantMap[video.level]}>{video.level}</Badge>
                )}
                {video?.duration && (
                  <span className="text-sm text-foreground-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(video.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 p-4 pt-2 max-h-[calc(90vh-120px)] overflow-hidden">
          {/* Video Player */}
          <div className="space-y-3">
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              {isRealYoutubeVideo ? (
                <div id={playerContainerId} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                  <Video className="w-12 h-12 text-accent/50 mb-3" />
                  <p className="text-foreground-muted text-sm text-center px-4">
                    Demo content - read along below
                  </p>
                </div>
              )}
            </div>

            {/* Mark complete button */}
            <Button onClick={onComplete} className="w-full gap-2">
              <Check className="w-4 h-4" />
              Done Watching
            </Button>
          </div>

          {/* Transcript */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="font-medium text-foreground text-sm">Transcript</h2>
            </div>

            <div ref={transcriptRef} className="p-3 space-y-1.5 overflow-y-auto flex-1">
              {!hasTranscript ? (
                <p className="text-foreground-muted text-sm">Transcript not available.</p>
              ) : (
                video.transcript!.map((segment, index) => (
                  <button
                    key={index}
                    onClick={() => seekTo(segment.start)}
                    data-active={index === currentSegmentIndex}
                    className={`w-full text-left p-2 rounded-lg transition-all text-sm ${
                      index === currentSegmentIndex
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xs text-foreground-muted mr-2">
                      {formatDuration(segment.start)}
                    </span>
                    <span
                      className={
                        index === currentSegmentIndex
                          ? "text-foreground font-medium"
                          : "text-foreground-muted"
                      }
                    >
                      {segment.text}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export YouTube types (they should already be declared in VideoPage.tsx)
declare global {
  interface Window {
    YT: {
      Player: new (
        element: string,
        config: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: {
            onStateChange?: (event: YT.OnStateChangeEvent) => void;
            onReady?: () => void;
          };
        }
      ) => YT.Player;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- YouTube API global types
declare namespace YT {
  interface Player {
    seekTo(time: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    getCurrentTime(): number;
    destroy(): void;
  }
  interface OnStateChangeEvent {
    data: number;
  }
}

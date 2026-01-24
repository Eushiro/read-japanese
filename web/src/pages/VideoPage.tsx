import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Clock, FileText, HelpCircle, Loader2, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { isValidYoutubeId } from "@/lib/youtube";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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

export function VideoPage() {
  const { videoId } = useParams({ from: "/video/$videoId" });
  const navigate = useNavigate();
  useAuth(); // Auth context is used for its side effects
  const t = useT();

  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [, setIsPlaying] = useState(false); // State value not read, only setter used
  const [ytApiReady, setYtApiReady] = useState(false);
  const playerRef = useRef<YT.Player | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const timeTrackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch video content from Convex
  const video = useQuery(api.youtubeContent.get, {
    id: videoId as Id<"youtubeContent">,
  });

  const isLoading = video === undefined;

  // Load YouTube IFrame API
  useEffect(() => {
    // Check if already loaded
    if (window.YT?.Player) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync state with external API readiness
      setYtApiReady(true);
      return;
    }

    // Define callback before loading script
    const previousCallback = (window as WindowWithYT).onYouTubeIframeAPIReady;
    (window as WindowWithYT).onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      setYtApiReady(true);
    };

    // Check if script is already loading
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  // Check if this is a real YouTube video
  const isRealYoutubeVideo = video?.videoId ? isValidYoutubeId(video.videoId) : false;

  // Initialize YouTube player when API is ready and video loads
  useEffect(() => {
    if (!video?.videoId || !ytApiReady || !isRealYoutubeVideo) return;

    // Wait for the container to be rendered
    const container = document.getElementById("youtube-player");
    if (!container) return;

    // Destroy existing player if any
    if (playerRef.current) {
      playerRef.current.destroy?.();
      playerRef.current = null;
    }

    // Clear existing interval
    if (timeTrackingIntervalRef.current) {
      clearInterval(timeTrackingIntervalRef.current);
    }

    // Create player
    playerRef.current = new window.YT.Player("youtube-player", {
      videoId: video.videoId,
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onStateChange: (event: YT.OnStateChangeEvent) => {
          setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
        },
        onReady: () => {
          // Start time tracking
          timeTrackingIntervalRef.current = setInterval(() => {
            if (playerRef.current) {
              const time = playerRef.current.getCurrentTime?.() || 0;
              setCurrentTime(time);
            }
          }, 500);
        },
      },
    });

    return () => {
      if (timeTrackingIntervalRef.current) {
        clearInterval(timeTrackingIntervalRef.current);
      }
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [video?.videoId, ytApiReady, isRealYoutubeVideo]);

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

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get current segment index
  const getCurrentSegmentIndex = () => {
    if (!video?.transcript) return -1;
    return video.transcript.findIndex((seg, i) => {
      const nextSeg = video.transcript?.[i + 1];
      return currentTime >= seg.start && (!nextSeg || currentTime < nextSeg.start);
    });
  };

  const currentSegmentIndex = getCurrentSegmentIndex();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-lg font-medium text-foreground">{t("video.notFound")}</p>
        <Button variant="ghost" onClick={() => navigate({ to: "/library" })} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("video.backToLibrary")}
        </Button>
      </div>
    );
  }

  const hasQuiz = video.questions && video.questions.length > 0;
  const hasTranscript = video.transcript && video.transcript.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/library" })}>
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">{video.title}</h1>
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                {video.level && levelVariantMap[video.level] && (
                  <Badge variant={levelVariantMap[video.level]}>{video.level}</Badge>
                )}
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(video.duration)}
                  </span>
                )}
              </div>
            </div>

            {hasQuiz && (
              <Button
                onClick={() =>
                  navigate({ to: "/video-quiz/$videoId", params: { videoId: video._id } })
                }
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                {t("video.takeQuiz")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Video Player */}
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              {isRealYoutubeVideo ? (
                <div id="youtube-player" className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                  <Video className="w-16 h-16 text-accent/50 mb-4" />
                  <p className="text-foreground-muted text-sm text-center px-4">
                    {t("video.demo.title")}
                  </p>
                  <p className="text-foreground-muted/60 text-xs mt-2">
                    {t("video.demo.subtitle")}
                  </p>
                </div>
              )}
            </div>

            {/* Video Info */}
            {video.description && (
              <div className="bg-surface rounded-xl border border-border p-4">
                <h2 className="font-medium text-foreground mb-2">{t("video.about")}</h2>
                <p className="text-sm text-foreground-muted">{video.description}</p>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="font-medium text-foreground">{t("video.transcript.title")}</h2>
            </div>

            <div ref={transcriptRef} className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {!hasTranscript ? (
                <p className="text-foreground-muted text-sm">
                  {t("video.transcript.notAvailable")}
                </p>
              ) : (
                video.transcript!.map((segment, index) => (
                  <button
                    key={index}
                    onClick={() => seekTo(segment.start)}
                    data-active={index === currentSegmentIndex}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      index === currentSegmentIndex
                        ? "bg-accent/10 border border-accent/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xs text-foreground-muted mr-2">
                      {formatTime(segment.start)}
                    </span>
                    <span
                      className={`text-sm ${
                        index === currentSegmentIndex
                          ? "text-foreground font-medium"
                          : "text-foreground-muted"
                      }`}
                    >
                      {segment.text}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// YouTube IFrame API types
interface WindowWithYT extends Window {
  onYouTubeIframeAPIReady?: () => void;
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

declare global {
  interface Window {
    YT?: WindowWithYT["YT"];
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- Required for YouTube IFrame API global types
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

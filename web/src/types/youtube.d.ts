/**
 * YouTube IFrame API type declarations
 * Shared between VideoPage and EmbeddedVideoPlayer
 */

export interface YouTubePlayer {
  seekTo(time: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}

export interface YouTubeOnStateChangeEvent {
  data: number;
}

export interface YouTubePlayerState {
  PLAYING: number;
  PAUSED: number;
  ENDED: number;
  BUFFERING: number;
  CUED: number;
}

export interface YouTubePlayerConfig {
  videoId: string;
  playerVars?: Record<string, number>;
  events?: {
    onStateChange?: (event: YouTubeOnStateChangeEvent) => void;
    onReady?: () => void;
  };
}

export interface YouTubeAPI {
  Player: new (element: string, config: YouTubePlayerConfig) => YouTubePlayer;
  PlayerState: YouTubePlayerState;
}

export interface WindowWithYT {
  YT?: YouTubeAPI;
  onYouTubeIframeAPIReady?: () => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Extending Window with YouTube API types
  interface Window extends WindowWithYT {}

  namespace YT {
    type Player = YouTubePlayer;
    type OnStateChangeEvent = YouTubeOnStateChangeEvent;
    const PlayerState: YouTubePlayerState;
  }
}

// Shared YouTube utilities

/**
 * Check if a string is a valid YouTube video ID (11 characters, alphanumeric + dash/underscore)
 */
export function isValidYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Get the high-quality thumbnail URL for a YouTube video
 */
export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Get the YouTube watch URL for a video, optionally starting at a specific time
 */
export function getYoutubeWatchUrl(videoId: string, startTime?: number): string {
  const base = `https://youtube.com/watch?v=${videoId}`;
  if (startTime !== undefined) {
    return `${base}&t=${Math.floor(startTime)}`;
  }
  return base;
}

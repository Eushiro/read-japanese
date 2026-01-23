// Shared formatting utilities

/**
 * Format seconds as MM:SS (e.g., 125 -> "2:05")
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

import apiClient from "./client";
import type { Story, StoryListItem, JLPTLevel } from "@/types/story";

// List all stories (summary view)
export async function listStories(level?: JLPTLevel): Promise<StoryListItem[]> {
  const endpoint = level ? `/api/stories?level=${level}` : "/api/stories";
  return apiClient.get<StoryListItem[]>(endpoint);
}

// Get a single story with full content
export async function getStory(storyId: string): Promise<Story> {
  return apiClient.get<Story>(`/api/stories/${storyId}`);
}

// Reload stories from disk (admin function)
export async function reloadStories(): Promise<{ message: string; count: number }> {
  return apiClient.post<{ message: string; count: number }>("/api/stories/reload");
}

// Get cover image URL
export function getCoverImageUrl(coverImageURL: string | undefined): string {
  return apiClient.getAssetUrl(coverImageURL || "");
}

// Get chapter image URL
export function getChapterImageUrl(imageURL: string | undefined): string {
  return apiClient.getAssetUrl(imageURL || "");
}

// Get audio URL
export function getAudioUrl(audioURL: string | undefined): string {
  return apiClient.getAssetUrl(audioURL || "");
}

// Generic CDN URL helper
export function getCdnUrl(path: string | undefined): string {
  return apiClient.getAssetUrl(path || "");
}

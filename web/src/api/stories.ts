import apiClient from "./client";
import type { Story, StoryListItem, ProficiencyLevel } from "@/types/story";

// Backend story types (with jlptLevel instead of level)
interface BackendStoryListItem extends Omit<StoryListItem, "level"> {
  jlptLevel: string;
}

interface BackendStory extends Omit<Story, "metadata"> {
  metadata: Omit<Story["metadata"], "level"> & { jlptLevel: string };
}

// Map backend jlptLevel to frontend level
function mapStoryListItem(item: BackendStoryListItem): StoryListItem {
  const { jlptLevel, ...rest } = item;
  return { ...rest, level: jlptLevel as ProficiencyLevel };
}

function mapStory(story: BackendStory): Story {
  const { metadata, ...rest } = story;
  const { jlptLevel, ...metadataRest } = metadata;
  return {
    ...rest,
    metadata: { ...metadataRest, level: jlptLevel as ProficiencyLevel },
  };
}

// List all stories (summary view)
export async function listStories(level?: ProficiencyLevel): Promise<StoryListItem[]> {
  const endpoint = level ? `/api/stories?level=${level}` : "/api/stories";
  const stories = await apiClient.get<BackendStoryListItem[]>(endpoint);
  return stories.map(mapStoryListItem);
}

// Get a single story with full content
export async function getStory(storyId: string): Promise<Story> {
  const story = await apiClient.get<BackendStory>(`/api/stories/${storyId}`);
  return mapStory(story);
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

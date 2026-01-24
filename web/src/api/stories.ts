import type { ProficiencyLevel, Story, StoryListItem } from "@/types/story";

import apiClient from "./client";

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

// Simple in-memory cache for prefetched stories
const storyCache = new Map<string, { story: Story; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Preload story assets (images and audio) for instant display/playback.
 * Called automatically by prefetchStory after fetching story data.
 */
export function preloadStoryAssets(story: Story): void {
  // Preload cover image
  if (story.metadata.coverImageURL) {
    const img = new Image();
    img.src = getAssetUrl(story.metadata.coverImageURL);
  }

  // Preload story-level audio
  if (story.metadata.audioURL) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = getAssetUrl(story.metadata.audioURL);
  }

  // Preload chapter images and audio
  if (story.chapters) {
    story.chapters.forEach((chapter) => {
      if (chapter.imageURL) {
        const img = new Image();
        img.src = getAssetUrl(chapter.imageURL);
      }
      if (chapter.audioURL) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = getAssetUrl(chapter.audioURL);
      }
    });
  }
}

// Helper to get asset URL (reusing the client method)
function getAssetUrl(path: string): string {
  return apiClient.getAssetUrl(path);
}

// Prefetch a story (for hover preloading)
export function prefetchStory(storyId: string): void {
  // Skip if already cached and fresh
  const cached = storyCache.get(storyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  // Fetch in background (don't await)
  getStory(storyId)
    .then((story) => {
      storyCache.set(storyId, { story, timestamp: Date.now() });
      // Preload assets after caching story data
      preloadStoryAssets(story);
    })
    .catch(() => {
      // Silently fail - it's just a prefetch
    });
}

// Get story from cache or fetch
export async function getStoryWithCache(storyId: string): Promise<Story> {
  const cached = storyCache.get(storyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.story;
  }

  const story = await getStory(storyId);
  storyCache.set(storyId, { story, timestamp: Date.now() });
  return story;
}

// Generic CDN URL helper
export function getCdnUrl(path: string | undefined): string {
  return apiClient.getAssetUrl(path || "");
}

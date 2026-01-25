import type { ContentLanguage } from "@/lib/contentLanguages";
import type { ProficiencyLevel, Story, StoryListItem } from "@/types/story";

// R2 base URL from environment
const R2_BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";

// Validate R2 URL is configured (warn in development, error in production for story fetches)
function getR2BaseUrl(): string {
  if (!R2_BASE_URL) {
    console.warn(
      "[stories] VITE_R2_PUBLIC_URL is not configured. Story content will not load correctly."
    );
  }
  return R2_BASE_URL;
}

// Manifest type for story listings
interface StoryManifest {
  stories: StoryListItem[];
  generatedAt: string;
}

// List all stories (summary view from manifest)
export async function listStories(level?: ProficiencyLevel): Promise<StoryListItem[]> {
  const baseUrl = getR2BaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Story manifest unavailable: R2 storage is not configured. Please set VITE_R2_PUBLIC_URL."
    );
  }

  const url = `${baseUrl}/stories/manifest.json`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch story manifest: ${res.status}`);
  }

  // Read as text first to detect HTML error pages
  const text = await res.text();
  if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
    throw new Error(
      `Story manifest not found: received HTML instead of JSON. Check that R2 storage is accessible at ${url}`
    );
  }

  const manifest: StoryManifest = JSON.parse(text);

  if (level) {
    return manifest.stories.filter((s) => s.level === level);
  }
  return manifest.stories;
}

// Get a single story with full content (language/folder-per-story structure)
export async function getStory(storyId: string, language: ContentLanguage): Promise<Story> {
  const baseUrl = getR2BaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Story content unavailable: R2 storage is not configured. Please set VITE_R2_PUBLIC_URL."
    );
  }

  const url = `${baseUrl}/stories/${language}/${storyId}/story.json`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch story ${storyId}: ${res.status}`);
  }

  // Read as text first to detect HTML error pages
  const text = await res.text();
  if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
    throw new Error(
      `Story not found: received HTML instead of JSON. The story "${storyId}" may not exist at ${url}`
    );
  }

  return JSON.parse(text);
}

// Reload stories - no longer needed with R2 (kept for API compatibility)
export async function reloadStories(): Promise<{ message: string; count: number }> {
  // No-op with R2 - stories are updated via migration script
  return { message: "Stories are served from R2 and updated via migration script", count: 0 };
}

// Get cover image URL - returns URL directly (already absolute from R2/external)
export function getCoverImageUrl(coverImageURL: string | undefined): string {
  return getAssetUrl(coverImageURL || "");
}

// Get chapter image URL
export function getChapterImageUrl(imageURL: string | undefined): string {
  return getAssetUrl(imageURL || "");
}

// Get audio URL
export function getAudioUrl(audioURL: string | undefined): string {
  return getAssetUrl(audioURL || "");
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

/**
 * Get asset URL - handles absolute URLs (R2/external) and relative paths
 */
function getAssetUrl(path: string): string {
  if (!path) return "";
  // Already absolute URL (http:// or https://)
  if (path.startsWith("http")) return path;
  // Relative path - prepend R2 base URL
  if (R2_BASE_URL) {
    const base = R2_BASE_URL.endsWith("/") ? R2_BASE_URL.slice(0, -1) : R2_BASE_URL;
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  // No R2 URL configured - return as-is
  return path;
}

// Prefetch a story (for hover preloading)
export function prefetchStory(storyId: string, language: ContentLanguage): void {
  const cacheKey = `${language}:${storyId}`;
  // Skip if already cached and fresh
  const cached = storyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  // Fetch in background (don't await)
  getStory(storyId, language)
    .then((story) => {
      storyCache.set(cacheKey, { story, timestamp: Date.now() });
      // Preload assets after caching story data
      preloadStoryAssets(story);
    })
    .catch(() => {
      // Silently fail - it's just a prefetch
    });
}

// Get story from cache or fetch
export async function getStoryWithCache(
  storyId: string,
  language: ContentLanguage
): Promise<Story> {
  const cacheKey = `${language}:${storyId}`;
  const cached = storyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.story;
  }

  const story = await getStory(storyId, language);
  storyCache.set(cacheKey, { story, timestamp: Date.now() });
  return story;
}

// Generic CDN URL helper
export function getCdnUrl(path: string | undefined): string {
  return getAssetUrl(path || "");
}

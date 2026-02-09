import { useQuery } from "convex/react";
import { useMemo } from "react";

import type { ContentLanguage } from "@/lib/contentLanguages";
import type { Id } from "@/lib/convex-types";

import { api } from "../../convex/_generated/api";

export interface VideoItem {
  _id: Id<"youtubeContent">;
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  language: ContentLanguage;
  level?: string;
  duration?: number;
}

export interface RecommendedVideosResult {
  videos: VideoItem[];
  reason: string;
  isAdaptive: boolean;
}

/**
 * Hook for getting recommended videos based on learner model
 *
 * Uses the learner model's recommended difficulty to filter videos
 * to the user's appropriate level.
 */
export function useRecommendedVideos(
  language: ContentLanguage,
  maxVideos: number = 4,
  userId?: string
): RecommendedVideosResult {
  // Fetch learner model's recommended difficulty if userId is provided
  const recommendedDifficulty = useQuery(
    api.learnerModel.getRecommendedDifficulty,
    userId ? { userId, language } : "skip"
  );

  // Fetch videos filtered by acceptable levels if we have them
  const adaptiveVideos = useQuery(
    api.youtubeContent.listByLevelsSummary,
    recommendedDifficulty?.hasProfile && recommendedDifficulty.acceptableLevels.length > 0
      ? {
          language,
          levels: recommendedDifficulty.acceptableLevels,
          limit: maxVideos,
        }
      : "skip"
  );

  // Fallback: fetch all videos for the language (only when adaptive won't have results)
  const allVideos = useQuery(
    api.youtubeContent.listSummary,
    recommendedDifficulty?.hasProfile && recommendedDifficulty.acceptableLevels.length > 0
      ? "skip"
      : { language, limit: maxVideos * 2 }
  );

  return useMemo(() => {
    // Priority 1: Use learner model's adaptive videos
    if (adaptiveVideos && adaptiveVideos.length > 0 && recommendedDifficulty?.targetLevel) {
      return {
        videos: adaptiveVideos.slice(0, maxVideos) as VideoItem[],
        reason: `Matched to your ${recommendedDifficulty.targetLevel} level`,
        isAdaptive: true,
      };
    }

    // Priority 2: Return all videos for the language (fallback)
    if (allVideos && allVideos.length > 0) {
      return {
        videos: allVideos.slice(0, maxVideos) as VideoItem[],
        reason: "Popular picks",
        isAdaptive: false,
      };
    }

    return {
      videos: [],
      reason: "",
      isAdaptive: false,
    };
  }, [adaptiveVideos, allVideos, maxVideos, recommendedDifficulty]);
}

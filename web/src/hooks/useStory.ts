import { useState, useEffect, useCallback } from "react";
import { getStoryWithCache } from "@/api/stories";
import type { Story } from "@/types/story";

interface UseStoryResult {
  story: Story | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useStory(storyId: string | undefined): UseStoryResult {
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStory = useCallback(async () => {
    if (!storyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getStoryWithCache(storyId);
      setStory(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch story"));
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  return {
    story,
    isLoading,
    error,
    refetch: fetchStory,
  };
}

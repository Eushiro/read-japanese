import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listStories } from "@/api/stories";
import type { StoryListItem, ProficiencyLevel } from "@/types/story";
import { toHiragana, isRomaji, toKatakana } from "wanakana";

// Fetch stories with caching
export function useStories() {
  return useQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Helper hook for filtering stories by search term
export function useFilteredStories(
  stories: StoryListItem[] | undefined,
  searchTerm: string,
  level: ProficiencyLevel | null
): StoryListItem[] {
  return useMemo(() => {
    if (!stories) return [];

    let filtered = stories;

    // Filter by level
    if (level) {
      filtered = filtered.filter((s) => s.jlptLevel === level);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const hiragana = isRomaji(term) ? toHiragana(term) : term;
      const katakana = isRomaji(term) ? toKatakana(term) : term;

      filtered = filtered.filter((story) => {
        const title = story.title.toLowerCase();
        const titleJa = story.titleJapanese?.toLowerCase() || "";
        const summary = story.summary.toLowerCase();
        const summaryJa = story.summaryJapanese?.toLowerCase() || "";
        const genre = story.genre.toLowerCase();

        return (
          title.includes(term) ||
          titleJa.includes(term) ||
          titleJa.includes(hiragana) ||
          titleJa.includes(katakana) ||
          summary.includes(term) ||
          summaryJa.includes(term) ||
          summaryJa.includes(hiragana) ||
          genre.includes(term)
        );
      });
    }

    return filtered;
  }, [stories, searchTerm, level]);
}

// Sort utilities
export type SortOption = "level-asc" | "level-desc" | "title" | "newest";

export function sortStories(
  stories: StoryListItem[],
  sortBy: SortOption
): StoryListItem[] {
  const sorted = [...stories];

  switch (sortBy) {
    case "level-asc":
      return sorted.sort((a, b) => {
        const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
        return levelOrder[a.jlptLevel] - levelOrder[b.jlptLevel];
      });
    case "level-desc":
      return sorted.sort((a, b) => {
        const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
        return levelOrder[b.jlptLevel] - levelOrder[a.jlptLevel];
      });
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return sorted;
  }
}

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { isRomaji, toHiragana, toKatakana } from "wanakana";

import { listStories } from "@/api/stories";
import type { ProficiencyLevel,StoryListItem } from "@/types/story";

type Language = "japanese" | "english" | "french";

// JLPT levels are for Japanese
const JLPT_LEVEL_SET = new Set(["N5", "N4", "N3", "N2", "N1"]);
// CEFR levels are for French/English
const CEFR_LEVEL_SET = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

// Fetch stories with caching
export function useStories() {
  return useQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Helper hook for filtering stories by search term and language
export function useFilteredStories(
  stories: StoryListItem[] | undefined,
  searchTerm: string,
  level: ProficiencyLevel | null,
  language?: Language | null
): StoryListItem[] {
  return useMemo(() => {
    if (!stories) return [];

    let filtered = stories;

    // Filter by specific level if selected
    if (level) {
      filtered = filtered.filter((s) => s.level === level);
    } else if (language) {
      // Filter by language's level system when "All" is selected
      if (language === "japanese") {
        filtered = filtered.filter((s) => JLPT_LEVEL_SET.has(s.level));
      } else if (language === "french" || language === "english") {
        filtered = filtered.filter((s) => CEFR_LEVEL_SET.has(s.level));
      }
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
  }, [stories, searchTerm, level, language]);
}

// Sort utilities
export type SortOption = "level-asc" | "level-desc" | "title" | "newest";

export function sortStories(stories: StoryListItem[], sortBy: SortOption): StoryListItem[] {
  const sorted = [...stories];

  switch (sortBy) {
    case "level-asc":
      return sorted.sort((a, b) => {
        const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
        return levelOrder[a.level] - levelOrder[b.level];
      });
    case "level-desc":
      return sorted.sort((a, b) => {
        const levelOrder = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
        return levelOrder[b.level] - levelOrder[a.level];
      });
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return sorted;
  }
}

import { useQuery as useConvexQuery } from "convex/react";
import { useMemo } from "react";
import { isRomaji, toHiragana, toKatakana } from "wanakana";

import type { ContentLanguage } from "@/lib/contentLanguages";
import type { UILanguage } from "@/lib/i18n/types";
import type { ProficiencyLevel, StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

// JLPT levels are for Japanese
const JLPT_LEVEL_SET = new Set(["N5", "N4", "N3", "N2", "N1"]);
// CEFR levels are for French/English
const CEFR_LEVEL_SET = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

// Type for the Convex story response
interface ConvexStoryResponse {
  id: string;
  language: string;
  title: string;
  titleTranslations: {
    en: string;
    ja: string;
    fr: string;
    zh: string;
  };
  level: string;
  wordCount: number;
  genre: string;
  summary: string;
  summaryTranslations: {
    en: string;
    ja: string;
    fr: string;
    zh: string;
  };
  coverImageURL?: string;
  audioURL?: string;
  chapterCount: number;
  isPremium: boolean;
}

/**
 * Transform Convex story to StoryListItem
 */
function toStoryListItem(s: ConvexStoryResponse): StoryListItem {
  return {
    id: s.id,
    language: s.language as ContentLanguage,
    title: s.title,
    titleTranslations: s.titleTranslations,
    level: s.level as ProficiencyLevel,
    wordCount: s.wordCount,
    genre: s.genre,
    summary: s.summary,
    summaryTranslations: s.summaryTranslations,
    coverImageURL: s.coverImageURL,
    audioURL: s.audioURL,
    chapterCount: s.chapterCount,
    isPremium: s.isPremium,
  };
}

/**
 * Fetch all stories from Convex
 */
export function useStories(): {
  data: StoryListItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const stories = useConvexQuery(api.stories.listAll) as ConvexStoryResponse[] | undefined;

  // Transform Convex response to StoryListItem format
  const data = useMemo(() => {
    if (!stories) return undefined;
    return stories.map(toStoryListItem);
  }, [stories]);

  return {
    data,
    isLoading: stories === undefined,
    error: null, // Convex handles errors via ConvexProvider
  };
}

/**
 * Fetch stories for a specific language from Convex
 */
export function useStoriesByLanguage(language: ContentLanguage): {
  data: StoryListItem[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const stories = useConvexQuery(api.stories.listByLanguage, { language }) as
    | ConvexStoryResponse[]
    | undefined;

  const data = useMemo(() => {
    if (!stories) return undefined;
    return stories.map(toStoryListItem);
  }, [stories]);

  return {
    data,
    isLoading: stories === undefined,
    error: null,
  };
}

// Helper hook for filtering stories by search term and language
export function useFilteredStories(
  stories: StoryListItem[] | undefined,
  searchTerm: string,
  level: ProficiencyLevel | null,
  language?: ContentLanguage | null,
  uiLanguage: UILanguage = "en"
): StoryListItem[] {
  return useMemo(() => {
    if (!stories) return [];

    let filtered = stories;

    // Filter by language first if specified
    if (language) {
      filtered = filtered.filter((s) => s.language === language);
    }

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

    // Filter by search term - only search in visible fields
    // Visible: title (in story's language), title in user's UI language, genre
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const hiragana = isRomaji(term) ? toHiragana(term) : term;
      const katakana = isRomaji(term) ? toKatakana(term) : term;

      filtered = filtered.filter((story) => {
        // Primary title (always visible)
        const title = story.title.toLowerCase();
        // Title in user's UI language (visible as subtitle)
        const titleInUILang = story.titleTranslations[uiLanguage]?.toLowerCase() ?? "";
        // Genre tag
        const genre = story.genre.toLowerCase();

        // Basic text matching
        if (
          title.includes(term) ||
          titleInUILang.includes(term) ||
          genre.includes(term)
        ) {
          return true;
        }

        // For Japanese stories, also match romaji → hiragana/katakana
        if (story.language === "japanese") {
          return (
            title.includes(hiragana) ||
            title.includes(katakana)
          );
        }

        return false;
      });
    }

    return filtered;
  }, [stories, searchTerm, level, language, uiLanguage]);
}

// Sort utilities
export type SortOption = "level-asc" | "level-desc" | "title" | "newest";

export function sortStories(stories: StoryListItem[], sortBy: SortOption): StoryListItem[] {
  const sorted = [...stories];

  switch (sortBy) {
    case "level-asc":
      return sorted.sort((a, b) => {
        const levelOrder: Record<ProficiencyLevel, number> = {
          N5: 1,
          N4: 2,
          N3: 3,
          N2: 4,
          N1: 5,
          A1: 1,
          A2: 2,
          B1: 3,
          B2: 4,
          C1: 5,
          C2: 6,
        };
        return levelOrder[a.level] - levelOrder[b.level];
      });
    case "level-desc":
      return sorted.sort((a, b) => {
        const levelOrder: Record<ProficiencyLevel, number> = {
          N5: 1,
          N4: 2,
          N3: 3,
          N2: 4,
          N1: 5,
          A1: 1,
          A2: 2,
          B1: 3,
          B2: 4,
          C1: 5,
          C2: 6,
        };
        return levelOrder[b.level] - levelOrder[a.level];
      });
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return sorted;
  }
}

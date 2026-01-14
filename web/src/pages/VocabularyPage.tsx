import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Trash2, BookOpen, BookmarkCheck, ChevronDown, ArrowUpDown, Filter } from "lucide-react";
import { getCurrentUserId } from "@/hooks/useSettings";

// Sort options
type SortOption = "newest" | "oldest" | "alphabetical" | "alphabetical-reverse" | "by-level";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "alphabetical", label: "A → Z" },
  { value: "alphabetical-reverse", label: "Z → A" },
  { value: "by-level", label: "By Level" },
];

// JLPT level order and metadata
const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"] as const;
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  N5: "Beginner",
  N4: "Elementary",
  N3: "Intermediate",
  N2: "Upper Intermediate",
  N1: "Advanced",
  Other: "Uncategorized",
};

// Normalize JLPT level string to badge variant and display text
function normalizeJlptLevel(level: string | undefined | null): { variant: "n5" | "n4" | "n3" | "n2" | "n1"; display: string } | null {
  if (!level) return null;
  const match = level.toLowerCase().match(/n([1-5])/);
  if (!match) return null;

  const num = match[1] as "1" | "2" | "3" | "4" | "5";
  return {
    variant: `n${num}` as "n5" | "n4" | "n3" | "n2" | "n1",
    display: `N${num}`,
  };
}

// Get normalized level string for grouping/sorting
function getNormalizedLevel(level: string | undefined | null): string {
  const normalized = normalizeJlptLevel(level);
  return normalized?.display ?? "Other";
}

export function VocabularyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [storyFilter, setStoryFilter] = useState<string | null>(null);

  const userId = getCurrentUserId();
  const vocabulary = useQuery(api.vocabulary.list, { userId });
  const removeWord = useMutation(api.vocabulary.remove);

  // Get unique stories for filter dropdown
  const uniqueStories = useMemo(() => {
    if (!vocabulary) return [];
    const stories = new Map<string, string>();
    vocabulary.forEach((item) => {
      if (item.sourceStoryId && item.sourceStoryTitle) {
        stories.set(item.sourceStoryId, item.sourceStoryTitle);
      }
    });
    return Array.from(stories.entries()).map(([id, title]) => ({ id, title }));
  }, [vocabulary]);

  // Filter vocabulary
  const filteredVocabulary = useMemo(() => {
    if (!vocabulary) return [];

    return vocabulary.filter((item) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.word.toLowerCase().includes(term) ||
          item.reading.toLowerCase().includes(term) ||
          item.meaning.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // Level filter
      if (levelFilter) {
        const itemLevel = getNormalizedLevel(item.jlptLevel);
        if (levelFilter === "Other") {
          if (itemLevel !== "Other") return false;
        } else {
          if (itemLevel !== levelFilter) return false;
        }
      }

      // Story filter
      if (storyFilter && item.sourceStoryId !== storyFilter) {
        return false;
      }

      return true;
    });
  }, [vocabulary, searchTerm, levelFilter, storyFilter]);

  // Sort vocabulary
  const sortedVocabulary = useMemo(() => {
    const items = [...filteredVocabulary];

    switch (sortBy) {
      case "newest":
        return items.sort((a, b) => b.createdAt - a.createdAt);
      case "oldest":
        return items.sort((a, b) => a.createdAt - b.createdAt);
      case "alphabetical":
        return items.sort((a, b) => a.word.localeCompare(b.word, "ja"));
      case "alphabetical-reverse":
        return items.sort((a, b) => b.word.localeCompare(a.word, "ja"));
      case "by-level":
        return items.sort((a, b) => {
          const levelA = getNormalizedLevel(a.jlptLevel);
          const levelB = getNormalizedLevel(b.jlptLevel);
          const idxA = LEVEL_ORDER.indexOf(levelA as typeof LEVEL_ORDER[number]);
          const idxB = LEVEL_ORDER.indexOf(levelB as typeof LEVEL_ORDER[number]);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
      default:
        return items;
    }
  }, [filteredVocabulary, sortBy]);

  // Group by level (only when sorted by level)
  const groupedByLevel = useMemo(() => {
    if (sortBy !== "by-level") return null;

    const groups = new Map<string, typeof sortedVocabulary>();

    sortedVocabulary.forEach((item) => {
      const level = getNormalizedLevel(item.jlptLevel);
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(item);
    });

    // Return in level order
    return [...LEVEL_ORDER, "Other"]
      .filter((level) => groups.has(level))
      .map((level) => ({
        level,
        items: groups.get(level)!,
      }));
  }, [sortedVocabulary, sortBy]);

  const handleRemove = async (id: string) => {
    try {
      await removeWord({ id: id as any });
    } catch (err) {
      console.error("Failed to remove word:", err);
    }
  };

  const hasActiveFilters = levelFilter !== null || storyFilter !== null;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <BookmarkCheck className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                Your Words
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Vocabulary
            </h1>
            <p className="text-foreground-muted text-lg">
              {vocabulary?.length || 0} words saved from your reading
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vocabulary..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-9 pr-9 py-2.5 rounded-lg border border-border bg-surface text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            </div>

            {/* Level Filter */}
            <div className="relative">
              <select
                value={levelFilter ?? ""}
                onChange={(e) => setLevelFilter(e.target.value || null)}
                className={`appearance-none pl-9 pr-9 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all ${
                  levelFilter ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-foreground"
                }`}
              >
                <option value="">All Levels</option>
                {LEVEL_ORDER.map((level) => (
                  <option key={level} value={level}>
                    {level} - {LEVEL_DESCRIPTIONS[level]}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${levelFilter ? "text-accent" : "text-foreground-muted"}`} />
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${levelFilter ? "text-accent" : "text-foreground-muted"}`} />
            </div>

            {/* Story Filter (only show if there are stories) */}
            {uniqueStories.length > 0 && (
              <div className="relative">
                <select
                  value={storyFilter ?? ""}
                  onChange={(e) => setStoryFilter(e.target.value || null)}
                  className={`appearance-none pl-9 pr-9 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all max-w-[200px] truncate ${
                    storyFilter ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-foreground"
                  }`}
                >
                  <option value="">All Stories</option>
                  {uniqueStories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {story.title}
                    </option>
                  ))}
                </select>
                <BookOpen className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${storyFilter ? "text-accent" : "text-foreground-muted"}`} />
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${storyFilter ? "text-accent" : "text-foreground-muted"}`} />
              </div>
            )}
          </div>

          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-foreground-muted">Filters:</span>
              {levelFilter && (
                <button
                  onClick={() => setLevelFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  {levelFilter}
                  <span className="ml-1">×</span>
                </button>
              )}
              {storyFilter && (
                <button
                  onClick={() => setStoryFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors max-w-[150px] truncate"
                >
                  {uniqueStories.find((s) => s.id === storyFilter)?.title}
                  <span className="ml-1 shrink-0">×</span>
                </button>
              )}
              <button
                onClick={() => {
                  setLevelFilter(null);
                  setStoryFilter(null);
                }}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
        <p className="text-sm text-foreground-muted">
          {vocabulary === undefined ? (
            "Loading..."
          ) : (
            <>
              <span className="font-medium text-foreground">{sortedVocabulary.length}</span>
              {" "}{sortedVocabulary.length === 1 ? "word" : "words"}
              {sortedVocabulary.length !== vocabulary.length && ` (of ${vocabulary.length} total)`}
            </>
          )}
        </p>
      </div>

      {/* Vocabulary List */}
      <div className="container mx-auto px-4 sm:px-6 pb-12 max-w-4xl">
        {vocabulary === undefined ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-surface border border-border animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="h-6 bg-muted rounded w-24 mb-2" />
                <div className="h-4 bg-muted rounded w-48" />
              </div>
            ))}
          </div>
        ) : sortedVocabulary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">
              {searchTerm || hasActiveFilters ? "No matching words found" : "No vocabulary saved yet"}
            </p>
            <p className="text-sm text-center max-w-sm">
              {searchTerm || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Tap on words while reading to save them to your vocabulary"}
            </p>
          </div>
        ) : groupedByLevel ? (
          // Grouped by level view
          <div className="space-y-8">
            {groupedByLevel.map(({ level, items }) => (
              <section key={level}>
                <div className="flex items-center gap-3 mb-4">
                  {level !== "Other" && normalizeJlptLevel(level) ? (
                    <Badge variant={normalizeJlptLevel(level)!.variant} className="text-sm px-3 py-1">
                      {level}
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium text-foreground-muted px-3 py-1 bg-muted rounded-full">
                      Other
                    </span>
                  )}
                  <span className="text-sm text-foreground-muted">
                    {LEVEL_DESCRIPTIONS[level]} • {items.length} {items.length === 1 ? "word" : "words"}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <VocabularyCard
                      key={item._id}
                      item={item}
                      onRemove={handleRemove}
                      showLevel={false}
                      delay={Math.min(index * 30, 150)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          // Flat list view
          <div className="space-y-3">
            {sortedVocabulary.map((item, index) => (
              <VocabularyCard
                key={item._id}
                item={item}
                onRemove={handleRemove}
                showLevel={true}
                delay={Math.min(index * 30, 150)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Vocabulary card component
interface VocabularyCardProps {
  item: {
    _id: string;
    word: string;
    reading: string;
    meaning: string;
    jlptLevel?: string | null;
    sourceStoryTitle?: string | null;
  };
  onRemove: (id: string) => void;
  showLevel?: boolean;
  delay?: number;
}

function VocabularyCard({ item, onRemove, showLevel = true, delay = 0 }: VocabularyCardProps) {
  return (
    <div
      className="p-5 rounded-xl bg-surface border border-border hover:border-foreground-muted/30 transition-all duration-200 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span
            className="text-xl font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-japanese)' }}
          >
            {item.word}
          </span>
          <div className="text-sm text-foreground-muted mb-2">
            {item.reading}
          </div>
          <div className="text-foreground">{item.meaning}</div>
          {item.sourceStoryTitle && (
            <div className="text-xs text-foreground-muted mt-3 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              From: {item.sourceStoryTitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showLevel && item.jlptLevel && normalizeJlptLevel(item.jlptLevel) && (
            <Badge
              variant={normalizeJlptLevel(item.jlptLevel)!.variant}
              className="text-xs"
            >
              {normalizeJlptLevel(item.jlptLevel)!.display}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item._id)}
            className="text-foreground-muted hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

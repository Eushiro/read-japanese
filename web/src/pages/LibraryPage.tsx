import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { StoryGrid } from "@/components/library/StoryGrid";
import { SearchBar } from "@/components/library/SearchBar";
import { LevelFilter } from "@/components/library/LevelFilter";
import {
  useStories,
  useFilteredStories,
  sortStories,
  type SortOption,
} from "@/hooks/useStories";
import type { JLPTLevel, StoryListItem } from "@/types/story";
import { ChevronDown, Library } from "lucide-react";

export function LibraryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("level-asc");

  // Check if user has premium access (dev setting stored in localStorage)
  const isPremiumUser = localStorage.getItem("isPremiumUser") === "true";

  const { data: stories, isLoading, error } = useStories();
  const filteredStories = useFilteredStories(stories, searchTerm, selectedLevel);
  const sortedStories = useMemo(
    () => sortStories(filteredStories, sortBy),
    [filteredStories, sortBy]
  );

  const handleStoryClick = (story: StoryListItem) => {
    // Block access to premium stories if user doesn't have premium
    if (story.isPremium && !isPremiumUser) {
      return;
    }
    navigate({ to: "/read/$storyId", params: { storyId: story.id } });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-destructive">
        <p className="text-lg font-medium">Failed to load stories</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Library className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                Your Library
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Japanese Graded Readers
            </h1>
            <p className="text-foreground-muted text-lg">
              Stories tailored to your JLPT level. Tap any word to see its meaning.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search stories..."
              />
            </div>
            <div className="flex items-center gap-3">
              <LevelFilter
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
              />
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="container mx-auto px-4 sm:px-6 py-4">
        <p className="text-sm text-foreground-muted">
          {isLoading ? (
            "Loading stories..."
          ) : (
            <>
              <span className="font-medium text-foreground">{sortedStories.length}</span>
              {" "}{sortedStories.length === 1 ? "story" : "stories"} available
            </>
          )}
        </p>
      </div>

      {/* Story Grid */}
      <div className="container mx-auto px-4 sm:px-6 pb-12">
        <StoryGrid
          stories={sortedStories}
          isLoading={isLoading}
          onStoryClick={handleStoryClick}
          isPremiumUser={isPremiumUser}
        />
      </div>
    </div>
  );
}

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const options: { value: SortOption; label: string }[] = [
    { value: "level-asc", label: "Easy → Hard" },
    { value: "level-desc", label: "Hard → Easy" },
    { value: "title", label: "Title (A-Z)" },
    { value: "newest", label: "Newest" },
  ];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="appearance-none pl-3 pr-9 py-2 rounded-lg border border-border bg-surface text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
    </div>
  );
}

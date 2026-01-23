import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StoryCard } from "@/components/library/StoryCard";
import { SearchBar } from "@/components/library/SearchBar";
import { LevelFilter } from "@/components/library/LevelFilter";
import { Paywall } from "@/components/Paywall";
import { GenerateStoryModal } from "@/components/GenerateStoryModal";
import {
  useStories,
  useFilteredStories,
  sortStories,
  type SortOption,
} from "@/hooks/useStories";
import type { ProficiencyLevel, StoryListItem } from "@/types/story";
import { ChevronDown, Library, BookOpen, Sparkles, Play, Film } from "lucide-react";
import { VideoCard, VideoCardSkeleton, type VideoItem } from "@/components/library/VideoCard";
import { useAuth, SignInButton } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Language = "japanese" | "english" | "french";

const LANGUAGE_INFO: Record<Language, { label: string; flag: string }> = {
  japanese: { label: "Japanese", flag: "🇯🇵" },
  english: { label: "English", flag: "🇬🇧" },
  french: { label: "French", flag: "🇫🇷" },
};

type ContentFilter = "all" | "stories" | "videos";

export function LibraryPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("level-asc");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");

  // Check subscription from Convex (with dev override fallback)
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );

  // Premium if subscription tier is not free, or if dev toggle is enabled
  const devPremiumOverride = localStorage.getItem("isPremiumUser") === "true";
  const isPremiumUser = devPremiumOverride || (subscription?.tier && subscription.tier !== "free");

  // Get user profile to access their languages
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Set default language when profile loads
  useEffect(() => {
    if (userProfile?.languages && userProfile.languages.length > 0 && !selectedLanguage) {
      // Use primary language if set, otherwise use first language
      setSelectedLanguage((userProfile.primaryLanguage as Language) || userProfile.languages[0] as Language);
    }
  }, [userProfile, selectedLanguage]);

  // Reset level filter when language changes
  useEffect(() => {
    setSelectedLevel(null);
  }, [selectedLanguage]);

  const userLanguages = userProfile?.languages as Language[] | undefined;
  const hasMultipleLanguages = userLanguages && userLanguages.length > 1;

  const { data: stories, isLoading: isLoadingStories, error } = useStories();
  const filteredStories = useFilteredStories(stories, searchTerm, selectedLevel, selectedLanguage);
  const sortedStories = useMemo(
    () => sortStories(filteredStories, sortBy),
    [filteredStories, sortBy]
  );

  // Fetch videos from Convex
  const videos = useQuery(
    api.youtubeContent.list,
    selectedLanguage ? { language: selectedLanguage, level: selectedLevel ?? undefined } : {}
  ) as VideoItem[] | undefined;
  const isLoadingVideos = videos === undefined;

  // Filter videos by search term
  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    if (!searchTerm.trim()) return videos;
    const term = searchTerm.toLowerCase();
    return videos.filter((v) =>
      v.title.toLowerCase().includes(term) ||
      v.description?.toLowerCase().includes(term)
    );
  }, [videos, searchTerm]);

  const isLoading = contentFilter === "all"
    ? (isLoadingStories || isLoadingVideos)
    : contentFilter === "stories" ? isLoadingStories : isLoadingVideos;

  const showStories = contentFilter === "all" || contentFilter === "stories";
  const showVideos = contentFilter === "all" || contentFilter === "videos";

  const handleStoryClick = (story: StoryListItem) => {
    // Show paywall for premium stories if user doesn't have premium
    if (story.isPremium && !isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    navigate({ to: "/read/$storyId", params: { storyId: story.id } });
  };

  const handleVideoClick = (video: VideoItem) => {
    navigate({ to: "/video/$videoId", params: { videoId: video._id } });
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
              Graded Readers
            </h1>
            <p className="text-foreground-muted text-lg">
              Stories tailored to your level. Tap any word to see its meaning.
            </p>

            {/* Generate Story CTA */}
            <div className="mt-6">
              {isAuthenticated ? (
                <Button className="gap-2" onClick={() => setShowGenerateModal(true)}>
                  <Sparkles className="w-4 h-4" />
                  Generate Custom Story
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Generate Custom Story
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-4">
            {/* Content Filter Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex gap-0.5 p-1 rounded-lg bg-muted border border-border">
                <button
                  onClick={() => setContentFilter("all")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    contentFilter === "all"
                      ? "bg-accent text-white shadow-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setContentFilter("stories")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    contentFilter === "stories"
                      ? "bg-accent text-white shadow-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Stories
                </button>
                <button
                  onClick={() => setContentFilter("videos")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    contentFilter === "videos"
                      ? "bg-accent text-white shadow-sm"
                      : "text-foreground-muted hover:text-foreground hover:bg-surface/50"
                  }`}
                >
                  <Film className="w-4 h-4" />
                  Videos
                </button>
              </div>

              {/* Language Toggle - only show if user has multiple languages */}
              {hasMultipleLanguages && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted">Language:</span>
                  <div className="flex gap-1">
                    {userLanguages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedLanguage === lang
                            ? "bg-accent text-white shadow-sm"
                            : "bg-surface text-foreground-muted hover:bg-muted hover:text-foreground border border-border"
                        }`}
                      >
                        {LANGUAGE_INFO[lang].flag} {LANGUAGE_INFO[lang].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                  languages={selectedLanguage ? [selectedLanguage] : userLanguages}
                />
                <SortDropdown value={sortBy} onChange={setSortBy} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-10">
        {/* Stories Section */}
        {showStories && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Stories
              </h2>
              <span className="text-sm text-foreground-muted">
                ({isLoadingStories ? "..." : sortedStories.length})
              </span>
            </div>

            {isLoadingStories ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <StoryCardSkeleton key={i} delay={i * 50} />
                ))}
              </div>
            ) : sortedStories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-foreground-muted bg-surface rounded-xl border border-border">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 opacity-40" />
                </div>
                <p className="font-medium text-foreground mb-1">No stories found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {sortedStories.map((story, index) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    isPremiumUser={isPremiumUser}
                    onClick={() => handleStoryClick(story)}
                    style={{
                      animationDelay: `${Math.min(index * 50, 300)}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Videos Section */}
        {showVideos && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Videos
              </h2>
              <span className="text-sm text-foreground-muted">
                ({isLoadingVideos ? "..." : filteredVideos.length})
              </span>
            </div>

            {isLoadingVideos ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <VideoCardSkeleton key={i} delay={i * 50} />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-foreground-muted bg-surface rounded-xl border border-border">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <Film className="w-6 h-6 opacity-40" />
                </div>
                <p className="font-medium text-foreground mb-1">No videos found</p>
                <p className="text-sm">
                  {selectedLanguage
                    ? `No videos available for ${LANGUAGE_INFO[selectedLanguage].label} yet`
                    : "Select a language to browse videos"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredVideos.map((video, index) => (
                  <VideoCard
                    key={video._id}
                    video={video}
                    onClick={() => handleVideoClick(video)}
                    style={{
                      animationDelay: `${Math.min(index * 50, 300)}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Paywall Modal */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="stories"
      />

      {/* Generate Story Modal */}
      <GenerateStoryModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
      />
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

function StoryCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-surface animate-pulse"
      style={{
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="aspect-[3/4] bg-border" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-border rounded w-4/5" />
        <div className="h-3 bg-border rounded w-2/3" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 bg-border rounded-full w-16" />
          <div className="h-5 bg-border rounded w-12" />
        </div>
      </div>
    </div>
  );
}

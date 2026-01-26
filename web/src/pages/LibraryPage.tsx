import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { BookOpen, Film, Library, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GenerateStoryModal } from "@/components/GenerateStoryModal";
import { LevelFilter } from "@/components/library/LevelFilter";
import { matchesSearch, SearchBar } from "@/components/library/SearchBar";
import { StoryCard } from "@/components/library/StoryCard";
import { VideoCard, VideoCardSkeleton, type VideoItem } from "@/components/library/VideoCard";
import { Paywall } from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { type SortOption, sortStories, useFilteredStories, useStories } from "@/hooks/useStories";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { ProficiencyLevel, StoryListItem } from "@/types/story";

import { api } from "../../convex/_generated/api";

type ContentFilter = "all" | "stories" | "videos";

// Animated background for library page
function LibraryAnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
        style={{
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          top: "-5%",
          left: "20%",
        }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-[0.12]"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          bottom: "10%",
          right: "10%",
        }}
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-10"
        style={{
          background: "radial-gradient(circle, #ff8400 0%, transparent 70%)",
          top: "40%",
          right: "30%",
        }}
        animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function LibraryPage() {
  const navigate = useNavigate();
  const t = useT();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("level-asc");
  const [selectedLanguage, setSelectedLanguage] = useState<ContentLanguage | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");

  // User profile and subscription from shared context (prevents refetching on navigation)
  const { userProfile, isPremium } = useUserData();

  // Premium if context says premium, or if dev toggle is enabled
  const devPremiumOverride = localStorage.getItem("isPremiumUser") === "true";
  const isPremiumUser = devPremiumOverride || isPremium;

  // Don't auto-select language - show all content by default
  // Users can filter by language if they want

  // Reset level filter when language changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset dependent state when filter changes
    setSelectedLevel(null);
  }, [selectedLanguage]);

  const userLanguages = userProfile?.languages as ContentLanguage[] | undefined;
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

  // Filter videos by search term (with romaji support)
  const filteredVideos = useMemo(() => {
    if (!videos) return [];
    if (!searchTerm.trim()) return videos;
    return videos.filter(
      (v) => matchesSearch(v.title, searchTerm) || matchesSearch(v.description || "", searchTerm)
    );
  }, [videos, searchTerm]);

  // Check if content exists (after loading)
  const hasStories = !isLoadingStories && sortedStories.length > 0;
  const hasVideos = !isLoadingVideos && filteredVideos.length > 0;

  // Show sections based on filter AND content availability
  const showStories =
    (contentFilter === "all" || contentFilter === "stories") && (isLoadingStories || hasStories);
  const showVideos =
    (contentFilter === "all" || contentFilter === "videos") && (isLoadingVideos || hasVideos);

  const handleStoryClick = (story: StoryListItem) => {
    // Show paywall for premium stories if user doesn't have premium
    if (story.isPremium && !isPremiumUser) {
      setShowPaywall(true);
      return;
    }
    navigate({
      to: "/read/$language/$storyId",
      params: { language: story.language, storyId: story.id },
    });
  };

  const handleVideoClick = (video: VideoItem) => {
    navigate({ to: "/video/$videoId", params: { videoId: video._id } });
  };

  // Show skeleton while auth is loading
  if (authLoading) {
    return <LibrarySkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-destructive">
        <p className="text-lg font-medium">{t("library.errors.loadFailed")}</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Animated background */}
      <LibraryAnimatedBackground />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-8 pb-12">
        <div className="container mx-auto px-4 sm:px-6 relative">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-orange-500/20">
                <Library className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">
                {t("library.hero.badge")}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("library.hero.title")}
            </h1>
            <p className="text-foreground-muted text-lg">{t("library.hero.subtitle")}</p>

            {/* Generate Story CTA */}
            <div className="mt-6">
              {isAuthenticated ? (
                <Button
                  variant="glass-accent"
                  className="gap-2"
                  onClick={() => setShowGenerateModal(true)}
                >
                  <Sparkles className="w-4 h-4" />
                  {t("library.hero.generateStory")}
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button variant="glass-accent" className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t("library.hero.generateStory")}
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div>
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex gap-3">
            {/* Search - capped at max-w-md */}
            <div className="flex-1 max-w-md">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t("library.searchPlaceholder")}
              />
            </div>

            {/* Content Type Filter */}
            <Select
              value={contentFilter}
              onValueChange={(value) => setContentFilter(value as ContentFilter)}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("library.filters.all")}</SelectItem>
                <SelectItem value="stories">{t("library.filters.stories")}</SelectItem>
                <SelectItem value="videos">{t("library.filters.videos")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Language Filter */}
            {hasMultipleLanguages && userLanguages && (
              <Select
                value={selectedLanguage ?? "all"}
                onValueChange={(value) =>
                  setSelectedLanguage(value === "all" ? null : (value as ContentLanguage))
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("library.filters.allLanguages")}</SelectItem>
                  {userLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {t(`library.languages.${lang}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Level Filter */}
            <LevelFilter
              selectedLevel={selectedLevel}
              onSelectLevel={setSelectedLevel}
              languages={selectedLanguage ? [selectedLanguage] : userLanguages}
            />

            {/* Sort */}
            <SortDropdown value={sortBy} onChange={setSortBy} />
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
              <h2 className="text-lg font-semibold text-foreground">
                {t("library.sections.stories")}
              </h2>
            </div>

            {isLoadingStories ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <StoryCardSkeleton key={i} delay={i * 50} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
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
              <Film className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">
                {t("library.sections.videos")}
              </h2>
            </div>

            {isLoadingVideos ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <VideoCardSkeleton key={i} delay={i * 50} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
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
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />

      {/* Generate Story Modal */}
      <GenerateStoryModal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} />
    </div>
  );
}

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const t = useT();
  const options: { value: SortOption; labelKey: string }[] = [
    { value: "level-asc", labelKey: "library.sort.easyToHard" },
    { value: "level-desc", labelKey: "library.sort.hardToEasy" },
    { value: "title", labelKey: "library.sort.titleAZ" },
    { value: "newest", labelKey: "library.sort.newest" },
  ];

  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StoryCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-surface animate-pulse"
      style={{
        boxShadow: "var(--shadow-card)",
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="aspect-[3/3.2] bg-border" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-border rounded w-4/5" />
        <div className="h-3 bg-border rounded w-2/3" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 bg-border rounded-full w-16" />
          <div className="h-5 bg-border rounded w-12" />
        </div>
      </div>
    </div>
  );
}

// Full page skeleton for initial load
function LibrarySkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Section Skeleton */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-border w-9 h-9 animate-pulse" />
              <div className="h-4 bg-border rounded w-24 animate-pulse" />
            </div>
            <div className="h-10 bg-border rounded w-48 mb-3 animate-pulse" />
            <div className="h-5 bg-border rounded w-80 mb-6 animate-pulse" />
            <div className="h-10 bg-border rounded w-44 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Filters Section Skeleton */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex gap-0.5 p-1 rounded-lg bg-muted border border-border">
                <div className="h-9 bg-border rounded-md w-12 animate-pulse" />
                <div className="h-9 bg-border rounded-md w-20 animate-pulse" />
                <div className="h-9 bg-border rounded-md w-20 animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 h-10 bg-border rounded-lg animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="h-10 bg-border rounded-lg w-24 animate-pulse" />
                <div className="h-10 bg-border rounded-lg w-28 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-12 space-y-10">
        {/* Stories Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-border rounded animate-pulse" />
            <div className="h-5 bg-border rounded w-16 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <StoryCardSkeleton key={i} delay={i * 50} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

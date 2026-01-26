import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import {
  ArrowUpDown,
  Book,
  BookmarkCheck,
  BookOpen,
  Filter,
  Headphones,
  Layers,
  LayoutGrid,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Paywall } from "@/components/Paywall";
import { AudioRecorder } from "@/components/shadowing/AudioRecorder";
import { FeedbackDisplay } from "@/components/shadowing/FeedbackDisplay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PremiumBackground } from "@/components/ui/premium-background";
import { matchesSearch, SearchBox } from "@/components/ui/search-box";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckPanel } from "@/components/vocabulary/DeckPanel";
import { DeckPickerModal } from "@/components/vocabulary/DeckPickerModal";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFlashcard } from "@/hooks/useFlashcard";
import { isAdmin as checkIsAdmin } from "@/lib/admin";
import {
  type DictionaryEntry,
  preloadDictionary,
  searchClientDictionary,
} from "@/lib/clientDictionary";
import { useT, useUILanguage } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Sort options
type SortOption = "newest" | "oldest" | "alphabetical" | "alphabetical-reverse" | "by-mastery";

const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: "newest", labelKey: "vocabulary.sort.newest" },
  { value: "oldest", labelKey: "vocabulary.sort.oldest" },
  { value: "alphabetical", labelKey: "vocabulary.sort.alphabetical" },
  { value: "alphabetical-reverse", labelKey: "vocabulary.sort.alphabeticalReverse" },
  { value: "by-mastery", labelKey: "vocabulary.sort.byMastery" },
];

// Mastery state metadata
const MASTERY_ORDER = ["new", "learning", "tested", "mastered"] as const;
const MASTERY_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  learning: "bg-amber-500/10 text-amber-600",
  tested: "bg-purple-500/10 text-purple-600",
  mastered: "bg-green-500/10 text-green-600",
};

import { type ContentLanguage, contentLanguageMatchesUI, LANGUAGES } from "@/lib/contentLanguages";
import type { MasteryState } from "@/lib/convex-types";

// Type for vocabulary item used in detail modal (subset of Doc<"vocabulary">)
type VocabularyItem = {
  _id: string;
  _creationTime: number;
  word: string;
  reading?: string | null;
  definitions: string[];
  language: string;
  masteryState?: MasteryState;
  examLevel?: string | null;
  sourceStoryTitle?: string | null;
  sourceContext?: string | null;
  flashcardPending?: boolean | null;
  // Properties that may come from flashcard resolution or premade vocab
  level?: string;
  deckId?: string;
  sentence?: string | null;
  sentenceTranslation?: string | null;
  audioUrl?: string | null;
  wordAudioUrl?: string | null;
  imageUrl?: string | null;
};

// Type for premade vocabulary items (from premadeDecks)
type PremadeVocabItem = {
  _id: string;
  _creationTime: number;
  word: string;
  reading?: string | null;
  definitions: string[];
  language: string;
  level?: string;
  deckId?: string;
  sentence?: string | null;
  sentenceTranslation?: string | null;
  audioUrl?: string | null;
  wordAudioUrl?: string | null;
  imageUrl?: string | null;
  generationStatus?: string;
  // Properties for compatibility with VocabularyItem
  masteryState?: MasteryState;
  flashcardPending?: boolean | null;
  sourceContext?: string | null;
  examLevel?: string | null;
  sourceStoryTitle?: string | null;
};

// Union type for vocabulary items (user vocab or premade)
type AnyVocabItem = VocabularyItem | PremadeVocabItem;

// Type for flashcard data that may have resolved content
type FlashcardWithContent = {
  _id: string;
  sentence?: string | null;
  sentenceTranslation?: string | null;
  audioUrl?: string | null;
  wordAudioUrl?: string | null;
  imageUrl?: string | null;
  [key: string]: unknown;
};

export function VocabularyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [languageFilter, setLanguageFilter] = useState<ContentLanguage | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Deck panel state
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // Pagination state for "All Words" view
  const [allWordsOffset, setAllWordsOffset] = useState(0);
  const [accumulatedAllWords, setAccumulatedAllWords] = useState<PremadeVocabItem[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;

  // Virtual scrolling ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { trackEvent, events } = useAnalytics();
  const t = useT();
  const { language: uiLang } = useUILanguage();
  const userId = user?.id ?? "anonymous";
  const isAdmin = checkIsAdmin(user?.email);

  // Add daily cards mutation
  const addDailyCards = useMutation(api.userDeckSubscriptions.addDailyCards);
  const hasTrackedPageViewRef = useRef(false);

  // Trigger daily card drip on page load
  useEffect(() => {
    if (isAuthenticated && userId !== "anonymous") {
      addDailyCards({ userId }).catch(() => {
        // Silently fail - user might not have any active decks
      });
    }
  }, [isAuthenticated, userId, addDailyCards]);

  // Get personal deck to distinguish from premade decks
  const personalDeck = useQuery(
    api.premadeDecks.getPersonalDeck,
    isAuthenticated ? { userId } : "skip"
  );
  const isPersonalDeckSelected = selectedDeckId === personalDeck?.deckId;

  // Query for vocabulary based on selection:
  // - No deck selected (All Words): show all premade vocabulary from subscribed decks
  // - Personal deck selected: show user's vocabulary from personal deck
  // - Premade deck selected: show all premade vocabulary for that deck
  const userVocabulary = useQuery(
    api.vocabulary.listByDeck,
    isAuthenticated && isPersonalDeckSelected && selectedDeckId
      ? { userId, sourceDeckId: selectedDeckId }
      : "skip"
  );

  // Use paginated query with explicit offset for "All Words" view
  const paginatedAllWords = useQuery(
    api.premadeDecks.getAllSubscribedVocabularyWithOffset,
    isAuthenticated && !selectedDeckId
      ? { userId, uiLanguage: uiLang, offset: allWordsOffset, limit: PAGE_SIZE }
      : "skip"
  );

  // Accumulate paginated results for "All Words" view
  useEffect(() => {
    if (paginatedAllWords?.items) {
      if (allWordsOffset === 0) {
        // First page - replace accumulated items
        setAccumulatedAllWords(paginatedAllWords.items as PremadeVocabItem[]);
      } else {
        // Subsequent pages - append to accumulated items
        setAccumulatedAllWords((prev) => [
          ...prev,
          ...(paginatedAllWords.items as PremadeVocabItem[]),
        ]);
      }
    }
  }, [paginatedAllWords, allWordsOffset]);

  // Reset pagination when switching away from "All Words" view
  useEffect(() => {
    if (selectedDeckId) {
      setAllWordsOffset(0);
      setAccumulatedAllWords([]);
    }
  }, [selectedDeckId]);

  // IntersectionObserver for infinite scroll in "All Words" view
  // Use a ref to track current loading/hasMore state to avoid stale closures
  const paginationStateRef = useRef({ hasMore: false, isLoading: true });
  paginationStateRef.current = {
    hasMore: paginatedAllWords?.hasMore ?? false,
    isLoading: paginatedAllWords === undefined,
  };

  useEffect(() => {
    if (selectedDeckId) return;

    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const { hasMore, isLoading } = paginationStateRef.current;
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setAllWordsOffset((prev) => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(currentRef);

    return () => {
      observer.unobserve(currentRef);
    };
  }, [selectedDeckId]);

  const premadeDeckVocabulary = useQuery(
    api.premadeDecks.getVocabularyForDeck,
    isAuthenticated && selectedDeckId && !isPersonalDeckSelected
      ? { deckId: selectedDeckId, uiLanguage: uiLang }
      : "skip"
  );

  // Combine into a unified list (premade items get adapted to match display)
  const vocabulary = useMemo(() => {
    if (isPersonalDeckSelected) {
      return userVocabulary ?? [];
    }
    if (selectedDeckId) {
      return premadeDeckVocabulary ?? [];
    }
    // For "All Words", use accumulated items from pagination
    return accumulatedAllWords;
  }, [
    selectedDeckId,
    isPersonalDeckSelected,
    userVocabulary,
    premadeDeckVocabulary,
    accumulatedAllWords,
  ]);

  // Track if we're loading more items (for showing skeletons at bottom)
  const isLoadingMoreAllWords =
    !selectedDeckId && allWordsOffset > 0 && paginatedAllWords === undefined;
  // Track if initial load is in progress for "All Words"
  const isInitialLoadAllWords =
    !selectedDeckId && allWordsOffset === 0 && paginatedAllWords === undefined;
  // Total count for "All Words" view (from pagination data)
  const allWordsTotalCount = paginatedAllWords?.totalCount ?? accumulatedAllWords.length;

  // Track page view (placed after vocabulary is defined)
  useEffect(() => {
    if (hasTrackedPageViewRef.current) return;
    if (isAuthenticated) {
      hasTrackedPageViewRef.current = true;
      trackEvent(events.VOCABULARY_VIEWED, {
        word_count: vocabulary?.length ?? 0,
        language_filter: languageFilter,
      });
    }
  }, [isAuthenticated, trackEvent, events, vocabulary?.length, languageFilter]);

  // Check if viewing premade content (for display adaptation)
  const isViewingPremade = !isPersonalDeckSelected;

  const removeWord = useMutation(api.vocabulary.remove);

  // Subscription check
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";
  // Pro check for premium features like image generation and shadowing
  const hasProAccess = subscription?.tier === "pro";

  // Filter vocabulary (with romaji support)
  const filteredVocabulary = useMemo(() => {
    if (!vocabulary) return [];

    return vocabulary.filter((item: AnyVocabItem) => {
      // Search filter
      if (searchTerm) {
        const matches =
          matchesSearch(item.word, searchTerm) ||
          matchesSearch(item.reading || "", searchTerm) ||
          item.definitions.some((def: string) => matchesSearch(def, searchTerm));
        if (!matches) return false;
      }

      // Mastery filter - only applies to user vocabulary, not premade
      if (
        masteryFilter &&
        !isViewingPremade &&
        "masteryState" in item &&
        item.masteryState !== masteryFilter
      ) {
        return false;
      }

      return true;
    });
  }, [vocabulary, searchTerm, masteryFilter, isViewingPremade]);

  // Sort vocabulary
  const sortedVocabulary = useMemo(() => {
    const items = [...filteredVocabulary] as AnyVocabItem[];

    switch (sortBy) {
      case "newest":
        return items.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
      case "oldest":
        return items.sort((a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0));
      case "alphabetical":
        return items.sort((a, b) => a.word.localeCompare(b.word, "ja"));
      case "alphabetical-reverse":
        return items.sort((a, b) => b.word.localeCompare(a.word, "ja"));
      case "by-mastery":
        // Only works for user vocabulary, not premade
        if (isViewingPremade) return items;
        return items.sort((a, b) => {
          const idxA = MASTERY_ORDER.indexOf(a.masteryState as (typeof MASTERY_ORDER)[number]);
          const idxB = MASTERY_ORDER.indexOf(b.masteryState as (typeof MASTERY_ORDER)[number]);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
      default:
        return items;
    }
  }, [filteredVocabulary, sortBy, isViewingPremade]);

  // Group by mastery (only when sorted by mastery and viewing user vocabulary)
  const groupedByMastery = useMemo(() => {
    if (sortBy !== "by-mastery" || isViewingPremade) return null;

    const groups = new Map<string, typeof sortedVocabulary>();

    sortedVocabulary.forEach((item: AnyVocabItem) => {
      const mastery = ("masteryState" in item && item.masteryState) || "new";
      if (!groups.has(mastery)) {
        groups.set(mastery, []);
      }
      groups.get(mastery)!.push(item);
    });

    return [...MASTERY_ORDER]
      .filter((mastery) => groups.has(mastery))
      .map((mastery) => ({
        mastery,
        items: groups.get(mastery)!,
      }));
  }, [sortedVocabulary, sortBy, isViewingPremade]);

  // Virtual scrolling setup for flat list - only when list is large enough
  // Disable virtual scrolling for premade content since card heights vary with sentence length
  // For user vocab, use estimated heights
  const shouldUseVirtualScrolling =
    sortedVocabulary.length > 100 && sortBy !== "by-mastery" && !isViewingPremade;
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is safe here, we don't pass its functions to memoized components
  const rowVirtualizer = useVirtualizer({
    count: sortedVocabulary.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(() => (isCompactMode ? 52 : 130), [isCompactMode]),
    overscan: 5,
    enabled: shouldUseVirtualScrolling,
  });

  // Track search with debounce
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const resultCount = sortedVocabulary.length; // capture at effect run time
    const timeout = setTimeout(() => {
      trackEvent(events.VOCABULARY_SEARCHED, {
        search_term: searchTerm,
        result_count: resultCount,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm, sortedVocabulary.length, trackEvent, events]);

  const handleRemove = async (id: string) => {
    try {
      await removeWord({ id: id as GenericId<"vocabulary"> });
      trackEvent(events.WORD_REMOVED_FROM_VOCABULARY, { word_id: id });
    } catch (err) {
      console.error("Failed to remove word:", err);
    }
  };

  // Only show filter chips for language/mastery, not deck (deck panel shows that)
  const hasActiveFilters = languageFilter !== null || masteryFilter !== null;
  const hasAnyFilter = hasActiveFilters || selectedDeckId !== null;

  // Don't show sign-in prompt while auth is still loading
  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookmarkCheck className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t("vocabulary.signInPrompt.title")}
          </h2>
          <p className="text-foreground-muted">{t("vocabulary.signInPrompt.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Animated background */}
      <PremiumBackground variant="subtle" colorScheme="warm" orbCount={1} />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-8 pb-12 flex-shrink-0">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <BookmarkCheck className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-sm font-semibold text-amber-500 uppercase tracking-wider">
                    {t("vocabulary.yourWords")}
                  </span>
                </div>
                <h1
                  className="text-3xl sm:text-4xl font-bold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("vocabulary.title")}
                </h1>
                <p className="text-foreground-muted text-lg">{t("vocabulary.yourCollection")}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Generate All Flashcards button removed to prevent accidental mass AI requests */}
                <Button
                  variant="glass-accent"
                  onClick={() => setShowAddModal(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t("vocabulary.addWord")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex-shrink-0">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t("vocabulary.searchPlaceholder")}
              className="w-80"
            />

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="gap-2">
                <ArrowUpDown className="w-4 h-4 text-foreground-muted" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Language Filter - disabled when deck is selected */}
            <Select
              value={languageFilter ?? "all"}
              onValueChange={(value) =>
                setLanguageFilter(value === "all" ? null : (value as ContentLanguage))
              }
              disabled={!!selectedDeckId}
            >
              <SelectTrigger className={`gap-2 ${selectedDeckId ? "opacity-60" : ""}`}>
                <Filter
                  className={`w-4 h-4 ${languageFilter && !selectedDeckId ? "text-accent" : "text-foreground-muted"}`}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vocabulary.filters.allLanguages")}</SelectItem>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {t(`common.languages.${lang.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mastery Filter */}
            <Select
              value={masteryFilter ?? "all"}
              onValueChange={(value) => setMasteryFilter(value === "all" ? null : value)}
            >
              <SelectTrigger className="gap-2">
                <BookmarkCheck
                  className={`w-4 h-4 ${masteryFilter ? "text-accent" : "text-foreground-muted"}`}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("vocabulary.filters.allMastery")}</SelectItem>
                {MASTERY_ORDER.map((mastery) => (
                  <SelectItem key={mastery} value={mastery}>
                    {t(`vocabulary.mastery.${mastery}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Compact Mode Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={
                isCompactMode ? "bg-accent/10 border-accent text-accent" : "text-foreground-muted"
              }
              title={isCompactMode ? "Switch to expanded view" : "Switch to compact view"}
            >
              {isCompactMode ? (
                <LayoutList className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Mobile deck button */}
          <div className="lg:hidden mt-3">
            <Button
              onClick={() => setShowDeckPicker(true)}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Layers className="w-4 h-4" />
              {t("vocabulary.browseDecks")}
            </Button>
          </div>

          {/* Active filters summary - only for language/mastery, not deck */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-foreground-muted">
                {t("vocabulary.filters.label")}:
              </span>
              {languageFilter && (
                <button
                  onClick={() => setLanguageFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  {t(`common.languages.${languageFilter}`)}
                  <span className="ml-1">×</span>
                </button>
              )}
              {masteryFilter && (
                <button
                  onClick={() => setMasteryFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  {t(`vocabulary.mastery.${masteryFilter}`)}
                  <span className="ml-1">×</span>
                </button>
              )}
              <button
                onClick={() => {
                  setLanguageFilter(null);
                  setMasteryFilter(null);
                }}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                {t("vocabulary.filters.clearAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl flex-1 overflow-hidden">
        <div className="flex gap-6 h-full">
          {/* Deck Panel - sticky at top of scroll container */}
          <div className="hidden lg:block sticky top-0 self-start">
            <DeckPanel
              userId={userId}
              onBrowseDecks={() => setShowDeckPicker(true)}
              selectedDeckId={selectedDeckId}
              onSelectDeck={setSelectedDeckId}
            />
          </div>

          {/* Vocabulary content */}
          <div className="flex-1 min-w-0 h-full overflow-y-auto pr-2">
            {/* Results count - fade in to avoid flicker */}
            <div className="mb-4 h-5">
              <p
                className={`text-sm text-foreground-muted transition-opacity duration-200 ${vocabulary.length === 0 && isInitialLoadAllWords ? "opacity-0" : "opacity-100"}`}
              >
                {/* For "All Words", show total count; for specific decks, show filtered/total */}
                <span className="font-medium text-foreground">
                  {!selectedDeckId ? allWordsTotalCount : sortedVocabulary.length}
                </span>{" "}
                {(!selectedDeckId ? allWordsTotalCount : sortedVocabulary.length) === 1
                  ? t("vocabulary.word")
                  : t("vocabulary.words")}
                {/* Show filtered count for specific deck views when filtering */}
                {selectedDeckId &&
                  vocabulary.length > 0 &&
                  sortedVocabulary.length !== vocabulary.length &&
                  ` (${t("vocabulary.ofTotal", { total: vocabulary.length })})`}
              </p>
            </div>

            {/* Vocabulary List */}
            <div className="pb-12">
              {(vocabulary === undefined && !accumulatedAllWords.length) ||
              isInitialLoadAllWords ? (
                <div className="space-y-4">
                  {Array.from({ length: 10 }).map((_, i) => (
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
                    {searchTerm || hasAnyFilter
                      ? t("vocabulary.empty.noMatches")
                      : t("vocabulary.empty.title")}
                  </p>
                  <p className="text-sm text-center max-w-sm mb-4">
                    {searchTerm || hasAnyFilter
                      ? t("vocabulary.empty.tryAdjusting")
                      : t("vocabulary.empty.description")}
                  </p>
                  {!searchTerm && !hasAnyFilter && (
                    <Button
                      onClick={() => setShowAddModal(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {t("vocabulary.empty.addFirst")}
                    </Button>
                  )}
                </div>
              ) : groupedByMastery ? (
                // Grouped by mastery view
                <div className="space-y-8">
                  {groupedByMastery.map(({ mastery, items }) => (
                    <section key={mastery}>
                      <div className="flex items-center gap-3 mb-4">
                        <span
                          className={`text-sm font-medium px-3 py-1 rounded-full ${MASTERY_COLORS[mastery]}`}
                        >
                          {t(`vocabulary.mastery.${mastery}`)}
                        </span>
                        <span className="text-sm text-foreground-muted">
                          {items.length}{" "}
                          {items.length === 1 ? t("vocabulary.word") : t("vocabulary.words")}
                        </span>
                      </div>
                      <div className={isCompactMode ? "space-y-1" : "space-y-3"}>
                        {items.map((item: AnyVocabItem, index: number) => (
                          <VocabularyCard
                            key={item._id}
                            item={item}
                            onRemove={isViewingPremade ? undefined : handleRemove}
                            showMastery={false}
                            delay={Math.min(index * 30, 150)}
                            onShowPaywall={() => setShowPaywall(true)}
                            isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
                            hasProAccess={subscription === undefined ? undefined : !!hasProAccess}
                            isAdmin={isAdmin}
                            onClick={() => setSelectedVocab(item)}
                            compact={isCompactMode}
                            isPremade={isViewingPremade}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : shouldUseVirtualScrolling ? (
                // Virtual scrolling for large lists
                <div ref={scrollContainerRef} className="h-full overflow-auto">
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const item = sortedVocabulary[virtualRow.index];
                      return (
                        <div
                          key={item._id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className={isCompactMode ? "pb-1" : "pb-3"}>
                            <VocabularyCard
                              item={item}
                              onRemove={isViewingPremade ? undefined : handleRemove}
                              showMastery={true}
                              delay={0}
                              onShowPaywall={() => setShowPaywall(true)}
                              isPremiumUser={
                                subscription === undefined ? undefined : !!isPremiumUser
                              }
                              hasProAccess={subscription === undefined ? undefined : !!hasProAccess}
                              isAdmin={isAdmin}
                              onClick={() => setSelectedVocab(item)}
                              compact={isCompactMode}
                              isPremade={isViewingPremade}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Regular flat list for smaller lists
                <div className={isCompactMode ? "space-y-1" : "space-y-3"}>
                  {sortedVocabulary.map((item: AnyVocabItem, index: number) => (
                    <VocabularyCard
                      key={item._id}
                      item={item}
                      onRemove={isViewingPremade ? undefined : handleRemove}
                      showMastery={true}
                      delay={Math.min(index * 30, 150)}
                      onShowPaywall={() => setShowPaywall(true)}
                      isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
                      hasProAccess={subscription === undefined ? undefined : !!hasProAccess}
                      isAdmin={isAdmin}
                      onClick={() => setSelectedVocab(item)}
                      compact={isCompactMode}
                      isPremade={isViewingPremade}
                    />
                  ))}

                  {/* Infinite scroll trigger for "All Words" pagination */}
                  {!selectedDeckId && <div ref={loadMoreRef} className="h-10" />}

                  {/* Loading skeletons while fetching more for "All Words" */}
                  {isLoadingMoreAllWords && (
                    <div className="space-y-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={`skeleton-${i}`}
                          className="p-5 rounded-xl bg-surface border border-border animate-pulse"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div className="h-6 bg-muted rounded w-24 mb-2" />
                          <div className="h-4 bg-muted rounded w-48" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Word Modal */}
      {showAddModal && (
        <AddWordModal
          userId={userId}
          onClose={() => setShowAddModal(false)}
          isPremiumUser={subscription === undefined ? false : !!isPremiumUser}
          hasProAccess={subscription === undefined ? false : !!hasProAccess}
        />
      )}

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="flashcards" />

      {/* Vocabulary Detail Modal */}
      {selectedVocab && (
        <VocabularyDetailModal
          item={selectedVocab}
          onClose={() => setSelectedVocab(null)}
          isPremade={isViewingPremade}
        />
      )}

      {/* Deck Picker Modal */}
      <DeckPickerModal
        userId={userId}
        isOpen={showDeckPicker}
        onClose={() => setShowDeckPicker(false)}
        defaultLanguage={languageFilter ?? "japanese"}
      />
    </div>
  );
}

// Vocabulary card component
interface VocabularyCardProps {
  item: VocabularyItem | PremadeVocabItem;
  onRemove?: (id: string) => void;
  showMastery?: boolean;
  delay?: number;
  onShowPaywall?: () => void;
  isPremiumUser?: boolean;
  hasProAccess?: boolean;
  isAdmin?: boolean;
  onClick?: () => void;
  compact?: boolean;
  isPremade?: boolean;
}

function VocabularyCard({
  item,
  onRemove,
  showMastery = true,
  delay = 0,
  onShowPaywall,
  isPremiumUser,
  hasProAccess,
  isAdmin,
  onClick,
  compact = false,
  isPremade = false,
}: VocabularyCardProps) {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const languageFont = item.language === "japanese" ? "var(--font-japanese)" : "inherit";
  const [isEnhancing, setIsEnhancing] = useState(false);
  // Hide translation if content language matches UI language
  const hideRedundantTranslation = contentLanguageMatchesUI(
    item.language as ContentLanguage,
    uiLanguage
  );

  // For premade items, content is directly on the item
  // For user vocab, we need to fetch the flashcard
  const existingFlashcard = useFlashcard(isPremade ? undefined : item._id);

  const generateFlashcardWithAudio = useAIAction(api.ai.generateFlashcardWithAudio);
  const enhancePremadeVocabulary = useAIAction(api.ai.enhancePremadeVocabulary);
  const updateVocabulary = useMutation(api.vocabulary.update);

  // Calculate what's being enhanced for skeleton display
  // Word audio is NEVER regenerated - only generated when missing
  // Sentence audio IS regenerated on re-enhance (along with new sentence)
  const hasAllContent =
    isPremade && item.sentence && item.audioUrl && item.wordAudioUrl && item.imageUrl;
  const isEnhancingSentence = isEnhancing && isPremade && (hasAllContent || !item.sentence);
  const isEnhancingSentenceAudio = isEnhancing && isPremade && (hasAllContent || !item.audioUrl);
  const isEnhancingWordAudio = isEnhancing && isPremade && !item.wordAudioUrl; // Only when missing

  // For premade items, use the item's content directly
  const premadeContent = isPremade
    ? {
        sentence: item.sentence,
        sentenceTranslation: item.sentenceTranslation,
        audioUrl: item.audioUrl,
        wordAudioUrl: item.wordAudioUrl,
        imageUrl: item.imageUrl,
      }
    : null;

  // Query states: undefined = loading
  const isLoadingFlashcard = !isPremade && existingFlashcard === undefined;
  const hasFlashcard = isPremade
    ? !!item.sentence
    : existingFlashcard !== undefined && existingFlashcard !== null;

  // Use premade content or flashcard content
  // Cast to FlashcardWithContent since the query may return raw data without resolved URLs
  const content = (premadeContent || existingFlashcard) as FlashcardWithContent | null;

  const handleEnhancePremade = async () => {
    if (!isPremade || !isAdmin) return;
    setIsEnhancing(true);
    try {
      // If all content exists (including image), regenerate sentence and sentence audio only
      // Otherwise, generate what's missing
      const hasAllContent = item.sentence && item.audioUrl && item.wordAudioUrl && item.imageUrl;

      await enhancePremadeVocabulary({
        premadeVocabularyId: item._id as Id<"premadeVocabulary">,
        generateSentence: hasAllContent ? true : !item.sentence, // Always regenerate if complete
        generateAudio: hasAllContent ? true : !item.audioUrl || !item.wordAudioUrl, // Regenerate audio with new sentence
        generateImage: hasProAccess && !item.imageUrl, // Only generate image if missing AND user has Pro+
      });
    } catch (err) {
      console.error("Failed to enhance premade vocabulary:", err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateFlashcard = async () => {
    if (isAdmin) {
      // Admin can generate directly - set pending state first
      try {
        await updateVocabulary({
          id: item._id as Id<"vocabulary">,
          flashcardPending: true,
        });
        // Fire and forget - the action will clear flashcardPending when done
        generateFlashcardWithAudio({
          vocabularyId: item._id as Id<"vocabulary">,
          includeAudio: true,
          includeImage: hasProAccess || isAdmin, // Image generation requires Pro+ (admins always get images)
        }).catch((err) => {
          console.error("Failed to generate flashcard:", err);
        });
      } catch (err) {
        console.error("Failed to set pending state:", err);
      }
    } else {
      // Show paywall for non-admin users
      onShowPaywall?.();
    }
  };

  // Compact view - single row with essential info
  if (compact) {
    return (
      <div
        className="px-4 py-3 rounded-lg bg-surface/80 dark:bg-white/[0.03] backdrop-blur-md border border-border dark:border-white/10 hover:border-foreground-muted/30 dark:hover:border-white/20 dark:hover:shadow-[0_0_15px_rgba(255,132,0,0.08)] transition-all duration-200 cursor-pointer"
        style={{ animationDelay: `${delay}ms` }}
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          {/* Word and reading */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <span
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: languageFont }}
            >
              {item.word}
            </span>
            {item.reading && (
              <span className="text-sm text-foreground-muted" style={{ fontFamily: languageFont }}>
                ({item.reading})
              </span>
            )}
          </div>

          {/* Definition - truncated */}
          <div className="flex-1 min-w-0">
            <span className="text-sm text-foreground truncate block">
              {item.definitions.join("; ")}
            </span>
          </div>

          {/* Mastery badge (user vocab) or Level badge (premade) */}
          {isPremade ? (
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-accent/10 text-accent">
              {item.level}
            </span>
          ) : (
            showMastery &&
            item.masteryState &&
            item.masteryState !== "new" && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${MASTERY_COLORS[item.masteryState] ?? "bg-muted text-foreground-muted"}`}
              >
                {t(`vocabulary.mastery.${item.masteryState}`)}
              </span>
            )
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isEnhancingWordAudio ? (
              <Skeleton className="w-7 h-7 rounded-lg animate-pulse" />
            ) : (
              content?.wordAudioUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    new Audio(content.wordAudioUrl!).play();
                  }}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  title={t("vocabulary.card.playPronunciation")}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )
            )}
            {/* Compact enhance indicator */}
            {isPremade && isEnhancing && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
            {!isPremade && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item._id)}
                className="text-foreground-muted hover:text-destructive hover:bg-destructive/10 p-1.5 h-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-5 rounded-xl bg-surface/80 dark:bg-white/[0.03] backdrop-blur-md border border-border dark:border-white/10 hover:border-foreground-muted/30 dark:hover:border-white/20 dark:hover:shadow-[0_0_20px_rgba(255,132,0,0.1)] transition-all duration-200 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: languageFont }}
            >
              {item.word}
            </span>
            {/* Word audio button - show skeleton while pending/enhancing (only when missing), button when ready */}
            {(!isPremade && item.flashcardPending && !content?.wordAudioUrl) ||
            isEnhancingWordAudio ? (
              <Skeleton className="w-7 h-7 rounded-lg animate-pulse" />
            ) : (
              !isLoadingFlashcard &&
              content?.wordAudioUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    new Audio(content.wordAudioUrl!).play();
                  }}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  title={t("vocabulary.card.playPronunciation")}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )
            )}
          </div>
          {item.reading && <div className="text-sm text-foreground-muted mb-2">{item.reading}</div>}
          <div className="text-foreground">{item.definitions.join("; ")}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Level badge for premade, mastery for user vocab */}
          {isPremade ? (
            <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">
              {item.level}
            </span>
          ) : (
            showMastery &&
            item.masteryState &&
            item.masteryState !== "new" && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${MASTERY_COLORS[item.masteryState] ?? "bg-muted text-foreground-muted"}`}
              >
                {t(`vocabulary.mastery.${item.masteryState}`)}
              </span>
            )
          )}
          {/* Enhance button for premade items - admin only */}
          {isPremade && isAdmin && !isEnhancing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnhancePremade}
              className="text-foreground-muted hover:text-accent hover:bg-accent/10"
              title={t("vocabulary.card.generateFlashcard")}
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
          {/* Show enhancing indicator for premade items */}
          {isPremade && isEnhancing && (
            <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("vocabulary.card.enhancing")}
            </span>
          )}
          {/* Generate flashcard button - only for user vocab */}
          {!isPremade &&
            !isLoadingFlashcard &&
            !hasFlashcard &&
            !item.flashcardPending &&
            (isAdmin || isPremiumUser === false) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateFlashcard}
                className="text-foreground-muted hover:text-accent hover:bg-accent/10"
                title={t("vocabulary.card.generateFlashcard")}
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            )}
          {/* Show generating indicator when flashcard is pending */}
          {!isPremade && item.flashcardPending && (
            <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("vocabulary.card.generatingContent")}
            </span>
          )}
          {/* Study button - only for user vocab */}
          {!isPremade && (
            <Link
              to="/learn"
              search={{ tab: "practice", vocabularyId: item._id }}
              className="p-2 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
              title={t("vocabulary.card.practiceWriting")}
            >
              <Book className="w-4 h-4" />
            </Link>
          )}
          {/* Remove button - only for user vocab */}
          {!isPremade && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item._id)}
              className="text-foreground-muted hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {/* Example sentence - show source context, generated sentence, or skeleton while generating/enhancing */}
      {(item.sourceContext ||
        content?.sentence ||
        (!isPremade && item.flashcardPending) ||
        isEnhancingSentence) && (
        <div className="mt-3">
          {item.sourceContext ? (
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm text-foreground" style={{ fontFamily: languageFont }}>
                {item.sourceContext}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                {t("vocabulary.card.originalContext")}
              </p>
            </div>
          ) : (!isPremade && item.flashcardPending && !content?.sentence) || isEnhancingSentence ? (
            <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full animate-pulse" />
                  <Skeleton className="h-4 w-3/4 animate-pulse" />
                </div>
                <Skeleton className="w-7 h-7 rounded-lg shrink-0 animate-pulse" />
              </div>
              <p className="text-xs text-foreground-muted mt-2">
                {isEnhancingSentence
                  ? t("vocabulary.card.regeneratingSentence")
                  : t("vocabulary.card.generatingSentence")}
              </p>
            </div>
          ) : (
            content?.sentence && (
              <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-foreground" style={{ fontFamily: languageFont }}>
                      {content.sentence}
                    </p>
                    {content.sentenceTranslation && !hideRedundantTranslation && (
                      <p className="text-xs text-foreground-muted mt-1 italic">
                        {content.sentenceTranslation}
                      </p>
                    )}
                  </div>
                  {content.audioUrl && !isEnhancingSentenceAudio ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        new Audio(content.audioUrl!).play();
                      }}
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                      title={t("vocabulary.card.playSentence")}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  ) : (
                    isEnhancingSentenceAudio && (
                      <Skeleton className="w-7 h-7 rounded-lg shrink-0 animate-pulse" />
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted capitalize">
          {item.language}
        </span>
        {/* Show level for premade, examLevel for user vocab */}
        {isPremade && item.deckId && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted">
            {item.deckId.replace(/_/g, " ")}
          </span>
        )}
        {!isPremade && item.examLevel && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {item.examLevel}
          </span>
        )}
        {!isPremade && item.sourceStoryTitle && (
          <span className="text-xs text-foreground-muted flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {item.sourceStoryTitle}
          </span>
        )}
      </div>
    </div>
  );
}

// Vocabulary Detail Modal - styled like flashcard answer view
interface VocabularyDetailModalProps {
  item: VocabularyItem | PremadeVocabItem;
  onClose: () => void;
  isPremade?: boolean;
}

function VocabularyDetailModal({ item, onClose, isPremade = false }: VocabularyDetailModalProps) {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const languageFont = item.language === "japanese" ? "var(--font-japanese)" : "inherit";
  const isJapanese = item.language === "japanese";
  // Hide translation if content language matches UI language
  const hideRedundantTranslation = contentLanguageMatchesUI(
    item.language as ContentLanguage,
    uiLanguage
  );

  // Shadowing state
  const [showShadowing, setShowShadowing] = useState(false);
  const [shadowingState, setShadowingState] = useState<
    "ready" | "recording" | "processing" | "results"
  >("ready");
  const [shadowingResult, setShadowingResult] = useState<{
    accuracyScore: number;
    feedbackText: string;
    feedbackAudioUrl?: string;
  } | null>(null);

  const recorder = useAudioRecorder();
  const evaluateShadowing = useAIAction(api.ai.evaluateShadowing);
  const submitShadowing = useMutation(api.shadowing.submit);

  // Fetch the flashcard data - skip for premade items
  const flashcardData = useFlashcard(isPremade ? undefined : item._id);

  // For premade items, use item's content directly
  // Cast to FlashcardWithContent since the query may return raw data without resolved URLs
  const flashcard = (
    isPremade
      ? {
          sentence: item.sentence,
          sentenceTranslation: item.sentenceTranslation,
          audioUrl: item.audioUrl,
          wordAudioUrl: item.wordAudioUrl,
          imageUrl: item.imageUrl,
        }
      : flashcardData
  ) as FlashcardWithContent | null | undefined;

  const playAudio = (url: string) => {
    new Audio(url).play();
  };

  // Shadowing handlers
  const handleStartShadowing = async () => {
    await recorder.startRecording();
    setShadowingState("recording");
  };

  const handleStopShadowing = async () => {
    setShadowingState("processing");

    try {
      // stopRecording now returns a Promise that resolves with the blob
      const audioBlob = await recorder.stopRecording();
      if (!audioBlob || !flashcard?.sentence) {
        throw new Error("Failed to get audio data");
      }

      // Convert blob to base64
      const audioBase64 = await recorder.getBase64FromBlob(audioBlob);

      // Pass UI language for localized feedback
      const result = await evaluateShadowing({
        targetText: flashcard.sentence,
        targetLanguage: item.language as "japanese" | "english" | "french",
        userAudioBase64: audioBase64,
        feedbackLanguage: uiLanguage,
      });

      let feedbackAudioUrl: string | undefined;
      if (result.feedbackAudioBase64) {
        feedbackAudioUrl = `data:audio/wav;base64,${result.feedbackAudioBase64}`;
      }

      setShadowingResult({
        accuracyScore: result.accuracyScore,
        feedbackText: result.feedbackText,
        feedbackAudioUrl,
      });

      // Save to database (only pass vocabularyId for user vocab, not premade)
      await submitShadowing({
        userId,
        vocabularyId: isPremade ? undefined : (item._id as GenericId<"vocabulary">),
        targetText: flashcard.sentence,
        targetLanguage: item.language as "japanese" | "english" | "french",
        feedbackAudioUrl,
        feedbackText: result.feedbackText,
        accuracyScore: result.accuracyScore,
      });

      setShadowingState("results");
    } catch (error) {
      console.error("Shadowing evaluation failed:", error);
      setShadowingResult({
        accuracyScore: 0,
        feedbackText: "Failed to evaluate. Please try again.",
      });
      setShadowingState("results");
    }
  };

  const handleRetryShadowing = () => {
    setShadowingState("ready");
    setShadowingResult(null);
    recorder.clearRecording();
  };

  const handleCloseShadowing = () => {
    setShowShadowing(false);
    setShadowingState("ready");
    setShadowingResult(null);
    recorder.clearRecording();
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll when modal is open (with scrollbar compensation)
  useBodyScrollLock();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-surface/95 dark:bg-black/90 backdrop-blur-xl rounded-2xl border border-border dark:border-white/10 shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] w-full max-w-lg mx-4 animate-fade-in-up max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - fixed at top */}
        <div className="flex justify-end p-4 pb-0 flex-shrink-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 pt-2 overflow-y-auto flex-1">
          {/* Image */}
          {flashcard?.imageUrl && (
            <div className="mb-6 flex justify-center">
              <img
                src={flashcard.imageUrl}
                alt={item.word}
                className="max-w-full h-auto max-h-48 rounded-xl object-contain"
              />
            </div>
          )}

          {/* Word */}
          <div className="text-center mb-6">
            <div
              className="text-4xl sm:text-5xl font-bold text-foreground mb-2"
              style={{ fontFamily: languageFont }}
            >
              {item.word}
            </div>
            {/* Word Audio Button */}
            {flashcard?.wordAudioUrl && (
              <div className="mt-2">
                <button
                  onClick={() => playAudio(flashcard.wordAudioUrl!)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  {t("vocabulary.card.playWord")}
                </button>
              </div>
            )}
          </div>

          {/* Example Sentence */}
          {(flashcard?.sentence || item.sourceContext) && (
            <div className="bg-muted/50 rounded-xl p-4 mb-6">
              <p
                className="text-lg text-foreground leading-relaxed text-center"
                style={{ fontFamily: languageFont }}
              >
                {flashcard?.sentence || item.sourceContext}
              </p>
              {/* Sentence Translation - only if available and different from content language */}
              {flashcard?.sentenceTranslation && !hideRedundantTranslation && (
                <p className="text-sm text-foreground-muted text-center mt-2 italic">
                  {flashcard.sentenceTranslation}
                </p>
              )}
              {/* Sentence Audio Button */}
              {flashcard?.audioUrl && (
                <div className="flex justify-center gap-2 mt-3">
                  <button
                    onClick={() => playAudio(flashcard.audioUrl!)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    {t("vocabulary.card.playSentence")}
                  </button>
                  <button
                    onClick={() => setShowShadowing(!showShadowing)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      showShadowing
                        ? "bg-purple-500 text-white"
                        : "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                    }`}
                  >
                    <Headphones className="w-4 h-4" />
                    {t("vocabulary.card.practiceShadowing")}
                  </button>
                </div>
              )}

              {/* Shadowing Practice Section */}
              {showShadowing && flashcard?.audioUrl && (
                <div className="mt-4 pt-4 border-t border-border">
                  {shadowingState === "results" && shadowingResult ? (
                    <div className="space-y-4">
                      <FeedbackDisplay
                        accuracyScore={shadowingResult.accuracyScore}
                        feedbackText={shadowingResult.feedbackText}
                        feedbackAudioUrl={shadowingResult.feedbackAudioUrl}
                        userRecordingUrl={recorder.audioUrl}
                        targetText={flashcard.sentence || ""}
                        language={item.language as "japanese" | "english" | "french"}
                      />
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" size="sm" onClick={handleRetryShadowing}>
                          {t("vocabulary.shadowing.tryAgain")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCloseShadowing}>
                          {t("vocabulary.shadowing.done")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <AudioRecorder
                      isRecording={recorder.isRecording}
                      isPaused={recorder.isPaused}
                      isProcessing={shadowingState === "processing"}
                      duration={recorder.duration}
                      hasPermission={recorder.hasPermission}
                      error={recorder.error}
                      analyserNode={recorder.analyserNode}
                      onStartRecording={handleStartShadowing}
                      onStopRecording={handleStopShadowing}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reading (for Japanese) */}
          {isJapanese && item.reading && (
            <div className="text-center mb-4">
              <div className="text-sm text-foreground-muted mb-1">
                {t("vocabulary.card.reading")}
              </div>
              <div className="text-2xl text-foreground" style={{ fontFamily: languageFont }}>
                {item.reading}
              </div>
            </div>
          )}

          {/* Definition */}
          <div className="text-center mb-4">
            <div className="text-sm text-foreground-muted mb-1">
              {t("vocabulary.card.definition")}
            </div>
            <div className="text-xl font-medium text-foreground">{item.definitions.join("; ")}</div>
          </div>

          {/* Metadata tags */}
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {/* Mastery for user vocab, Level for premade */}
            {isPremade ? (
              <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">
                {item.level}
              </span>
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full ${MASTERY_COLORS[item.masteryState ?? "new"] ?? "bg-muted text-foreground-muted"}`}
              >
                {t(`vocabulary.mastery.${item.masteryState ?? "new"}`)}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted capitalize">
              {item.language}
            </span>
            {!isPremade && item.examLevel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                {item.examLevel}
              </span>
            )}
            {isPremade && item.deckId && (
              <span className="text-xs text-foreground-muted">
                {item.deckId.replace(/_/g, " ")}
              </span>
            )}
            {!isPremade && item.sourceStoryTitle && (
              <span className="text-xs text-foreground-muted flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {item.sourceStoryTitle}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Word Modal
interface AddWordModalProps {
  userId: string;
  onClose: () => void;
  isPremiumUser: boolean;
  hasProAccess?: boolean;
}

function AddWordModal({ userId, onClose, isPremiumUser, hasProAccess }: AddWordModalProps) {
  const t = useT();
  const { language: uiLanguage } = useUILanguage();
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [definitions, setDefinitions] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("japanese");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { trackEvent, events } = useAnalytics();
  const addWord = useMutation(api.vocabulary.add);
  const generateFlashcardWithAudio = useAIAction(api.ai.generateFlashcardWithAudio);
  const getOrCreatePersonalDeck = useMutation(api.premadeDecks.getOrCreatePersonalDeck);

  // Preload dictionary when modal opens
  useEffect(() => {
    preloadDictionary(language, uiLanguage);
  }, [language, uiLanguage]);

  // Search dictionary on input change (client-side, instant)
  useEffect(() => {
    const trimmed = word.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      return;
    }

    // Small debounce for typing smoothness
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchClientDictionary(trimmed, language, uiLanguage, 8);
        setSuggestions(results);
      } catch (err) {
        console.error("Search error:", err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [word, language, uiLanguage]);

  // Clear form when language changes
  useEffect(() => {
    setWord("");
    setReading("");
    setDefinitions("");
    setSuggestions([]);
    setShowSuggestions(false);
  }, [language]);

  const handleSelectSuggestion = (entry: DictionaryEntry) => {
    setWord(entry.word);
    setReading(entry.reading || "");
    setDefinitions(entry.meanings.join("; "));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !definitions.trim()) return;

    setIsSubmitting(true);
    try {
      // Get or create personal deck for this user
      const personalDeck = await getOrCreatePersonalDeck({ userId, language });

      const vocabId = await addWord({
        userId,
        language,
        word: word.trim(),
        reading: reading.trim() || undefined,
        definitions: definitions
          .split(/[,;]/)
          .map((d) => d.trim())
          .filter(Boolean),
        sourceType: "manual",
        sourceDeckId: personalDeck?.deckId, // Add to personal deck
        flashcardPending: isPremiumUser, // Show generating state for premium users
      });

      // Track word added
      trackEvent(events.WORD_ADDED_TO_VOCABULARY, {
        word: word.trim(),
        language,
        source: "manual",
      });

      // Close modal immediately for better UX
      onClose();

      // Trigger AI enhancement in background for premium users only
      if (vocabId && isPremiumUser) {
        generateFlashcardWithAudio({
          vocabularyId: vocabId,
          includeAudio: true,
          includeImage: !!hasProAccess, // Image generation requires Pro+
        }).catch((err) => {
          console.error("Background AI enhancement failed:", err);
        });
      }
    } catch (error) {
      console.error("Failed to add word:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0" showCloseButton={false}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {t("vocabulary.addModal.title")}
          </DialogTitle>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("vocabulary.addModal.language")}
            </label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as ContentLanguage)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent position="item-aligned">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {t(`common.languages.${lang.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Word with Autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("vocabulary.addModal.word")} <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder={
                  language === "japanese"
                    ? t("vocabulary.addModal.wordPlaceholderJapanese")
                    : t("vocabulary.addModal.wordPlaceholder")
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                required
              />
            </div>
            {/* Suggestions dropdown */}
            {showSuggestions && word.trim().length > 0 && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {suggestions.map((entry, index) => (
                  <button
                    key={`${entry.word}-${index}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(entry)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-medium text-foreground"
                        style={{
                          fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit",
                        }}
                      >
                        {entry.word}
                      </span>
                      {entry.reading && entry.reading !== entry.word && (
                        <span
                          className="text-sm text-foreground-muted"
                          style={{
                            fontFamily:
                              language === "japanese" ? "var(--font-japanese)" : "inherit",
                          }}
                        >
                          ({entry.reading})
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-foreground-muted line-clamp-1">
                      {entry.meanings[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions &&
              word.trim().length > 0 &&
              suggestions.length === 0 &&
              !isSearching && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg p-4 text-sm text-foreground-muted">
                  {t("vocabulary.addModal.noResults")}
                </div>
              )}
          </div>

          {/* Reading (for Japanese) */}
          {language === "japanese" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("vocabulary.addModal.readingLabel")}
              </label>
              <input
                type="text"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder={t("vocabulary.addModal.readingPlaceholder")}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                style={{ fontFamily: "var(--font-japanese)" }}
              />
            </div>
          )}

          {/* Definitions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("vocabulary.addModal.definitionLabel")} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={definitions}
              onChange={(e) => setDefinitions(e.target.value)}
              placeholder={t("vocabulary.addModal.definitionPlaceholder")}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              required
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("vocabulary.addModal.definitionHint")}
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              variant="glass-accent"
              disabled={isSubmitting || !word.trim() || !definitions.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("vocabulary.addModal.adding")}
                </>
              ) : (
                t("vocabulary.addWord")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

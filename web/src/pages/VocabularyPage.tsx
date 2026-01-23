import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import type { GenericId } from "convex/values";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBox, matchesSearch } from "@/components/ui/search-box";
import { Paywall } from "@/components/Paywall";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, BookOpen, BookmarkCheck, ChevronDown, ArrowUpDown, Filter, Plus, X, Loader2, Sparkles, Check, Volume2, Book, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { searchClientDictionary, preloadDictionary, type DictionaryEntry } from "@/lib/clientDictionary";
import { useFlashcard } from "@/hooks/useFlashcard";
import { DeckPanel } from "@/components/vocabulary/DeckPanel";
import { DeckPickerModal } from "@/components/vocabulary/DeckPickerModal";
import { useVirtualizer } from "@tanstack/react-virtual";

// Sort options
type SortOption = "newest" | "oldest" | "alphabetical" | "alphabetical-reverse" | "by-mastery";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "alphabetical", label: "A → Z" },
  { value: "alphabetical-reverse", label: "Z → A" },
  { value: "by-mastery", label: "By Mastery" },
];

// Mastery state metadata
const MASTERY_ORDER = ["new", "learning", "tested", "mastered"] as const;
const MASTERY_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-600" },
  learning: { label: "Learning", color: "bg-amber-500/10 text-amber-600" },
  tested: { label: "Tested", color: "bg-purple-500/10 text-purple-600" },
  mastered: { label: "Mastered", color: "bg-green-500/10 text-green-600" },
};

// Language options
const LANGUAGES = [
  { value: "japanese", label: "Japanese" },
  { value: "english", label: "English" },
  { value: "french", label: "French" },
] as const;

type Language = typeof LANGUAGES[number]["value"];

// Type for vocabulary item used in detail modal
type VocabularyItem = {
  _id: string;
  word: string;
  reading?: string | null;
  definitions: string[];
  language: string;
  masteryState: string;
  examLevel?: string | null;
  sourceStoryTitle?: string | null;
  sourceContext?: string | null;
  flashcardPending?: boolean | null;
};

export function VocabularyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [languageFilter, setLanguageFilter] = useState<Language | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);

  // Deck panel state
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // Virtual scrolling ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated } = useAuth();
  const { trackEvent, events } = useAnalytics();
  const userId = user?.id ?? "anonymous";
  const isAdmin = user?.email === "hiro.ayettey@gmail.com";

  // Add daily cards mutation
  const addDailyCards = useMutation(api.userDeckSubscriptions.addDailyCards);

  // Trigger daily card drip on page load
  useEffect(() => {
    if (isAuthenticated && userId !== "anonymous") {
      addDailyCards({ userId }).catch((err) => {
        // Silently fail - user might not have any active decks
        console.debug("Daily cards drip:", err);
      });
    }
  }, [isAuthenticated, userId]);

  // Track page view
  useEffect(() => {
    if (isAuthenticated) {
      trackEvent(events.VOCABULARY_VIEWED, {
        word_count: vocabulary?.length ?? 0,
        language_filter: languageFilter,
      });
    }
  }, [isAuthenticated]); // Only track on initial load

  // Query for vocabulary - either all or filtered by deck
  const vocabulary = useQuery(
    selectedDeckId ? api.vocabulary.listByDeck : api.vocabulary.list,
    isAuthenticated
      ? selectedDeckId
        ? { userId, sourceDeckId: selectedDeckId }
        : { userId, language: languageFilter ?? undefined }
      : "skip"
  );
  const removeWord = useMutation(api.vocabulary.remove);

  // Subscription check
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Filter vocabulary (with romaji support)
  const filteredVocabulary = useMemo(() => {
    if (!vocabulary) return [];

    return vocabulary.filter((item) => {
      // Search filter
      if (searchTerm) {
        const matches =
          matchesSearch(item.word, searchTerm) ||
          matchesSearch(item.reading || "", searchTerm) ||
          item.definitions.some((def) => matchesSearch(def, searchTerm));
        if (!matches) return false;
      }

      // Mastery filter
      if (masteryFilter && item.masteryState !== masteryFilter) {
        return false;
      }

      return true;
    });
  }, [vocabulary, searchTerm, masteryFilter]);

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
      case "by-mastery":
        return items.sort((a, b) => {
          const idxA = MASTERY_ORDER.indexOf(a.masteryState as typeof MASTERY_ORDER[number]);
          const idxB = MASTERY_ORDER.indexOf(b.masteryState as typeof MASTERY_ORDER[number]);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
      default:
        return items;
    }
  }, [filteredVocabulary, sortBy]);

  // Group by mastery (only when sorted by mastery)
  const groupedByMastery = useMemo(() => {
    if (sortBy !== "by-mastery") return null;

    const groups = new Map<string, typeof sortedVocabulary>();

    sortedVocabulary.forEach((item) => {
      const mastery = item.masteryState;
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
  }, [sortedVocabulary, sortBy]);

  // Virtual scrolling setup for flat list - only when list is large enough
  const shouldUseVirtualScrolling = sortedVocabulary.length > 50 && sortBy !== "by-mastery";
  const rowVirtualizer = useVirtualizer({
    count: sortedVocabulary.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback(() => 120, []), // Estimated row height in px
    overscan: 5,
    enabled: shouldUseVirtualScrolling,
  });

  // Track search with debounce
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const timeout = setTimeout(() => {
      trackEvent(events.VOCABULARY_SEARCHED, {
        search_term: searchTerm,
        result_count: sortedVocabulary.length,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookmarkCheck className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sign in to view your vocabulary</h2>
          <p className="text-foreground-muted">Your saved words will appear here once you sign in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div>
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
                  {vocabulary?.length || 0} words in your collection
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Generate All Flashcards button removed to prevent accidental mass AI requests */}
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Word
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search vocabulary..."
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
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Language Filter - disabled when deck is selected */}
            <Select
              value={languageFilter ?? "all"}
              onValueChange={(value) => setLanguageFilter(value === "all" ? null : value as Language)}
              disabled={!!selectedDeckId}
            >
              <SelectTrigger className={`gap-2 ${selectedDeckId ? "opacity-60" : ""}`}>
                <Filter className={`w-4 h-4 ${languageFilter && !selectedDeckId ? "text-accent" : "text-foreground-muted"}`} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
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
                <BookmarkCheck className={`w-4 h-4 ${masteryFilter ? "text-accent" : "text-foreground-muted"}`} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mastery</SelectItem>
                {MASTERY_ORDER.map((mastery) => (
                  <SelectItem key={mastery} value={mastery}>
                    {MASTERY_LABELS[mastery].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Browse Decks
            </Button>
          </div>

          {/* Active filters summary - only for language/mastery, not deck */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-foreground-muted">Filters:</span>
              {languageFilter && (
                <button
                  onClick={() => setLanguageFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  {LANGUAGES.find((l) => l.value === languageFilter)?.label}
                  <span className="ml-1">×</span>
                </button>
              )}
              {masteryFilter && (
                <button
                  onClick={() => setMasteryFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  {MASTERY_LABELS[masteryFilter]?.label}
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
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
        <div className="flex gap-6">
          {/* Deck Panel - sticky, positioned below the search bar */}
          <div className="hidden lg:block sticky top-40 self-start">
            <DeckPanel
              userId={userId}
              onBrowseDecks={() => setShowDeckPicker(true)}
              selectedDeckId={selectedDeckId}
              onSelectDeck={setSelectedDeckId}
            />
          </div>

          {/* Vocabulary content */}
          <div className="flex-1 min-w-0">
            {/* Results count - fade in to avoid flicker */}
            <div className="mb-4 h-5">
              <p className={`text-sm text-foreground-muted transition-opacity duration-200 ${vocabulary === undefined ? "opacity-0" : "opacity-100"}`}>
                <span className="font-medium text-foreground">{sortedVocabulary.length}</span>
                {" "}{sortedVocabulary.length === 1 ? "word" : "words"}
                {vocabulary && sortedVocabulary.length !== vocabulary.length && ` (of ${vocabulary.length} total)`}
              </p>
            </div>

            {/* Vocabulary List */}
            <div className="pb-12">
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
              {searchTerm || hasAnyFilter ? "No matching words found" : "No vocabulary saved yet"}
            </p>
            <p className="text-sm text-center max-w-sm mb-4">
              {searchTerm || hasAnyFilter
                ? "Try adjusting your search or filters"
                : "Add words manually or save them while reading"}
            </p>
            {!searchTerm && !hasAnyFilter && (
              <Button onClick={() => setShowAddModal(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Word
              </Button>
            )}
          </div>
        ) : groupedByMastery ? (
          // Grouped by mastery view
          <div className="space-y-8">
            {groupedByMastery.map(({ mastery, items }) => (
              <section key={mastery}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${MASTERY_LABELS[mastery].color}`}>
                    {MASTERY_LABELS[mastery].label}
                  </span>
                  <span className="text-sm text-foreground-muted">
                    {items.length} {items.length === 1 ? "word" : "words"}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <VocabularyCard
                      key={item._id}
                      item={item}
                      onRemove={handleRemove}
                      showMastery={false}
                      delay={Math.min(index * 30, 150)}
                      onShowPaywall={() => setShowPaywall(true)}
                      isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
                      isAdmin={isAdmin}
                      onClick={() => setSelectedVocab(item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : shouldUseVirtualScrolling ? (
          // Virtual scrolling for large lists
          <div
            ref={scrollContainerRef}
            className="h-[calc(100vh-320px)] overflow-auto"
          >
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
                    <div className="pb-3">
                      <VocabularyCard
                        item={item}
                        onRemove={handleRemove}
                        showMastery={true}
                        delay={0}
                        onShowPaywall={() => setShowPaywall(true)}
                        isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
                        isAdmin={isAdmin}
                        onClick={() => setSelectedVocab(item)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Regular flat list for smaller lists
          <div className="space-y-3">
            {sortedVocabulary.map((item, index) => (
              <VocabularyCard
                key={item._id}
                item={item}
                onRemove={handleRemove}
                showMastery={true}
                delay={Math.min(index * 30, 150)}
                onShowPaywall={() => setShowPaywall(true)}
                isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
                isAdmin={isAdmin}
                onClick={() => setSelectedVocab(item)}
              />
            ))}
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
          isPremiumUser={subscription === undefined ? undefined : !!isPremiumUser}
        />
      )}

      {/* Paywall Modal */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="flashcards"
      />

      {/* Vocabulary Detail Modal */}
      {selectedVocab && (
        <VocabularyDetailModal
          item={selectedVocab}
          onClose={() => setSelectedVocab(null)}
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
  item: VocabularyItem;
  onRemove: (id: string) => void;
  showMastery?: boolean;
  delay?: number;
  onShowPaywall?: () => void;
  isPremiumUser?: boolean;
  isAdmin?: boolean;
  onClick?: () => void;
}

function VocabularyCard({ item, onRemove, showMastery = true, delay = 0, onShowPaywall, isPremiumUser, isAdmin, onClick }: VocabularyCardProps) {
  const languageFont = item.language === "japanese" ? "var(--font-japanese)" : "inherit";

  // Check if flashcard already exists (with automatic asset preloading)
  const existingFlashcard = useFlashcard(item._id);

  const generateFlashcardWithAudio = useAction(api.ai.generateFlashcardWithAudio);
  const updateVocabulary = useMutation(api.vocabulary.update);

  // Query states: undefined = loading
  const isLoadingFlashcard = existingFlashcard === undefined;
  const hasFlashcard = existingFlashcard !== undefined && existingFlashcard !== null;

  const handleGenerateFlashcard = async () => {
    if (isAdmin) {
      // Admin can generate directly - set pending state first
      try {
        await updateVocabulary({
          id: item._id as any,
          flashcardPending: true,
        });
        // Fire and forget - the action will clear flashcardPending when done
        generateFlashcardWithAudio({
          vocabularyId: item._id as any,
          includeAudio: true,
          includeImage: true,
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

  return (
    <div
      className="p-5 rounded-xl bg-surface border border-border hover:border-foreground-muted/30 transition-all duration-200 animate-fade-in-up cursor-pointer"
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
            {/* Word audio button - show skeleton while pending, button when ready */}
            {item.flashcardPending && !existingFlashcard?.wordAudioUrl ? (
              <Skeleton className="w-7 h-7 rounded-lg" />
            ) : !isLoadingFlashcard && existingFlashcard?.wordAudioUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); new Audio(existingFlashcard.wordAudioUrl!).play(); }}
                className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
                title="Play word pronunciation"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {item.reading && (
            <div className="text-sm text-foreground-muted mb-2">
              {item.reading}
            </div>
          )}
          <div className="text-foreground">
            {item.definitions.join("; ")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {showMastery && item.masteryState !== "new" && (
            <span className={`text-xs px-2 py-1 rounded-full ${MASTERY_LABELS[item.masteryState]?.color ?? "bg-muted text-foreground-muted"}`}>
              {MASTERY_LABELS[item.masteryState]?.label ?? item.masteryState}
            </span>
          )}
          {/* Generate flashcard button - show for admin or non-premium users if no flashcard exists */}
          {!isLoadingFlashcard && !hasFlashcard && !item.flashcardPending && (isAdmin || isPremiumUser === false) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateFlashcard}
              className="text-foreground-muted hover:text-accent hover:bg-accent/10"
              title="Generate AI flashcard"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
          {/* Show generating indicator when flashcard is pending */}
          {item.flashcardPending && (
            <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating content...
            </span>
          )}
          {/* Study button - navigate to practice with this word */}
          <Link
            to="/practice"
            search={{ vocabularyId: item._id }}
            className="p-2 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Practice writing sentences"
          >
            <Book className="w-4 h-4" />
          </Link>
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
      {/* Example sentence - show source context, generated sentence, or skeleton while generating */}
      {(item.sourceContext || existingFlashcard?.sentence || item.flashcardPending) && (
        <div className="mt-3">
          {item.sourceContext ? (
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
              <p
                className="text-sm text-foreground"
                style={{ fontFamily: languageFont }}
              >
                {item.sourceContext}
              </p>
              <p className="text-xs text-foreground-muted mt-1">Original context</p>
            </div>
          ) : item.flashcardPending && !existingFlashcard?.sentence ? (
            <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
              </div>
              <p className="text-xs text-foreground-muted mt-2">Generating sentence, audio & image...</p>
            </div>
          ) : existingFlashcard?.sentence && (
            <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-sm text-foreground flex-1"
                  style={{ fontFamily: languageFont }}
                >
                  {existingFlashcard.sentence}
                </p>
                {existingFlashcard.audioUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); new Audio(existingFlashcard.audioUrl!).play(); }}
                    className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                    title="Play audio"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground-muted mt-1">Example sentence</p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted capitalize">
          {item.language}
        </span>
        {item.examLevel && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {item.examLevel}
          </span>
        )}
        {item.sourceStoryTitle && (
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
  item: VocabularyItem;
  onClose: () => void;
}

function VocabularyDetailModal({ item, onClose }: VocabularyDetailModalProps) {
  const languageFont = item.language === "japanese" ? "var(--font-japanese)" : "inherit";
  const isJapanese = item.language === "japanese";

  // Fetch the flashcard data with automatic preloading
  const flashcard = useFlashcard(item._id);

  const playAudio = (url: string) => {
    new Audio(url).play();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end p-4 pb-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-2">
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
                  Play Word
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
              {/* Sentence Translation */}
              {flashcard?.sentenceTranslation && (
                <p className="text-sm text-foreground-muted text-center mt-2 italic">
                  {flashcard.sentenceTranslation}
                </p>
              )}
              {/* Sentence Audio Button */}
              {flashcard?.audioUrl && (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => playAudio(flashcard.audioUrl!)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    Play Sentence
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reading (for Japanese) */}
          {isJapanese && item.reading && (
            <div className="text-center mb-4">
              <div className="text-sm text-foreground-muted mb-1">Reading</div>
              <div className="text-2xl text-foreground" style={{ fontFamily: languageFont }}>
                {item.reading}
              </div>
            </div>
          )}

          {/* Definition */}
          <div className="text-center mb-4">
            <div className="text-sm text-foreground-muted mb-1">Definition</div>
            <div className="text-xl font-medium text-foreground">
              {item.definitions.join("; ")}
            </div>
          </div>

          {/* Metadata tags */}
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full ${MASTERY_LABELS[item.masteryState]?.color ?? "bg-muted text-foreground-muted"}`}>
              {MASTERY_LABELS[item.masteryState]?.label ?? item.masteryState}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground-muted capitalize">
              {item.language}
            </span>
            {item.examLevel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                {item.examLevel}
              </span>
            )}
            {item.sourceStoryTitle && (
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
}

function AddWordModal({ userId, onClose, isPremiumUser }: AddWordModalProps) {
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [definitions, setDefinitions] = useState("");
  const [language, setLanguage] = useState<Language>("japanese");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<DictionaryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { trackEvent, events } = useAnalytics();
  const addWord = useMutation(api.vocabulary.add);
  const generateFlashcardWithAudio = useAction(api.ai.generateFlashcardWithAudio);
  const getOrCreatePersonalDeck = useMutation(api.premadeDecks.getOrCreatePersonalDeck);

  // Preload dictionary when modal opens
  useEffect(() => {
    preloadDictionary(language);
  }, [language]);

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
        const results = await searchClientDictionary(trimmed, language, 8);
        setSuggestions(results);
      } catch (err) {
        console.error("Search error:", err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [word, language]);

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
        definitions: definitions.split(/[,;]/).map((d) => d.trim()).filter(Boolean),
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
          includeImage: true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Add New Word
          </h2>
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
              Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border border-border bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            </div>
          </div>

          {/* Word with Autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Word <span className="text-destructive">*</span>
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
                placeholder={language === "japanese" ? "食べる, taberu..." : "Type to search..."}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                required
              />
            </div>
            {/* Suggestions dropdown */}
            {showSuggestions && word.trim().length > 0 && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
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
                        style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                      >
                        {entry.word}
                      </span>
                      {entry.reading && entry.reading !== entry.word && (
                        <span
                          className="text-sm text-foreground-muted"
                          style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
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
            {showSuggestions && word.trim().length > 0 && suggestions.length === 0 && !isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-4 text-sm text-foreground-muted">
                No results found
              </div>
            )}
          </div>

          {/* Reading (for Japanese) */}
          {language === "japanese" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Reading (Hiragana)
              </label>
              <input
                type="text"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                placeholder="たべる"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                style={{ fontFamily: "var(--font-japanese)" }}
              />
            </div>
          )}

          {/* Definitions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Definition(s) <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={definitions}
              onChange={(e) => setDefinitions(e.target.value)}
              placeholder="to eat, to consume"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              required
            />
            <p className="text-xs text-foreground-muted mt-1">
              Separate multiple definitions with commas
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !word.trim() || !definitions.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Word"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

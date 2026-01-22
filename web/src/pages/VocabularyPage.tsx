import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useQuery as useTanstackQuery, keepPreviousData } from "@tanstack/react-query";
import type { GenericId } from "convex/values";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Paywall } from "@/components/Paywall";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Trash2, BookOpen, BookmarkCheck, ChevronDown, ArrowUpDown, Filter, Plus, X, Loader2, Sparkles, Check, ChevronsUpDown, Volume2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { searchDictionary, type DictionaryEntry } from "@/api/dictionary";
import { cn } from "@/lib/utils";

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

export function VocabularyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [languageFilter, setLanguageFilter] = useState<Language | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? "anonymous";

  const vocabulary = useQuery(
    api.vocabulary.list,
    isAuthenticated ? { userId, language: languageFilter ?? undefined } : "skip"
  );
  const removeWord = useMutation(api.vocabulary.remove);
  const generateFlashcardsBulk = useAction(api.ai.generateFlashcardsBulk);

  // Subscription check
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

  // Handle bulk flashcard generation
  const handleGenerateAll = async () => {
    if (!vocabulary || vocabulary.length === 0) return;

    if (!isPremiumUser) {
      setShowPaywall(true);
      return;
    }

    setIsGeneratingAll(true);
    setBulkResult(null);

    try {
      const result = await generateFlashcardsBulk({
        vocabularyIds: vocabulary.map((v) => v._id as GenericId<"vocabulary">),
      });
      setBulkResult(result);
    } catch (error) {
      console.error("Failed to generate flashcards:", error);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Filter vocabulary
  const filteredVocabulary = useMemo(() => {
    if (!vocabulary) return [];

    return vocabulary.filter((item) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.word.toLowerCase().includes(term) ||
          (item.reading?.toLowerCase().includes(term) ?? false) ||
          item.definitions.some((def) => def.toLowerCase().includes(term));
        if (!matchesSearch) return false;
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

  const handleRemove = async (id: string) => {
    try {
      await removeWord({ id: id as GenericId<"vocabulary"> });
    } catch (err) {
      console.error("Failed to remove word:", err);
    }
  };

  const hasActiveFilters = languageFilter !== null || masteryFilter !== null;

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
                {vocabulary && vocabulary.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateAll}
                    disabled={isGeneratingAll}
                    className="gap-2"
                  >
                    {isGeneratingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate All Flashcards
                      </>
                    )}
                  </Button>
                )}
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Word
                </Button>
              </div>
            </div>
            {/* Bulk generation result */}
            {bulkResult && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                Generated {bulkResult.success} flashcards
                {bulkResult.failed > 0 && ` (${bulkResult.failed} failed)`}
              </div>
            )}
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

            {/* Language Filter */}
            <div className="relative">
              <select
                value={languageFilter ?? ""}
                onChange={(e) => setLanguageFilter((e.target.value || null) as Language | null)}
                className={`appearance-none pl-9 pr-9 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all ${
                  languageFilter ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-foreground"
                }`}
              >
                <option value="">All Languages</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${languageFilter ? "text-accent" : "text-foreground-muted"}`} />
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${languageFilter ? "text-accent" : "text-foreground-muted"}`} />
            </div>

            {/* Mastery Filter */}
            <div className="relative">
              <select
                value={masteryFilter ?? ""}
                onChange={(e) => setMasteryFilter(e.target.value || null)}
                className={`appearance-none pl-9 pr-9 py-2.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer transition-all ${
                  masteryFilter ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-foreground"
                }`}
              >
                <option value="">All Mastery</option>
                {MASTERY_ORDER.map((mastery) => (
                  <option key={mastery} value={mastery}>
                    {MASTERY_LABELS[mastery].label}
                  </option>
                ))}
              </select>
              <BookmarkCheck className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${masteryFilter ? "text-accent" : "text-foreground-muted"}`} />
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${masteryFilter ? "text-accent" : "text-foreground-muted"}`} />
            </div>
          </div>

          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3">
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
            <p className="text-sm text-center max-w-sm mb-4">
              {searchTerm || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Add words manually or save them while reading"}
            </p>
            {!searchTerm && !hasActiveFilters && (
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
                      isPremiumUser={isPremiumUser}
                      onShowPaywall={() => setShowPaywall(true)}
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
                showMastery={true}
                delay={Math.min(index * 30, 150)}
                isPremiumUser={isPremiumUser}
                onShowPaywall={() => setShowPaywall(true)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Word Modal */}
      {showAddModal && (
        <AddWordModal
          userId={userId}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Paywall Modal */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="flashcards"
      />
    </div>
  );
}

// Vocabulary card component
interface VocabularyCardProps {
  item: {
    _id: string;
    word: string;
    reading?: string | null;
    definitions: string[];
    language: string;
    masteryState: string;
    examLevel?: string | null;
    sourceStoryTitle?: string | null;
    sourceContext?: string | null;
  };
  onRemove: (id: string) => void;
  showMastery?: boolean;
  delay?: number;
  isPremiumUser?: boolean;
  onShowPaywall?: () => void;
}

function VocabularyCard({ item, onRemove, showMastery = true, delay = 0, isPremiumUser = false, onShowPaywall }: VocabularyCardProps) {
  const languageFont = item.language === "japanese" ? "var(--font-japanese)" : "inherit";
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Check if flashcard already exists
  const existingFlashcard = useQuery(api.flashcards.getByVocabulary, {
    vocabularyId: item._id as GenericId<"vocabulary">,
  });

  const generateFlashcardWithAudio = useAction(api.ai.generateFlashcardWithAudio);
  const generateFlashcardAudio = useAction(api.ai.generateFlashcardAudio);

  const handleGenerateFlashcard = async () => {
    if (!isPremiumUser) {
      onShowPaywall?.();
      return;
    }

    setIsGenerating(true);
    try {
      await generateFlashcardWithAudio({
        vocabularyId: item._id as GenericId<"vocabulary">,
        includeAudio: true,
      });
      setGenerated(true);
    } catch (error) {
      console.error("Failed to generate flashcard:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!isPremiumUser) {
      onShowPaywall?.();
      return;
    }

    if (!existingFlashcard?._id) return;

    setIsGeneratingAudio(true);
    try {
      await generateFlashcardAudio({
        flashcardId: existingFlashcard._id,
      });
    } catch (error) {
      console.error("Failed to generate audio:", error);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const hasFlashcard = existingFlashcard !== undefined && existingFlashcard !== null;
  const hasAudio = hasFlashcard && !!existingFlashcard?.audioUrl;

  return (
    <div
      className="p-5 rounded-xl bg-surface border border-border hover:border-foreground-muted/30 transition-all duration-200 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span
            className="text-xl font-semibold text-foreground"
            style={{ fontFamily: languageFont }}
          >
            {item.word}
          </span>
          {item.reading && (
            <div className="text-sm text-foreground-muted mb-2">
              {item.reading}
            </div>
          )}
          <div className="text-foreground">
            {item.definitions.join("; ")}
          </div>
          {/* Example sentences */}
          {(item.sourceContext || existingFlashcard?.sentence) && (
            <div className="mt-3 space-y-2">
              {item.sourceContext && (
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                  <p
                    className="text-sm text-foreground"
                    style={{ fontFamily: languageFont }}
                  >
                    {item.sourceContext}
                  </p>
                  <p className="text-xs text-foreground-muted mt-1">Source context</p>
                </div>
              )}
              {existingFlashcard?.sentence && existingFlashcard.sentence !== item.sourceContext && (
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
                        onClick={() => new Audio(existingFlashcard.audioUrl!).play()}
                        className="p-1.5 rounded-lg text-foreground-muted hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                        title="Play audio"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {existingFlashcard.sentenceTranslation && (
                    <p className="text-xs text-foreground-muted mt-1">
                      {existingFlashcard.sentenceTranslation}
                    </p>
                  )}
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
        <div className="flex items-center gap-2 shrink-0">
          {showMastery && (
            <span className={`text-xs px-2 py-1 rounded-full ${MASTERY_LABELS[item.masteryState]?.color ?? "bg-muted text-foreground-muted"}`}>
              {MASTERY_LABELS[item.masteryState]?.label ?? item.masteryState}
            </span>
          )}
          {/* Flashcard generation button */}
          {hasFlashcard || generated ? (
            <>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Flashcard
              </span>
              {/* Audio generation button if flashcard exists but no audio */}
              {hasFlashcard && !hasAudio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="text-foreground-muted hover:text-accent hover:bg-accent/10"
                  title="Generate audio narration"
                >
                  {isGeneratingAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateFlashcard}
              disabled={isGenerating}
              className="text-foreground-muted hover:text-accent hover:bg-accent/10"
              title="Generate flashcard"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
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

// Add Word Modal
interface AddWordModalProps {
  userId: string;
  onClose: () => void;
}

function AddWordModal({ userId, onClose }: AddWordModalProps) {
  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [definitions, setDefinitions] = useState("");
  const [language, setLanguage] = useState<Language>("japanese");
  const [examLevel, setExamLevel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const addWord = useMutation(api.vocabulary.add);

  // Debounce the search input
  useEffect(() => {
    const trimmed = searchValue.trim();
    if (trimmed.length < 1) {
      setDebouncedSearch("");
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // TanStack Query handles race conditions automatically
  const { data: suggestions = [] } = useTanstackQuery({
    queryKey: ["dictionary-search", debouncedSearch, language],
    queryFn: () => searchDictionary(debouncedSearch, language, 8),
    enabled: debouncedSearch.length > 0,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });

  // Clear form when language changes
  useEffect(() => {
    setWord("");
    setSearchValue("");
    setDebouncedSearch("");
    setReading("");
    setDefinitions("");
  }, [language]);

  const handleSelectSuggestion = (entry: DictionaryEntry) => {
    setWord(entry.word);
    setSearchValue("");
    setDebouncedSearch("");
    setReading(entry.reading || "");
    setDefinitions(entry.meanings.join("; "));
    setComboboxOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !definitions.trim()) return;

    setIsSubmitting(true);
    try {
      await addWord({
        userId,
        language,
        word: word.trim(),
        reading: reading.trim() || undefined,
        definitions: definitions.split(/[,;]/).map((d) => d.trim()).filter(Boolean),
        sourceType: "manual",
        examLevel: examLevel.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to add word:", error);
    } finally {
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

          {/* Word with Autocomplete Combobox */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Word <span className="text-destructive">*</span>
            </label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-background text-left focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all",
                    !word && "text-foreground-muted"
                  )}
                  style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                >
                  {word || (language === "japanese" ? "Search for a word..." : "Search for a word...")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={language === "japanese" ? "食べる, taberu..." : "Type to search..."}
                      className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                    />
                  </div>
                  <CommandList>
                    {searchValue.trim().length > 0 && debouncedSearch.length > 0 && suggestions.length === 0 && (
                      <CommandEmpty>No results found.</CommandEmpty>
                    )}
                    {searchValue.trim().length > 0 && suggestions.length > 0 && (
                      <CommandGroup>
                        {suggestions.map((entry, index) => (
                          <CommandItem
                            key={`${entry.word}-${index}`}
                            value={entry.word}
                            onSelect={() => handleSelectSuggestion(entry)}
                            className="flex flex-col items-start gap-1 py-3"
                          >
                            <div className="flex items-baseline gap-2">
                              <span
                                className="font-medium"
                                style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                              >
                                {entry.word}
                              </span>
                              {entry.reading && entry.reading !== entry.word && (
                                <span
                                  className="text-sm text-muted-foreground"
                                  style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
                                >
                                  ({entry.reading})
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground line-clamp-1">
                              {entry.meanings[0]}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

          {/* Exam Level */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Exam Level (optional)
            </label>
            <input
              type="text"
              value={examLevel}
              onChange={(e) => setExamLevel(e.target.value)}
              placeholder={language === "japanese" ? "N5" : "B2"}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
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

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Layers,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  PenLine,
  Trash2,
} from "lucide-react";
import type { DeckSubscriptionStatus, Language } from "@/lib/convex-types";

interface DeckPanelProps {
  userId: string;
  onBrowseDecks: () => void;
  selectedDeckId: string | null;
  onSelectDeck: (deckId: string | null) => void;
}

// Type for subscription with joined deck data from the query
type SubscriptionWithDeck = {
  _id: string;
  deckId: string;
  totalWordsInDeck: number;
  wordsAdded: number;
  wordsStudied: number;
  dailyNewCards: number;
  lastDripDate?: string;
  cardsAddedToday: number;
  status: DeckSubscriptionStatus;
  deck: {
    name: string;
    description: string;
    language: Language;
    level: string;
    totalWords: number;
  } | null;
};

export function DeckPanel({
  userId,
  onBrowseDecks,
  selectedDeckId,
  onSelectDeck,
}: DeckPanelProps) {
  const subscriptions = useQuery(api.userDeckSubscriptions.listSubscriptions, {
    userId,
  }) as SubscriptionWithDeck[] | undefined;

  const personalDeck = useQuery(api.premadeDecks.getPersonalDeck, { userId });

  const setActiveDeck = useMutation(api.userDeckSubscriptions.setActiveDeck);
  const unsubscribe = useMutation(api.userDeckSubscriptions.unsubscribe);

  const activeSub = subscriptions?.find((s) => s.status === "active");
  const otherSubs = subscriptions?.filter((s) => s.status !== "active") ?? [];

  const handleSwitchDeck = async (deckId: string) => {
    try {
      await setActiveDeck({ userId, deckId });
    } catch (err) {
      console.error("Failed to switch deck:", err);
    }
  };

  const handleUnsubscribe = async (deckId: string) => {
    try {
      await unsubscribe({ userId, deckId });
      // If unsubscribing from selected deck, clear selection
      if (selectedDeckId === deckId) {
        onSelectDeck(null);
      }
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
    }
  };

  const isLoading = subscriptions === undefined;

  return (
    <div className="w-72 flex-shrink-0 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <span className="font-medium text-foreground text-sm">Decks</span>
        </div>
        <Button
          onClick={onBrowseDecks}
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-7"
        >
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* All Words button */}
          <button
            onClick={() => onSelectDeck(null)}
            className={`w-full p-3 rounded-lg text-left transition-colors border ${
              selectedDeckId === null
                ? "bg-accent/10 border-accent/30"
                : "bg-surface border-border hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className={`w-4 h-4 ${selectedDeckId === null ? "text-accent" : "text-foreground-muted"}`} />
              <span className={`text-sm font-medium ${selectedDeckId === null ? "text-accent" : "text-foreground"}`}>
                All Words
              </span>
            </div>
          </button>

          {/* Personal deck */}
          {personalDeck && personalDeck.totalWords > 0 && (
            <button
              onClick={() => onSelectDeck(personalDeck.deckId)}
              className={`w-full p-3 rounded-lg text-left transition-colors border ${
                selectedDeckId === personalDeck.deckId
                  ? "bg-accent/10 border-accent/30"
                  : "bg-surface border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenLine className={`w-4 h-4 ${selectedDeckId === personalDeck.deckId ? "text-accent" : "text-foreground-muted"}`} />
                  <span className={`text-sm font-medium ${selectedDeckId === personalDeck.deckId ? "text-accent" : "text-foreground"}`}>
                    My Words
                  </span>
                </div>
                <span className="text-xs text-foreground-muted">
                  {personalDeck.totalWords}
                </span>
              </div>
            </button>
          )}

          {/* Active Deck */}
          {activeSub && (
            <DeckCard
              subscription={activeSub}
              isSelected={selectedDeckId === activeSub.deckId}
              onSelect={() => onSelectDeck(activeSub.deckId === selectedDeckId ? null : activeSub.deckId)}
              onUnsubscribe={() => handleUnsubscribe(activeSub.deckId)}
              isActive
            />
          )}

          {/* Other Decks (collapsed) */}
          {otherSubs.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-foreground-muted px-1 py-1 flex items-center gap-1">
                <Pause className="w-3 h-3" />
                Other decks
              </div>
              {otherSubs.map((sub) => (
                <DeckCard
                  key={sub._id}
                  subscription={sub}
                  isSelected={selectedDeckId === sub.deckId}
                  onSelect={() => onSelectDeck(sub.deckId === selectedDeckId ? null : sub.deckId)}
                  onActivate={() => handleSwitchDeck(sub.deckId)}
                  onUnsubscribe={() => handleUnsubscribe(sub.deckId)}
                  compact
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {subscriptions?.length === 0 && !personalDeck?.totalWords && (
            <div className="text-center py-4 px-3 rounded-lg bg-surface border border-border">
              <p className="text-xs text-foreground-muted mb-2">
                No decks yet
              </p>
              <Button onClick={onBrowseDecks} size="sm" className="gap-1.5 text-xs h-7">
                <Plus className="w-3 h-3" />
                Browse Decks
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DeckCardProps {
  subscription: SubscriptionWithDeck;
  isSelected: boolean;
  onSelect: () => void;
  isActive?: boolean;
  onActivate?: () => void;
  onUnsubscribe?: () => void;
  compact?: boolean;
}

function DeckCard({ subscription, isSelected, onSelect, isActive, onActivate, onUnsubscribe, compact }: DeckCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const progress = subscription.totalWordsInDeck > 0
    ? (subscription.wordsAdded / subscription.totalWordsInDeck) * 100
    : 0;

  const isCompleted = subscription.status === "completed";

  if (compact) {
    return (
      <>
        <div
          className={`w-full p-2 rounded-lg text-left transition-colors border group ${
            isSelected
              ? "bg-accent/10 border-accent/30"
              : "bg-surface border-border hover:bg-muted"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button onClick={onSelect} className="flex items-center gap-2 min-w-0 flex-1">
              {isCompleted ? (
                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <Pause className="w-3 h-3 text-foreground-muted shrink-0" />
              )}
              <span className={`text-xs font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}>
                {subscription.deck?.name ?? subscription.deckId}
              </span>
            </button>
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground-muted shrink-0">
                {subscription.wordsAdded}/{subscription.totalWordsInDeck}
              </span>
              {onUnsubscribe && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirm(true);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                  title="Remove deck"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove deck?</DialogTitle>
              <DialogDescription>
                This will remove <strong>{subscription.deck?.name}</strong> from your decks.
                Words you've already learned will stay in your vocabulary.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onUnsubscribe();
                  setShowConfirm(false);
                }}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div
        className={`rounded-lg transition-all border group ${
          isSelected
            ? "bg-accent/10 border-accent/30"
            : isActive
            ? "bg-surface border-accent/20"
            : "bg-surface border-border hover:bg-muted"
        }`}
      >
        <button onClick={onSelect} className="w-full p-3 text-left">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {isActive && <Play className="w-3 h-3 text-accent shrink-0" />}
                <span className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}>
                  {subscription.deck?.name ?? subscription.deckId}
                </span>
                {isCompleted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
              </div>
              <span className="text-xs text-foreground-muted">
                {subscription.deck?.level}
              </span>
            </div>
            {onUnsubscribe && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(true);
                }}
                className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                title="Remove deck"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isCompleted ? "bg-green-500" : "bg-accent"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span>
              {subscription.wordsAdded}/{subscription.totalWordsInDeck} words
            </span>
            {isActive && subscription.cardsAddedToday > 0 && (
              <span className="text-accent">
                +{subscription.cardsAddedToday} today
              </span>
            )}
          </div>
        </button>

        {/* Activate button for paused decks */}
        {!isActive && !isCompleted && onActivate && (
          <div className="px-3 pb-3">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
            >
              <Play className="w-3 h-3 mr-1" />
              Make Active
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove deck?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{subscription.deck?.name}</strong> from your decks.
              Words you've already learned will stay in your vocabulary.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onUnsubscribe?.();
                setShowConfirm(false);
              }}
              className="flex-1"
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

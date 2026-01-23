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
  Minus,
  PenLine,
  Zap,
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
    <div className="w-72 flex-shrink-0 space-y-4">
      {/* View Filter Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-foreground-muted" />
          <span className="font-medium text-foreground text-sm">View</span>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : (
          <div className="space-y-1">
            {/* All Words button */}
            <button
              onClick={() => onSelectDeck(null)}
              className={`w-full p-2.5 rounded-lg text-left transition-colors border ${
                selectedDeckId === null
                  ? "bg-accent/10 border-accent/30"
                  : "bg-surface border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${selectedDeckId === null ? "text-accent" : "text-foreground-muted"}`} />
                <span className={`text-sm font-medium ${selectedDeckId === null ? "text-accent" : "text-foreground"}`}>
                  All Words
                </span>
              </div>
            </button>

            {/* Personal deck */}
            {personalDeck && personalDeck.totalWords > 0 && (
              <button
                onClick={() => onSelectDeck(personalDeck.deckId)}
                className={`w-full p-2.5 rounded-lg text-left transition-colors border ${
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
          </div>
        )}
      </div>

      {/* Active Deck Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-foreground text-sm">Active Deck</span>
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
        <p className="text-xs text-foreground-muted mb-2">
          New cards added daily from this deck
        </p>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : activeSub ? (
          <DeckCard
            subscription={activeSub}
            isSelected={selectedDeckId === activeSub.deckId}
            onSelect={() => onSelectDeck(activeSub.deckId === selectedDeckId ? null : activeSub.deckId)}
            onUnsubscribe={() => handleUnsubscribe(activeSub.deckId)}
            isActive
            userId={userId}
          />
        ) : (
          <div className="text-center py-4 px-3 rounded-lg bg-surface border border-dashed border-border">
            <p className="text-xs text-foreground-muted mb-2">
              No active deck
            </p>
            <Button onClick={onBrowseDecks} size="sm" className="gap-1.5 text-xs h-7">
              <Plus className="w-3 h-3" />
              Choose a Deck
            </Button>
          </div>
        )}

        {/* Other subscribed decks that can be made active */}
        {otherSubs.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-foreground-muted px-1 py-1 flex items-center gap-1">
              <Pause className="w-3 h-3" />
              Paused
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
        {subscriptions?.length === 0 && (
          <Button onClick={onBrowseDecks} variant="outline" size="sm" className="w-full gap-1.5 text-xs mt-2">
            <Plus className="w-3 h-3" />
            Browse Decks
          </Button>
        )}
      </div>
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
  userId?: string;
}

function DeckCard({ subscription, isSelected, onSelect, isActive, onActivate, onUnsubscribe, compact, userId }: DeckCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [localDailyCards, setLocalDailyCards] = useState(subscription.dailyNewCards);
  const updateDailyLimit = useMutation(api.userDeckSubscriptions.updateDailyLimit);

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
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Deck icon */}
              <div className="w-3.5 h-3.5 shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
                ) : (
                  <Layers className={`w-3.5 h-3.5 ${isSelected ? "text-accent" : "text-foreground-muted"}`} />
                )}
              </div>
              <button
                onClick={onSelect}
                className={`text-xs font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}
              >
                {subscription.deck?.name ?? subscription.deckId}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground-muted">
                {subscription.wordsAdded}/{subscription.totalWordsInDeck}
              </span>
              {!isCompleted && onActivate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onActivate();
                  }}
                  className="p-1 rounded text-orange-500 hover:bg-orange-500/10 transition-colors"
                  title="Make this the active deck"
                >
                  <Play className="w-3.5 h-3.5" />
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
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        className={`w-full rounded-lg transition-all border group text-left cursor-pointer ${
          isSelected
            ? "bg-accent/10 border-accent/30"
            : "bg-surface border-border hover:bg-muted"
        }`}
      >
        <div className="w-full p-3">
          <div className="flex items-start gap-2 mb-2">
            {/* Deck icon */}
            <div className="w-4 h-4 shrink-0 mt-0.5">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-orange-500" />
              ) : (
                <Layers className={`w-4 h-4 ${isSelected ? "text-accent" : "text-orange-500"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}>
                  {subscription.deck?.name ?? subscription.deckId}
                </span>
              </div>
              <span className="text-xs text-foreground-muted">
                {subscription.deck?.level}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-orange-500"
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
              <span className="text-orange-500">
                +{subscription.cardsAddedToday} today
              </span>
            )}
          </div>

          {/* Daily rate controls */}
          {isActive && !isCompleted && userId && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground-muted">New cards/day</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newValue = Math.max(5, localDailyCards - 5);
                      setLocalDailyCards(newValue);
                      updateDailyLimit({ userId, deckId: subscription.deckId, dailyNewCards: newValue });
                    }}
                    disabled={localDailyCards <= 5}
                    className="p-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-foreground">
                    {localDailyCards}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newValue = Math.min(30, localDailyCards + 5);
                      setLocalDailyCards(newValue);
                      updateDailyLimit({ userId, deckId: subscription.deckId, dailyNewCards: newValue });
                    }}
                    disabled={localDailyCards >= 30}
                    className="p-1 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
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

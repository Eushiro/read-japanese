import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Layers, Minus, Pause, PenLine, Play, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentLanguage, DeckSubscriptionStatus } from "@/lib/convex-types";
import { useT } from "@/lib/i18n";

import { api } from "../../../convex/_generated/api";

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
    language: ContentLanguage;
    level: string;
    totalWords: number;
  } | null;
};

export function DeckPanel({ userId, onBrowseDecks, selectedDeckId, onSelectDeck }: DeckPanelProps) {
  const t = useT();
  const subscriptions = useQuery(api.userDeckSubscriptions.listSubscriptions, {
    userId,
  }) as SubscriptionWithDeck[] | undefined;

  const personalDeck = useQuery(api.premadeDecks.getPersonalDeck, { userId });

  const setActiveDeck = useMutation(api.userDeckSubscriptions.setActiveDeck);
  const unsubscribe = useMutation(api.userDeckSubscriptions.unsubscribe);

  // Shared confirmation dialog state
  const [confirmDeckId, setConfirmDeckId] = useState<string | null>(null);
  const confirmDeck = subscriptions?.find((s) => s.deckId === confirmDeckId);

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
      setConfirmDeckId(null);
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
    }
  };

  const isLoading = subscriptions === undefined;

  // Determine view filter value based on selection
  const getViewValue = () => {
    if (selectedDeckId === null) return "all";
    if (selectedDeckId === personalDeck?.deckId) return "my";
    return "all"; // If a subscribed deck is selected, keep "all" tab highlighted
  };

  return (
    <div className="w-72 flex-shrink-0 space-y-4">
      {/* View Filter Section - Using Tabs */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-foreground text-sm">
            {t("vocabulary.deckPanel.view")}
          </span>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : (
          <Tabs value={getViewValue()} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger
                value="all"
                onClick={() => onSelectDeck(null)}
                className="flex-1 gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                {t("vocabulary.deckPanel.allWords")}
              </TabsTrigger>
              {personalDeck && personalDeck.totalWords > 0 && (
                <TabsTrigger
                  value="my"
                  onClick={() => onSelectDeck(personalDeck.deckId)}
                  className="flex-1 gap-1.5"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {t("vocabulary.deckPanel.myWords")}
                  <span className="text-xs text-foreground-muted">({personalDeck.totalWords})</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Active Deck Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-foreground text-sm">
              {t("vocabulary.deckPanel.activeDeck")}
            </span>
          </div>
          <Button onClick={onBrowseDecks} variant="ghost" size="sm" className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" />
            {t("vocabulary.deckPanel.add")}
          </Button>
        </div>
        <p className="text-xs text-foreground-muted mb-2">
          {t("vocabulary.deckPanel.dailyCardsInfo")}
        </p>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : activeSub ? (
          <ActiveDeckCard
            subscription={activeSub}
            isSelected={selectedDeckId === activeSub.deckId}
            onSelect={() =>
              onSelectDeck(activeSub.deckId === selectedDeckId ? null : activeSub.deckId)
            }
            onUnsubscribe={() => setConfirmDeckId(activeSub.deckId)}
            userId={userId}
          />
        ) : (
          <div className="text-center py-4 px-3 rounded-lg bg-surface border border-dashed border-border">
            <p className="text-xs text-foreground-muted mb-2">
              {t("vocabulary.deckPanel.noActiveDeck")}
            </p>
            <Button onClick={onBrowseDecks} size="sm" className="gap-1.5 text-xs h-7">
              <Plus className="w-3 h-3" />
              {t("vocabulary.deckPanel.chooseADeck")}
            </Button>
          </div>
        )}

        {/* Other subscribed decks that can be made active */}
        {otherSubs.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-foreground-muted px-1 py-1 flex items-center gap-1">
              <Pause className="w-3 h-3" />
              {t("vocabulary.deckPanel.paused")}
            </div>
            {otherSubs.map((sub) => (
              <PausedDeckItem
                key={sub._id}
                subscription={sub}
                isSelected={selectedDeckId === sub.deckId}
                onSelect={() => onSelectDeck(sub.deckId === selectedDeckId ? null : sub.deckId)}
                onActivate={() => handleSwitchDeck(sub.deckId)}
                onUnsubscribe={() => setConfirmDeckId(sub.deckId)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {subscriptions?.length === 0 && (
          <Button
            onClick={onBrowseDecks}
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs mt-2"
          >
            <Plus className="w-3 h-3" />
            {t("vocabulary.browseDecks")}
          </Button>
        )}
      </div>

      {/* Shared Confirmation Dialog */}
      <Dialog open={!!confirmDeckId} onOpenChange={(open) => !open && setConfirmDeckId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("vocabulary.deckPanel.removeDeckTitle")}</DialogTitle>
            <DialogDescription>
              <span
                dangerouslySetInnerHTML={{
                  __html: t("vocabulary.deckPanel.removeDeckDescription", {
                    deckName: confirmDeck?.deck?.name ?? "",
                  }),
                }}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmDeckId(null)} className="flex-1">
              {t("vocabulary.deckPanel.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeckId && handleUnsubscribe(confirmDeckId)}
              className="flex-1"
            >
              {t("vocabulary.deckPanel.remove")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Daily Cards Stepper Component
interface DailyCardsStepperProps {
  value: number;
  onChange: (value: number) => void;
}

function DailyCardsStepper({ value, onChange }: DailyCardsStepperProps) {
  const t = useT();

  const decrement = () => {
    if (value > 1) {
      onChange(value - 1);
    }
  };

  const increment = () => {
    if (value < 50) {
      onChange(value + 1);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-foreground-muted">
        {t("vocabulary.deckPanel.newCardsPerDay")}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            decrement();
          }}
          disabled={value <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-foreground">{value}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            increment();
          }}
          disabled={value >= 50}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Active Deck Card - Full card with progress, stats, daily cards control
interface ActiveDeckCardProps {
  subscription: SubscriptionWithDeck;
  isSelected: boolean;
  onSelect: () => void;
  onUnsubscribe: () => void;
  userId: string;
}

function ActiveDeckCard({
  subscription,
  isSelected,
  onSelect,
  onUnsubscribe,
  userId,
}: ActiveDeckCardProps) {
  const t = useT();
  const [localDailyCards, setLocalDailyCards] = useState(subscription.dailyNewCards);
  const updateDailyLimit = useMutation(api.userDeckSubscriptions.updateDailyLimit);

  const progress =
    subscription.totalWordsInDeck > 0
      ? (subscription.wordsAdded / subscription.totalWordsInDeck) * 100
      : 0;

  const isCompleted = subscription.status === "completed";

  const handleDailyCardsChange = (newValue: number) => {
    setLocalDailyCards(newValue);
    updateDailyLimit({
      userId,
      deckId: subscription.deckId,
      dailyNewCards: newValue,
    });
  };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full rounded-lg transition-all border group text-left cursor-pointer ${
        isSelected ? "bg-accent/10 border-accent/30" : "bg-surface border-border hover:bg-muted"
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
              <span
                className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}
              >
                {subscription.deck?.name ?? subscription.deckId}
              </span>
            </div>
            <span className="text-xs text-foreground-muted">{subscription.deck?.level}</span>
          </div>
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnsubscribe();
            }}
            className="p-1 rounded text-foreground-muted opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
            title={t("vocabulary.deckPanel.removeDeck")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
            {t("vocabulary.deckPanel.wordsProgress", {
              added: subscription.wordsAdded,
              total: subscription.totalWordsInDeck,
            })}
          </span>
          {subscription.cardsAddedToday > 0 && (
            <span className="text-orange-500">
              {t("vocabulary.deckPanel.today", { count: subscription.cardsAddedToday })}
            </span>
          )}
        </div>

        {/* Daily rate controls with stepper */}
        {!isCompleted && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <DailyCardsStepper value={localDailyCards} onChange={handleDailyCardsChange} />
          </div>
        )}
      </div>
    </div>
  );
}

// Paused Deck Item - Compact row with name, mini progress, activate button
interface PausedDeckItemProps {
  subscription: SubscriptionWithDeck;
  isSelected: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onUnsubscribe: () => void;
}

function PausedDeckItem({
  subscription,
  isSelected,
  onSelect,
  onActivate,
  onUnsubscribe,
}: PausedDeckItemProps) {
  const t = useT();

  const progress =
    subscription.totalWordsInDeck > 0
      ? (subscription.wordsAdded / subscription.totalWordsInDeck) * 100
      : 0;

  const isCompleted = subscription.status === "completed";

  return (
    <div
      className={`w-full p-2 rounded-lg text-left transition-colors border group ${
        isSelected ? "bg-accent/10 border-accent/30" : "bg-surface border-border hover:bg-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Deck icon */}
          <div className="w-3.5 h-3.5 shrink-0">
            {isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <Layers
                className={`w-3.5 h-3.5 ${isSelected ? "text-accent" : "text-foreground-muted"}`}
              />
            )}
          </div>
          <button
            onClick={onSelect}
            className={`text-xs font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}
          >
            {subscription.deck?.name ?? subscription.deckId}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Mini progress bar */}
          <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-orange-500/60"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-foreground-muted whitespace-nowrap">
            {subscription.wordsAdded}/{subscription.totalWordsInDeck}
          </span>
          {!isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              className="p-1 rounded text-orange-500 hover:bg-orange-500/10 transition-colors"
              title={t("vocabulary.deckPanel.makeActive")}
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnsubscribe();
            }}
            className="p-1 rounded text-foreground-muted opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
            title={t("vocabulary.deckPanel.removeDeck")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

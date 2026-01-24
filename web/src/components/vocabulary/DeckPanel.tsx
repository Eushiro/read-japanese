import { useMutation,useQuery } from "convex/react";
import { BookOpen, CheckCircle2, Layers, Pause, PenLine, Play, Plus, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { DeckSubscriptionStatus, Language } from "@/lib/convex-types";
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
    language: Language;
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
          <span className="font-medium text-foreground text-sm">{t("vocabulary.deckPanel.view")}</span>
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
                <Layers
                  className={`w-4 h-4 ${selectedDeckId === null ? "text-accent" : "text-foreground-muted"}`}
                />
                <span
                  className={`text-sm font-medium ${selectedDeckId === null ? "text-accent" : "text-foreground"}`}
                >
                  {t("vocabulary.deckPanel.allWords")}
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
                    <PenLine
                      className={`w-4 h-4 ${selectedDeckId === personalDeck.deckId ? "text-accent" : "text-foreground-muted"}`}
                    />
                    <span
                      className={`text-sm font-medium ${selectedDeckId === personalDeck.deckId ? "text-accent" : "text-foreground"}`}
                    >
                      {t("vocabulary.deckPanel.myWords")}
                    </span>
                  </div>
                  <span className="text-xs text-foreground-muted">{personalDeck.totalWords}</span>
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
            <span className="font-medium text-foreground text-sm">{t("vocabulary.deckPanel.activeDeck")}</span>
          </div>
          <Button onClick={onBrowseDecks} variant="ghost" size="sm" className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" />
            {t("vocabulary.deckPanel.add")}
          </Button>
        </div>
        <p className="text-xs text-foreground-muted mb-2">{t("vocabulary.deckPanel.dailyCardsInfo")}</p>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : activeSub ? (
          <DeckCard
            subscription={activeSub}
            isSelected={selectedDeckId === activeSub.deckId}
            onSelect={() =>
              onSelectDeck(activeSub.deckId === selectedDeckId ? null : activeSub.deckId)
            }
            onUnsubscribe={() => handleUnsubscribe(activeSub.deckId)}
            isActive
            userId={userId}
          />
        ) : (
          <div className="text-center py-4 px-3 rounded-lg bg-surface border border-dashed border-border">
            <p className="text-xs text-foreground-muted mb-2">{t("vocabulary.deckPanel.noActiveDeck")}</p>
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

function DeckCard({
  subscription,
  isSelected,
  onSelect,
  isActive,
  onActivate,
  onUnsubscribe,
  compact,
  userId,
}: DeckCardProps) {
  const t = useT();
  const [showConfirm, setShowConfirm] = useState(false);
  const [localDailyCards, setLocalDailyCards] = useState(subscription.dailyNewCards);
  const updateDailyLimit = useMutation(api.userDeckSubscriptions.updateDailyLimit);

  const progress =
    subscription.totalWordsInDeck > 0
      ? (subscription.wordsAdded / subscription.totalWordsInDeck) * 100
      : 0;

  const isCompleted = subscription.status === "completed";

  if (compact) {
    return (
      <>
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
                  title={t("vocabulary.deckPanel.makeActive")}
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
              <DialogTitle>{t("vocabulary.deckPanel.removeDeckTitle")}</DialogTitle>
              <DialogDescription>
                <span dangerouslySetInnerHTML={{
                  __html: t("vocabulary.deckPanel.removeDeckDescription", { deckName: subscription.deck?.name ?? "" })
                }} />
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
                {t("vocabulary.deckPanel.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onUnsubscribe();
                  setShowConfirm(false);
                }}
                className="flex-1"
              >
                {t("vocabulary.deckPanel.remove")}
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
              {t("vocabulary.deckPanel.wordsProgress", { added: subscription.wordsAdded, total: subscription.totalWordsInDeck })}
            </span>
            {isActive && subscription.cardsAddedToday > 0 && (
              <span className="text-orange-500">{t("vocabulary.deckPanel.today", { count: subscription.cardsAddedToday })}</span>
            )}
          </div>

          {/* Daily rate controls */}
          {isActive && !isCompleted && userId && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground-muted">{t("vocabulary.deckPanel.newCardsPerDay")}</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={localDailyCards}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const newValue = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                    setLocalDailyCards(newValue);
                    updateDailyLimit({
                      userId,
                      deckId: subscription.deckId,
                      dailyNewCards: newValue,
                    });
                  }}
                  className="w-16 h-7 text-center text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("vocabulary.deckPanel.removeDeckTitle")}</DialogTitle>
            <DialogDescription>
              <span dangerouslySetInnerHTML={{
                __html: t("vocabulary.deckPanel.removeDeckDescription", { deckName: subscription.deck?.name ?? "" })
              }} />
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
              {t("vocabulary.deckPanel.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onUnsubscribe?.();
                setShowConfirm(false);
              }}
              className="flex-1"
            >
              {t("vocabulary.deckPanel.remove")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

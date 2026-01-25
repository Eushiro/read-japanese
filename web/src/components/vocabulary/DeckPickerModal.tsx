import { useMutation, useQuery } from "convex/react";
import { BookOpen, Check, Loader2, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { getLevelVariant } from "@/lib/levels";

import { api } from "../../../convex/_generated/api";

interface DeckPickerModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultLanguage?: ContentLanguage;
}

const ALL_LANGUAGES = [
  { value: "japanese" as const, label: "Japanese" },
  { value: "english" as const, label: "English" },
  { value: "french" as const, label: "French" },
];

export function DeckPickerModal({
  userId,
  isOpen,
  onClose,
  defaultLanguage = "japanese",
}: DeckPickerModalProps) {
  const t = useT();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [dailyCards, setDailyCards] = useState(10);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Get user's learning languages
  const user = useQuery(api.users.getByClerkId, { clerkId: userId });
  const userLanguages = useMemo(() => user?.languages ?? ["japanese"], [user?.languages]);

  // Filter to only show languages user is learning
  const availableLanguages = useMemo(() => {
    return ALL_LANGUAGES.filter((lang) => userLanguages.includes(lang.value));
  }, [userLanguages]);

  // Initialize selected language from default or first available
  const [selectedLanguage, setSelectedLanguage] = useState<"japanese" | "english" | "french">(
    userLanguages.includes(defaultLanguage)
      ? defaultLanguage
      : ((userLanguages[0] as "japanese" | "english" | "french") ?? "japanese")
  );

  // Update selected language when user data loads
  useEffect(() => {
    if (user && !userLanguages.includes(selectedLanguage)) {
      setSelectedLanguage((userLanguages[0] as "japanese" | "english" | "french") ?? "japanese");
    }
  }, [user, userLanguages, selectedLanguage]);

  const availableDecks = useQuery(api.userDeckSubscriptions.getAvailableDecks, {
    userId,
    language: selectedLanguage,
  });

  // Keep previous decks during loading to prevent jitter
  const previousDecksRef = useRef<typeof availableDecks>(undefined);
  const displayDecks = availableDecks === undefined ? previousDecksRef.current : availableDecks;

  // Update ref when we get new data
  useEffect(() => {
    if (availableDecks !== undefined) {
      previousDecksRef.current = availableDecks;
    }
  }, [availableDecks]);

  const subscribe = useMutation(api.userDeckSubscriptions.subscribe);

  const selectedDeck = useMemo(() => {
    return displayDecks?.find((d) => d.deckId === selectedDeckId);
  }, [displayDecks, selectedDeckId]);

  const handleSubscribe = async () => {
    if (!selectedDeckId) return;

    setIsSubscribing(true);
    try {
      await subscribe({
        userId,
        deckId: selectedDeckId,
        dailyNewCards: dailyCards,
      });
      onClose();
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const adjustDailyCards = (delta: number) => {
    setDailyCards((prev) => Math.max(5, Math.min(30, prev + delta)));
  };

  const handleLanguageChange = (lang: ContentLanguage) => {
    setSelectedLanguage(lang);
    setSelectedDeckId(null);
  };

  // Only show language tabs if user is learning more than one language
  const showLanguageTabs = availableLanguages.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {t("vocabulary.deckPicker.title")}
          </DialogTitle>
          <DialogDescription>{t("vocabulary.deckPicker.description")}</DialogDescription>
        </DialogHeader>

        {/* Language Tabs - only show if learning multiple languages */}
        {showLanguageTabs && (
          <div className="flex gap-2 border-b border-border pb-3">
            {availableLanguages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => handleLanguageChange(lang.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedLanguage === lang.value
                    ? "bg-accent text-white"
                    : "text-foreground-muted hover:text-foreground hover:bg-muted"
                }`}
              >
                {t(`library.languages.${lang.value}`)}
              </button>
            ))}
          </div>
        )}

        {/* Single language indicator when only learning one language */}
        {!showLanguageTabs && availableLanguages.length === 1 && (
          <div className="flex items-center gap-2 text-sm text-foreground-muted pb-2">
            <span>
              {t(`library.languages.${availableLanguages[0].value}`)}{" "}
              {t("vocabulary.deckPicker.decks")}
            </span>
          </div>
        )}

        {/* Deck List - fixed height to prevent jitter */}
        <div className="h-64 overflow-y-auto space-y-2">
          {displayDecks === undefined ? (
            // Loading - only show on initial load
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : displayDecks.length === 0 ? (
            // No decks available
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm text-foreground-muted text-center">
                {t("vocabulary.deckPicker.subscribedToAll", {
                  language: t(`library.languages.${selectedLanguage}`),
                })}
              </p>
            </div>
          ) : (
            // Deck list
            displayDecks.map((deck) => (
              <button
                key={deck.deckId}
                onClick={() => setSelectedDeckId(deck.deckId)}
                className={`w-full p-3 rounded-lg text-left transition-all border ${
                  selectedDeckId === deck.deckId
                    ? "bg-accent/10 border-accent/30"
                    : "bg-muted/50 border-transparent hover:bg-muted hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`font-medium ${selectedDeckId === deck.deckId ? "text-accent" : "text-foreground"}`}
                      >
                        {deck.name}
                      </span>
                      {getLevelVariant(deck.level) ? (
                        <Badge variant={getLevelVariant(deck.level)}>{deck.level}</Badge>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground-muted">
                          {deck.level}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-muted line-clamp-2">{deck.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-foreground">{deck.totalWords}</div>
                    <div className="text-xs text-foreground-muted">{t("vocabulary.words")}</div>
                  </div>
                </div>
                {/* Content availability indicators */}
                <div className="flex items-center gap-3 mt-2 text-xs text-foreground-muted">
                  {deck.wordsWithSentences > 0 && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {t("vocabulary.deckPicker.sentences", { count: deck.wordsWithSentences })}
                    </span>
                  )}
                  {deck.wordsWithAudio > 0 && (
                    <span>
                      🔊 {t("vocabulary.deckPicker.audio", { count: deck.wordsWithAudio })}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Daily Cards Selector - only show when a deck is selected */}
        {selectedDeckId && selectedDeck && (
          <div className="border-t border-border pt-4 space-y-4">
            {/* Daily cards slider */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {t("vocabulary.deckPicker.newCardsPerDay")}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjustDailyCards(-5)}
                  disabled={dailyCards <= 5}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={5}
                    value={dailyCards}
                    onChange={(e) => setDailyCards(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>
                <button
                  onClick={() => adjustDailyCards(5)}
                  disabled={dailyCards >= 30}
                  className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-bold text-foreground text-lg shrink-0">
                  {dailyCards}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-foreground-muted px-10">
                <span>5</span>
                <span>15</span>
                <span>30</span>
              </div>
            </div>

            {/* Estimate */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p
                className="text-sm text-foreground-muted"
                dangerouslySetInnerHTML={{
                  __html: t("vocabulary.deckPicker.estimate", {
                    dailyCards,
                    deckName: selectedDeck.name,
                    days: Math.ceil(selectedDeck.totalWords / dailyCards),
                  }),
                }}
              />
            </div>

            {/* Subscribe Button */}
            <Button onClick={handleSubscribe} disabled={isSubscribing} className="w-full">
              {isSubscribing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("vocabulary.deckPicker.starting")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("vocabulary.deckPicker.startLearning", { deckName: selectedDeck.name })}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

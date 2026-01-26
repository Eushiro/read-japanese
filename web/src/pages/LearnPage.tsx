import { Link, useSearch } from "@tanstack/react-router";
import { BookmarkCheck, Brain, GraduationCap, PenLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useT } from "@/lib/i18n";

import { FlashcardsPage } from "./FlashcardsPage";
import { PracticePage } from "./PracticePage";
// Import content from existing pages (we'll extract the content components)
import { VocabularyPage } from "./VocabularyPage";

type LearnTab = "words" | "review" | "practice";

const TAB_IDS: LearnTab[] = ["words", "review", "practice"];
const TAB_ICONS: Record<LearnTab, typeof BookmarkCheck> = {
  words: BookmarkCheck,
  review: Brain,
  practice: PenLine,
};

export function LearnPage() {
  const t = useT();

  const TABS = useMemo(
    () =>
      TAB_IDS.map((id) => ({
        id,
        label: t(`learn.tabs.${id}`),
        icon: TAB_ICONS[id],
      })),
    [t]
  );
  // Get tab from URL query param
  const search = useSearch({ strict: false }) as { tab?: string };
  const tabFromUrl = search?.tab as LearnTab | undefined;

  const [activeTab, setActiveTab] = useState<LearnTab>(
    tabFromUrl && TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "words"
  );

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl && TAB_IDS.includes(tabFromUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync tab state with URL
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Scroll to top when tab changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure scroll happens after render
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }, [activeTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: LearnTab) => {
    setActiveTab(tab);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="min-h-screen">
      {/* Tab Header */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md dark:border-white/5 dark:bg-black/50 dark:backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-1 py-2">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 mr-4 hover:opacity-80 transition-opacity"
            >
              <div className="p-1.5 rounded-lg bg-accent/10">
                <GraduationCap className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm font-semibold text-foreground hidden sm:inline">
                {t("learn.title")}
              </span>
            </Link>

            {/* Tab Buttons */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 ${isActive ? "text-accent" : ""}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "words" && <VocabularyContent />}
        {activeTab === "review" && <FlashcardsContent />}
        {activeTab === "practice" && <PracticeContent />}
      </div>
    </div>
  );
}

// Wrapper components that render existing page content without their hero headers
// For now, we'll just render the full pages. In a future iteration,
// we could extract just the content portions.

function VocabularyContent() {
  return <VocabularyPage />;
}

function FlashcardsContent() {
  return <FlashcardsPage />;
}

function PracticeContent() {
  return <PracticePage />;
}

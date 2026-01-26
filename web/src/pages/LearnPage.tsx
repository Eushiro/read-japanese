import { useSearch } from "@tanstack/react-router";
import { BookmarkCheck, Brain, PenLine } from "lucide-react";
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
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Tab Header */}
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-center">
          {/* Tab Buttons */}
          <div className="flex items-center gap-1 p-1">
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

      {/* Tab Content - CSS visibility keeps all tabs mounted to preserve Convex subscriptions */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === "words" ? "h-full" : "hidden"}>
          <VocabularyContent />
        </div>
        <div className={activeTab === "review" ? "h-full" : "hidden"}>
          <FlashcardsContent />
        </div>
        <div className={activeTab === "practice" ? "h-full" : "hidden"}>
          <PracticeContent />
        </div>
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

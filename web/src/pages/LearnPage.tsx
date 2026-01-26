import { useSearch } from "@tanstack/react-router";
import { BookmarkCheck, Brain, PenLine } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { useT } from "@/lib/i18n";

// Lazy load tab content to improve initial navigation performance
const VocabularyContent = lazy(() =>
  import("./VocabularyPage").then((m) => ({ default: m.VocabularyPage }))
);
const FlashcardsContent = lazy(() =>
  import("./FlashcardsPage").then((m) => ({ default: m.FlashcardsPage }))
);
const PracticeContent = lazy(() =>
  import("./PracticePage").then((m) => ({ default: m.PracticePage }))
);

type LearnTab = "words" | "review" | "practice";

const TAB_IDS: LearnTab[] = ["words", "review", "practice"];
const TAB_ICONS: Record<LearnTab, typeof BookmarkCheck> = {
  words: BookmarkCheck,
  review: Brain,
  practice: PenLine,
};

// Loading skeleton shown while tab content is loading
function TabLoadingSkeleton() {
  return null; // Let pages handle their own loading states
}

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

      {/* Tab Content - Only render active tab, lazy loaded with Suspense */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<TabLoadingSkeleton />}>
          {activeTab === "words" && <VocabularyContent />}
          {activeTab === "review" && <FlashcardsContent />}
          {activeTab === "practice" && <PracticeContent />}
        </Suspense>
      </div>
    </div>
  );
}

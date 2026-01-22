import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { BookmarkCheck, Brain, PenLine, GraduationCap } from "lucide-react";

// Import content from existing pages (we'll extract the content components)
import { VocabularyPage } from "./VocabularyPage";
import { FlashcardsPage } from "./FlashcardsPage";
import { PracticePage } from "./PracticePage";

type LearnTab = "words" | "review" | "practice";

const TABS: { id: LearnTab; label: string; icon: typeof BookmarkCheck }[] = [
  { id: "words", label: "Words", icon: BookmarkCheck },
  { id: "review", label: "Review", icon: Brain },
  { id: "practice", label: "Practice", icon: PenLine },
];

export function LearnPage() {
  // Get tab from URL query param
  const search = useSearch({ strict: false }) as { tab?: string };
  const tabFromUrl = search?.tab as LearnTab | undefined;

  const [activeTab, setActiveTab] = useState<LearnTab>(
    tabFromUrl && TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : "words"
  );

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl && TABS.some(t => t.id === tabFromUrl)) {
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
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="flex items-center gap-1 py-2">
            <div className="flex items-center gap-2 mr-4">
              <div className="p-1.5 rounded-lg bg-accent/10">
                <GraduationCap className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm font-semibold text-foreground hidden sm:inline">
                Learn
              </span>
            </div>

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

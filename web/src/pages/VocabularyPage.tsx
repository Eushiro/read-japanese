import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Trash2, BookOpen, BookmarkCheck } from "lucide-react";
import type { JLPTLevel } from "@/types/story";

const levelVariantMap: Record<string, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

// TODO: Replace with actual user ID from auth
const MOCK_USER_ID = "demo-user";

export function VocabularyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const vocabulary = useQuery(api.vocabulary.list, { userId: MOCK_USER_ID });
  const removeWord = useMutation(api.vocabulary.remove);

  const filteredVocabulary = vocabulary?.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.word.toLowerCase().includes(term) ||
      item.reading.toLowerCase().includes(term) ||
      item.meaning.toLowerCase().includes(term)
    );
  });

  const handleRemove = async (id: string) => {
    try {
      await removeWord({ id: id as any });
    } catch (err) {
      console.error("Failed to remove word:", err);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="animate-fade-in-up">
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
              {vocabulary?.length || 0} words saved from your reading
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-4xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vocabulary..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Vocabulary List */}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-4xl">
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
        ) : filteredVocabulary?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">
              {searchTerm ? "No matching words found" : "No vocabulary saved yet"}
            </p>
            <p className="text-sm text-center max-w-sm">
              {searchTerm
                ? "Try a different search term"
                : "Tap on words while reading to save them to your vocabulary"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVocabulary?.map((item, index) => (
              <div
                key={item._id}
                className="p-5 rounded-xl bg-surface border border-border hover:border-foreground-muted/30 transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className="text-xl font-semibold text-foreground"
                        style={{ fontFamily: 'var(--font-japanese)' }}
                      >
                        {item.word}
                      </span>
                      {item.jlptLevel && (
                        <Badge
                          variant={
                            levelVariantMap[item.jlptLevel as JLPTLevel] ||
                            "secondary"
                          }
                          className="text-xs"
                        >
                          {item.jlptLevel}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-foreground-muted mb-2">
                      {item.reading}
                    </div>
                    <div className="text-foreground">{item.meaning}</div>
                    {item.sourceStoryTitle && (
                      <div className="text-xs text-foreground-muted mt-3 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        From: {item.sourceStoryTitle}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(item._id)}
                    className="text-foreground-muted hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

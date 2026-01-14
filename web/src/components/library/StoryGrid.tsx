import { StoryCard } from "./StoryCard";
import type { StoryListItem } from "@/types/story";
import { BookOpen } from "lucide-react";

interface StoryGridProps {
  stories: StoryListItem[];
  progress?: Record<string, number>; // storyId -> progress percentage
  isPremiumUser?: boolean;
  onStoryClick?: (story: StoryListItem) => void;
  isLoading?: boolean;
}

export function StoryGrid({
  stories,
  progress = {},
  isPremiumUser = false,
  onStoryClick,
  isLoading = false,
}: StoryGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <StoryCardSkeleton key={i} delay={i * 50} />
        ))}
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 opacity-40" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1">No stories found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
      {stories.map((story, index) => (
        <StoryCard
          key={story.id}
          story={story}
          progress={progress[story.id]}
          isPremiumUser={isPremiumUser}
          onClick={() => onStoryClick?.(story)}
          style={{
            animationDelay: `${Math.min(index * 50, 300)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function StoryCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-surface animate-pulse"
      style={{
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="aspect-[3/4] bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 bg-muted rounded-full w-16" />
          <div className="h-5 bg-muted rounded w-12" />
        </div>
      </div>
    </div>
  );
}

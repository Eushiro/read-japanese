import type { SessionActivity,SessionPlan } from "@/contexts/StudySessionContext";

interface PlannerInput {
  dueCardCount: number;
  newCardCount: number;
  vocabToReview: number;
  recommendedContent: {
    type: "story" | "video";
    id: string;
    title: string;
    duration?: number; // in seconds for videos
  } | null;
  selectedDuration: number | null; // null = automatic
}

// Time estimates in minutes
const CARD_REVIEW_TIME = 0.5; // 30 seconds per card
const INPUT_BASE_TIME = 6; // 6 minutes for reading/video
const SENTENCE_WRITE_TIME = 2; // 2 minutes per sentence

export function buildSessionPlan(input: PlannerInput): SessionPlan {
  const { dueCardCount, newCardCount, vocabToReview, recommendedContent, selectedDuration } = input;

  const totalCards = dueCardCount + newCardCount;
  const activities: SessionActivity[] = [];
  let estimatedMinutes = 0;

  // Determine time budget
  const duration = selectedDuration ?? calculateAutoDuration(totalCards, vocabToReview);

  // Edge case: Massive backlog (>50 cards) - Review-only session
  if (totalCards > 50) {
    const cardsToReview = Math.min(totalCards, Math.floor(duration / CARD_REVIEW_TIME));
    activities.push({ type: "review", cardCount: cardsToReview });
    estimatedMinutes = Math.ceil(cardsToReview * CARD_REVIEW_TIME);

    return {
      activities,
      estimatedMinutes,
      dueCardCount: totalCards,
      vocabWordCount: vocabToReview,
    };
  }

  // Build session based on selected duration
  let remainingTime = duration;

  // Phase 1: Review (if cards are due)
  if (totalCards > 0) {
    const reviewTime = Math.min(remainingTime * 0.5, totalCards * CARD_REVIEW_TIME);
    const cardsToReview = Math.min(totalCards, Math.floor(reviewTime / CARD_REVIEW_TIME));

    if (cardsToReview > 0) {
      activities.push({ type: "review", cardCount: cardsToReview });
      estimatedMinutes += Math.ceil(cardsToReview * CARD_REVIEW_TIME);
      remainingTime -= cardsToReview * CARD_REVIEW_TIME;
    }
  }

  // Phase 2: Input (read or watch)
  if (recommendedContent && remainingTime >= 3) {
    activities.push({
      type: "input",
      contentType: recommendedContent.type,
      contentId: recommendedContent.id,
      title: recommendedContent.title,
    });
    const inputTime = Math.min(remainingTime * 0.6, INPUT_BASE_TIME);
    estimatedMinutes += Math.ceil(inputTime);
    remainingTime -= inputTime;
  }

  // Phase 3: Output (if vocabulary needs practice)
  if (vocabToReview > 0 && remainingTime >= SENTENCE_WRITE_TIME) {
    const sentenceCount = Math.min(
      vocabToReview,
      Math.floor(remainingTime / SENTENCE_WRITE_TIME),
      2 // Max 2 sentences per session
    );

    if (sentenceCount > 0) {
      activities.push({ type: "output", wordCount: sentenceCount });
      estimatedMinutes += Math.ceil(sentenceCount * SENTENCE_WRITE_TIME);
    }
  }

  return {
    activities,
    estimatedMinutes,
    dueCardCount: totalCards,
    vocabWordCount: vocabToReview,
  };
}

function calculateAutoDuration(totalCards: number, vocabToReview: number): number {
  // Base duration
  let duration = 10;

  // Add time for cards
  if (totalCards > 0) {
    duration += Math.min(totalCards * CARD_REVIEW_TIME, 10);
  }

  // Add time for output
  if (vocabToReview > 0) {
    duration += Math.min(vocabToReview * SENTENCE_WRITE_TIME, 4);
  }

  // Add base input time
  duration += INPUT_BASE_TIME;

  // Cap at 30 minutes
  return Math.min(duration, 30);
}

// Generate session description text
export function getSessionDescription(plan: SessionPlan): string {
  const parts: string[] = [];

  for (const activity of plan.activities) {
    switch (activity.type) {
      case "review":
        parts.push(`${activity.cardCount} card${activity.cardCount > 1 ? "s" : ""}`);
        break;
      case "input":
        parts.push(activity.contentType === "story" ? "1 story" : "1 video");
        break;
      case "output":
        parts.push(`${activity.wordCount} sentence${activity.wordCount > 1 ? "s" : ""}`);
        break;
    }
  }

  if (parts.length === 0) {
    return "Browse content to get started";
  }

  return parts.join(" · ");
}

// Duration options for UI
export const DURATION_OPTIONS = [
  { value: 5, label: "5 min", description: "Quick review" },
  { value: 15, label: "15 min", description: "Standard" },
  { value: 30, label: "30 min", description: "Deep study" },
] as const;

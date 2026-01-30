import type { SessionActivity, SessionPlan } from "@/contexts/StudySessionContext";
import type { ContentLanguage } from "@/lib/contentLanguages";

// Learning goals that affect session content
export type LearningGoal = "exam" | "travel" | "professional" | "media" | "casual";

interface PlannerInput {
  dueCardCount: number;
  newCardCount: number;
  vocabToReview: number;
  recommendedContent: {
    type: "story" | "video";
    id: string;
    title: string;
    language: ContentLanguage;
    duration?: number; // in seconds for videos
  } | null;
  selectedDuration: number | null; // null = automatic
  learningGoal?: LearningGoal; // User's learning goal affects content selection
}

// Time estimates in minutes
const CARD_REVIEW_TIME = 0.5; // 30 seconds per card
const INPUT_BASE_TIME = 6; // 6 minutes for reading/video
const SENTENCE_WRITE_TIME = 2; // 2 minutes per sentence

// Goal-based activity weights (how much time to allocate to each activity type)
interface GoalWeights {
  review: number; // Fraction of time for flashcard review
  input: number; // Fraction of time for reading/watching
  output: number; // Fraction of time for writing practice
  preferVideo: boolean; // Whether to prefer video over reading
}

function getGoalWeights(goal?: LearningGoal): GoalWeights {
  switch (goal) {
    case "exam":
      // Exam focus: more review (drilling), balanced input/output
      return { review: 0.5, input: 0.3, output: 0.2, preferVideo: false };
    case "travel":
      // Travel focus: conversation practice, more output
      return { review: 0.3, input: 0.3, output: 0.4, preferVideo: true };
    case "professional":
      // Professional focus: reading comprehension, formal writing
      return { review: 0.3, input: 0.4, output: 0.3, preferVideo: false };
    case "media":
      // Media focus: listening comprehension, video content
      return { review: 0.3, input: 0.5, output: 0.2, preferVideo: true };
    case "casual":
    default:
      // Balanced approach for casual learners
      return { review: 0.4, input: 0.4, output: 0.2, preferVideo: false };
  }
}

export function buildSessionPlan(input: PlannerInput): SessionPlan {
  const {
    dueCardCount,
    newCardCount,
    vocabToReview,
    recommendedContent,
    selectedDuration,
    learningGoal,
  } = input;

  const totalCards = dueCardCount + newCardCount;
  const activities: SessionActivity[] = [];
  let estimatedMinutes = 0;

  // Determine time budget
  const duration = selectedDuration ?? calculateAutoDuration(totalCards, vocabToReview);

  // Goal-based activity weights
  const goalWeights = getGoalWeights(learningGoal);

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

  // Build session based on selected duration and goal weights
  let remainingTime = duration;

  // Phase 1: Review (if cards are due)
  if (totalCards > 0) {
    const reviewTimeAllocation = remainingTime * goalWeights.review;
    const reviewTime = Math.min(reviewTimeAllocation, totalCards * CARD_REVIEW_TIME);
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
      language: recommendedContent.language,
    });
    const inputTimeAllocation = duration * goalWeights.input;
    const inputTime = Math.min(remainingTime * 0.6, inputTimeAllocation, INPUT_BASE_TIME);
    estimatedMinutes += Math.ceil(inputTime);
    remainingTime -= inputTime;
  }

  // Phase 3: Output (if vocabulary needs practice and goal emphasizes output)
  if (vocabToReview > 0 && remainingTime >= SENTENCE_WRITE_TIME) {
    // Adjust max sentences based on goal
    const maxSentences = goalWeights.output >= 0.3 ? 3 : 2;
    const sentenceCount = Math.min(
      vocabToReview,
      Math.floor(remainingTime / SENTENCE_WRITE_TIME),
      maxSentences
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
// Note: descriptionKey should be translated at render time with t(`common.duration.${descriptionKey}`)
export const DURATION_OPTIONS = [
  { value: 5, label: "5 min", descriptionKey: "quick" },
  { value: 15, label: "15 min", descriptionKey: "standard" },
  { value: 30, label: "30 min", descriptionKey: "deep" },
] as const;

import { useMemo } from "react";
import { FuriganaText } from "./FuriganaText";
import type { StorySegment, Token } from "@/types/story";

interface SegmentProps {
  segment: StorySegment;
  showFurigana?: boolean;
  onTokenClick?: (token: Token, event: React.MouseEvent) => void;
  currentAudioTime?: number;
}

// Find sentence boundaries (indices of 。tokens) and return ranges
function getSentenceRanges(tokens: Token[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let sentenceStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].surface === "。") {
      ranges.push({ start: sentenceStart, end: i + 1 }); // Include the period
      sentenceStart = i + 1;
    }
  }

  // Handle remaining tokens after last period (if any)
  if (sentenceStart < tokens.length) {
    ranges.push({ start: sentenceStart, end: tokens.length });
  }

  return ranges;
}

// Get which sentence index is currently being spoken based on time proportion
function getCurrentSentenceIndex(
  currentTime: number,
  startTime: number,
  endTime: number,
  sentenceCount: number
): number {
  if (sentenceCount <= 1) return 0;

  const duration = endTime - startTime;
  const elapsed = currentTime - startTime;
  const progress = elapsed / duration;

  // Distribute time evenly across sentences
  const sentenceIndex = Math.floor(progress * sentenceCount);
  return Math.min(sentenceIndex, sentenceCount - 1);
}

export function Segment({
  segment,
  showFurigana = true,
  onTokenClick,
  currentAudioTime = 0,
}: SegmentProps) {
  const baseClasses = "leading-loose text-foreground";

  const segmentClasses = {
    paragraph: `${baseClasses} text-lg`,
    dialogue: `${baseClasses} text-lg pl-4 border-l-2 border-accent`,
    heading: `${baseClasses} text-xl font-semibold`,
  };

  const className = segmentClasses[segment.segmentType] || baseClasses;

  // Check if this segment is currently playing
  const isSegmentActive = useMemo(() => {
    if (segment.audioStartTime === undefined || segment.audioEndTime === undefined) return false;
    return currentAudioTime >= segment.audioStartTime && currentAudioTime <= segment.audioEndTime;
  }, [currentAudioTime, segment.audioStartTime, segment.audioEndTime]);

  // Get sentence ranges within this segment
  const sentenceRanges = useMemo(() => {
    if (!segment.tokens) return [];
    return getSentenceRanges(segment.tokens);
  }, [segment.tokens]);

  // Get current sentence index based on audio progress
  const currentSentenceIndex = useMemo(() => {
    if (!isSegmentActive || sentenceRanges.length === 0) return -1;
    return getCurrentSentenceIndex(
      currentAudioTime,
      segment.audioStartTime!,
      segment.audioEndTime!,
      sentenceRanges.length
    );
  }, [isSegmentActive, currentAudioTime, segment.audioStartTime, segment.audioEndTime, sentenceRanges.length]);

  if (!segment.tokens || segment.tokens.length === 0) {
    return <p className={className}>{segment.text || ""}</p>;
  }

  return (
    <p className={`${className} ${isSegmentActive ? "transition-colors duration-200" : ""}`}>
      {segment.tokens.map((token, index) => {
        // Check if this token is in the currently spoken sentence
        let isHighlighted = false;
        if (isSegmentActive && currentSentenceIndex >= 0 && currentSentenceIndex < sentenceRanges.length) {
          const range = sentenceRanges[currentSentenceIndex];
          isHighlighted = index >= range.start && index < range.end;
        }

        return (
          <FuriganaText
            key={`${segment.id}-${index}`}
            token={token}
            showFurigana={showFurigana}
            onClick={(event) => onTokenClick?.(token, event)}
            isHighlighted={isHighlighted}
          />
        );
      })}
    </p>
  );
}

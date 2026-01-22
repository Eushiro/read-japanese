import { useMemo } from "react";
import { FuriganaText } from "./FuriganaText";
import type { StorySegment, Token } from "@/types/story";

interface SegmentProps {
  segment: StorySegment;
  showFurigana?: boolean;
  onTokenClick?: (token: Token, event: React.MouseEvent, segmentText: string) => void;
  currentAudioTime?: number;
  selectedToken?: Token | null;
}

export function Segment({
  segment,
  showFurigana = true,
  onTokenClick,
  currentAudioTime,
  selectedToken,
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
    if (currentAudioTime === undefined) return false;
    if (segment.audioStartTime === undefined || segment.audioEndTime === undefined) return false;
    return currentAudioTime >= segment.audioStartTime && currentAudioTime <= segment.audioEndTime;
  }, [currentAudioTime, segment.audioStartTime, segment.audioEndTime]);

  if (!segment.tokens || segment.tokens.length === 0) {
    return <p className={className}>{segment.text || ""}</p>;
  }

  // Get the full sentence text from the segment
  const segmentText = segment.text || segment.tokens.map(t => t.surface).join("");

  return (
    <p className={`${className} ${isSegmentActive ? "transition-colors duration-200" : ""}`}>
      {segment.tokens.map((token, index) => (
        <FuriganaText
          key={`${segment.id}-${index}`}
          token={token}
          showFurigana={showFurigana}
          onClick={(event) => onTokenClick?.(token, event, segmentText)}
          isHighlighted={isSegmentActive}
          isSelected={selectedToken?.surface === token.surface && selectedToken?.baseForm === token.baseForm}
        />
      ))}
    </p>
  );
}

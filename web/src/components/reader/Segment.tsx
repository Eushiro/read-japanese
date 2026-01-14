import { useMemo } from "react";
import { FuriganaText } from "./FuriganaText";
import type { StorySegment, Token, AudioWord } from "@/types/story";

interface SegmentProps {
  segment: StorySegment;
  showFurigana?: boolean;
  onTokenClick?: (token: Token, event: React.MouseEvent) => void;
  currentAudioTime?: number;
}

// Find which audio word is currently being spoken
function getCurrentAudioWord(audioWords: AudioWord[] | undefined, time: number): AudioWord | null {
  if (!audioWords || audioWords.length === 0) return null;

  for (const word of audioWords) {
    if (time >= word.start && time < word.end) {
      return word;
    }
  }
  return null;
}

// Check if a token matches the current audio word
function isTokenHighlighted(
  token: Token,
  tokenIndex: number,
  tokens: Token[],
  currentWord: AudioWord | null,
  audioWords: AudioWord[] | undefined
): boolean {
  if (!currentWord || !audioWords) return false;

  // Build the text up to and including this token
  let textBefore = "";
  for (let i = 0; i < tokenIndex; i++) {
    textBefore += tokens[i].surface;
  }

  // Build the text with this token
  const textWithToken = textBefore + token.surface;

  // Build the audio text up to current word
  const currentWordIndex = audioWords.indexOf(currentWord);
  let audioTextUpToCurrent = "";
  for (let i = 0; i <= currentWordIndex; i++) {
    audioTextUpToCurrent += audioWords[i].text;
  }

  // Check if this token's position overlaps with the current audio word
  // This is a fuzzy match since tokenization and audio words don't align perfectly
  const tokenStart = textBefore.length;
  const tokenEnd = textWithToken.length;

  let audioStart = 0;
  for (let i = 0; i < currentWordIndex; i++) {
    audioStart += audioWords[i].text.length;
  }
  const audioEnd = audioStart + currentWord.text.length;

  // Check for overlap
  return tokenStart < audioEnd && tokenEnd > audioStart;
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

  // Get current audio word
  const currentAudioWord = useMemo(() => {
    if (!isSegmentActive) return null;
    return getCurrentAudioWord(segment.audioWords, currentAudioTime);
  }, [isSegmentActive, segment.audioWords, currentAudioTime]);

  if (!segment.tokens || segment.tokens.length === 0) {
    return <p className={className}>{segment.text || ""}</p>;
  }

  return (
    <p className={className}>
      {segment.tokens.map((token, index) => {
        const isHighlighted = isSegmentActive && isTokenHighlighted(
          token,
          index,
          segment.tokens!,
          currentAudioWord,
          segment.audioWords
        );

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

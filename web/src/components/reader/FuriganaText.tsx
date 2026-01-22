import type { Token, TokenPart } from "@/types/story";
import { tokenHasFurigana, isTokenPunctuation } from "@/types/story";

interface FuriganaTextProps {
  token: Token;
  showFurigana?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export function FuriganaText({
  token,
  showFurigana = true,
  onClick,
  isHighlighted = false,
  isSelected = false,
}: FuriganaTextProps) {
  const hasFurigana = showFurigana && tokenHasFurigana(token);
  const isPunctuation = isTokenPunctuation(token);

  if (isPunctuation) {
    return <span className="text-foreground">{token.surface}</span>;
  }

  const selectedClasses = isSelected
    ? "bg-accent/25 text-accent rounded-sm px-0.5 -mx-0.5"
    : "";
  const highlightClasses = isHighlighted && !isSelected
    ? "underline decoration-accent decoration-2 underline-offset-4"
    : "";

  if (!hasFurigana || !token.parts) {
    return (
      <span
        className={`cursor-pointer hover:bg-accent/10 rounded transition-colors ${selectedClasses} ${highlightClasses}`}
        onClick={onClick}
      >
        {token.surface}
      </span>
    );
  }

  return (
    <ruby
      className={`cursor-pointer hover:bg-accent/10 rounded transition-colors ${selectedClasses} ${highlightClasses}`}
      onClick={onClick}
    >
      {token.parts.map((part, i) => (
        <FuriganaPart key={i} part={part} showReading={showFurigana} />
      ))}
    </ruby>
  );
}

interface FuriganaPartProps {
  part: TokenPart;
  showReading: boolean;
}

function FuriganaPart({ part, showReading }: FuriganaPartProps) {
  if (!showReading || !part.reading) {
    return <>{part.text}</>;
  }

  return (
    <>
      {part.text}
      <rp>(</rp>
      <rt className="text-[0.5em] text-muted-foreground">{part.reading}</rt>
      <rp>)</rp>
    </>
  );
}

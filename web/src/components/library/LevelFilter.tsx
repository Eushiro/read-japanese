import { Badge } from "@/components/ui/badge";
import { JLPT_LEVELS, type JLPTLevel } from "@/types/story";

interface LevelFilterProps {
  selectedLevel: JLPTLevel | null;
  onSelectLevel: (level: JLPTLevel | null) => void;
}

const levelVariantMap: Record<JLPTLevel, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

export function LevelFilter({ selectedLevel, onSelectLevel }: LevelFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelectLevel(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          selectedLevel === null
            ? "bg-accent text-white shadow-sm"
            : "bg-surface text-foreground-muted hover:bg-muted hover:text-foreground border border-border"
        }`}
      >
        All
      </button>
      {JLPT_LEVELS.map((level) => (
        <button
          key={level}
          onClick={() => onSelectLevel(level)}
          className="transition-all duration-200"
        >
          <Badge
            variant={levelVariantMap[level]}
            className={`cursor-pointer px-3 py-1.5 ${
              selectedLevel === level
                ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-background scale-105"
                : selectedLevel !== null
                ? "opacity-40 hover:opacity-70"
                : "hover:scale-105"
            }`}
          >
            {level}
          </Badge>
        </button>
      ))}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { JLPT_LEVELS, CEFR_LEVELS, type JLPTLevel, type CEFRLevel, type ProficiencyLevel } from "@/types/story";

type Language = "japanese" | "english" | "french";

interface LevelFilterProps {
  selectedLevel: ProficiencyLevel | null;
  onSelectLevel: (level: ProficiencyLevel | null) => void;
  languages?: Language[];
}

type BadgeVariant = "n5" | "n4" | "n3" | "n2" | "n1" | "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

const levelVariantMap: Record<ProficiencyLevel, BadgeVariant> = {
  // JLPT levels
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
  // CEFR levels
  A1: "a1",
  A2: "a2",
  B1: "b1",
  B2: "b2",
  C1: "c1",
  C2: "c2",
};

export function LevelFilter({ selectedLevel, onSelectLevel, languages }: LevelFilterProps) {
  // Determine which levels to show based on user's languages
  let jlptLevelsToShow: JLPTLevel[] = [];
  let cefrLevelsToShow: CEFRLevel[] = [];

  if (languages && languages.length > 0) {
    // Show all JLPT levels if Japanese is selected
    if (languages.includes("japanese")) {
      jlptLevelsToShow = [...JLPT_LEVELS];
    }

    // Show all CEFR levels if French or English is selected
    if (languages.includes("french") || languages.includes("english")) {
      cefrLevelsToShow = [...CEFR_LEVELS];
    }
  }

  // If no languages selected, show all JLPT levels by default (for backward compatibility)
  if (jlptLevelsToShow.length === 0 && cefrLevelsToShow.length === 0) {
    jlptLevelsToShow = [...JLPT_LEVELS];
  }

  const hasMultipleSystems = jlptLevelsToShow.length > 0 && cefrLevelsToShow.length > 0;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
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

      {/* JLPT Levels */}
      {jlptLevelsToShow.length > 0 && (
        <>
          {hasMultipleSystems && (
            <span className="text-xs text-foreground-muted ml-1 mr-0.5">JLPT:</span>
          )}
          {jlptLevelsToShow.map((level) => (
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
        </>
      )}

      {/* CEFR Levels */}
      {cefrLevelsToShow.length > 0 && (
        <>
          {hasMultipleSystems && (
            <span className="text-xs text-foreground-muted ml-2 mr-0.5">CEFR:</span>
          )}
          {cefrLevelsToShow.map((level) => (
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
        </>
      )}
    </div>
  );
}

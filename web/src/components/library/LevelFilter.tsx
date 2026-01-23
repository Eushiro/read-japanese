import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JLPT_LEVELS, CEFR_LEVELS, type JLPTLevel, type CEFRLevel, type ProficiencyLevel } from "@/types/story";

type Language = "japanese" | "english" | "french";

interface LevelFilterProps {
  selectedLevel: ProficiencyLevel | null;
  onSelectLevel: (level: ProficiencyLevel | null) => void;
  languages?: Language[];
}

export function LevelFilter({ selectedLevel, onSelectLevel, languages }: LevelFilterProps) {
  // Determine which levels to show based on user's languages
  let jlptLevelsToShow: JLPTLevel[] = [];
  let cefrLevelsToShow: CEFRLevel[] = [];

  if (languages && languages.length > 0) {
    if (languages.includes("japanese")) {
      jlptLevelsToShow = [...JLPT_LEVELS];
    }
    if (languages.includes("french") || languages.includes("english")) {
      cefrLevelsToShow = [...CEFR_LEVELS];
    }
  }

  // If no languages selected, show all JLPT levels by default
  if (jlptLevelsToShow.length === 0 && cefrLevelsToShow.length === 0) {
    jlptLevelsToShow = [...JLPT_LEVELS];
  }

  const hasJLPT = jlptLevelsToShow.length > 0;
  const hasCEFR = cefrLevelsToShow.length > 0;

  return (
    <Select
      value={selectedLevel ?? "all"}
      onValueChange={(value) => onSelectLevel(value === "all" ? null : value as ProficiencyLevel)}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue placeholder="Level" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Levels</SelectItem>

        {hasJLPT && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>JLPT</SelectLabel>
              {jlptLevelsToShow.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}

        {hasCEFR && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>CEFR</SelectLabel>
              {cefrLevelsToShow.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

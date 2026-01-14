// User settings
export interface Settings {
  fontSize: number; // 14-32, default 20
  fontName: FontName;
  showFurigana: boolean;
  showEnglishTitles: boolean;
  showEnglishDescriptions: boolean;
  chapterViewMode: ChapterViewMode;
  audioHighlightMode: AudioHighlightMode;
  theme: ThemeMode;
}

export type FontName = "system" | "hiragino-sans" | "hiragino-mincho" | "noto-sans-jp";

export type ChapterViewMode = "paged" | "continuous";

export type AudioHighlightMode = "sentence" | "word";

export type ThemeMode = "system" | "light" | "dark";

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 20,
  fontName: "system",
  showFurigana: true,
  showEnglishTitles: false,
  showEnglishDescriptions: false,
  chapterViewMode: "paged",
  audioHighlightMode: "sentence",
  theme: "system",
};

export const FONT_OPTIONS: { value: FontName; label: string; fontFamily: string }[] = [
  { value: "system", label: "System", fontFamily: "system-ui, sans-serif" },
  { value: "hiragino-sans", label: "Hiragino Sans", fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif' },
  { value: "hiragino-mincho", label: "Hiragino Mincho", fontFamily: '"Hiragino Mincho ProN", serif' },
  { value: "noto-sans-jp", label: "Noto Sans JP", fontFamily: '"Noto Sans JP", sans-serif' },
];

export function getFontFamily(fontName: FontName): string {
  const font = FONT_OPTIONS.find((f) => f.value === fontName);
  return font?.fontFamily || FONT_OPTIONS[0].fontFamily;
}

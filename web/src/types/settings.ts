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

// labelKey is an i18n key for "system", or null for proper noun font names
// Translate at render time: labelKey ? t(`common.fonts.${labelKey}`) : label
export const FONT_OPTIONS: { value: FontName; label: string; labelKey: string | null; fontFamily: string }[] = [
  { value: "system", label: "System", labelKey: "system", fontFamily: "system-ui, sans-serif" },
  {
    value: "hiragino-sans",
    label: "Hiragino Sans",
    labelKey: null,
    fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif',
  },
  {
    value: "hiragino-mincho",
    label: "Hiragino Mincho",
    labelKey: null,
    fontFamily: '"Hiragino Mincho ProN", serif',
  },
  { value: "noto-sans-jp", label: "Noto Sans JP", labelKey: null, fontFamily: '"Noto Sans JP", sans-serif' },
];

export function getFontFamily(fontName: FontName): string {
  const font = FONT_OPTIONS.find((f) => f.value === fontName);
  return font?.fontFamily || FONT_OPTIONS[0].fontFamily;
}

/**
 * UI Language types - abstraction layer
 * These types can be used regardless of the underlying i18n library
 */

export type UILanguage = "en" | "ja" | "zh" | "fr";

export type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

export interface TranslationContextValue {
  t: TranslateFunction;
  language: UILanguage;
  setLanguage: (lang: UILanguage) => void;
  isReady: boolean;
}

// labelKey is the i18n key for the language name (translate with t(`common.uiLanguages.${value}`))
// nativeName is the language's name in its own script (never translated)
export const UI_LANGUAGES: {
  value: UILanguage;
  labelKey: string;
  nativeName: string;
}[] = [
  { value: "en", labelKey: "en", nativeName: "English" },
  { value: "fr", labelKey: "fr", nativeName: "Français" },
  { value: "ja", labelKey: "ja", nativeName: "日本語" },
  { value: "zh", labelKey: "zh", nativeName: "中文" },
];

export const DEFAULT_LANGUAGE: UILanguage = "en";
export const SUPPORTED_LANGUAGES: UILanguage[] = ["en", "fr", "ja", "zh"];

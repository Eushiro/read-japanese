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

export const UI_LANGUAGES: {
  value: UILanguage;
  label: string;
  nativeName: string;
}[] = [
  { value: "en", label: "English", nativeName: "English" },
  { value: "fr", label: "French", nativeName: "Français" },
  { value: "ja", label: "Japanese", nativeName: "日本語" },
  { value: "zh", label: "Chinese", nativeName: "中文" },
];

export const DEFAULT_LANGUAGE: UILanguage = "en";
export const SUPPORTED_LANGUAGES: UILanguage[] = ["en", "fr", "ja", "zh"];

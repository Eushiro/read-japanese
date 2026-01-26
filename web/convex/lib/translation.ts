/**
 * Translation resolution utility
 *
 * IMPORTANT: This utility intentionally does NOT fall back to English.
 * If a translation isn't available in the user's UI language, it returns null.
 * English is NOT treated as a default - it's just another language option.
 */

export type UILanguage = "en" | "ja" | "fr" | "zh";

export type TranslationMap = {
  en?: string;
  ja?: string;
  fr?: string;
  zh?: string;
};

/**
 * Definition translation map - all languages are required for definitions.
 */
export type DefinitionTranslationMap = {
  en: string;
  ja: string;
  fr: string;
  zh: string;
};

/**
 * Get the sentence translation for a specific UI language.
 * Returns null if the translation is not available - NO fallback to English.
 *
 * @param translations - The translations object from the sentence
 * @param uiLanguage - The user's UI language
 * @returns The translation string or null if not available
 */
export function getSentenceTranslation(
  translations: TranslationMap | undefined,
  uiLanguage: UILanguage
): string | null {
  if (!translations) return null;
  return translations[uiLanguage] ?? null;
}

/**
 * Check if a translation exists for a specific UI language.
 *
 * @param translations - The translations object from the sentence
 * @param uiLanguage - The user's UI language
 * @returns true if a translation exists for the given language
 */
export function hasTranslationForLanguage(
  translations: TranslationMap | undefined,
  uiLanguage: UILanguage
): boolean {
  return getSentenceTranslation(translations, uiLanguage) !== null;
}

/**
 * Map of UI language codes to full language names for AI prompts.
 * Used when instructing AI to respond in a specific language.
 */
export const UI_LANGUAGE_NAMES: Record<UILanguage, string> = {
  en: "English",
  ja: "日本語",
  fr: "français",
  zh: "中文",
};

/**
 * Validate and normalize a UI language string.
 * Returns the language if valid, otherwise returns "en" as fallback.
 *
 * @param lang - The language string to validate
 * @returns A valid UILanguage
 */
export function normalizeUILanguage(lang: string | undefined): UILanguage {
  if (lang === "en" || lang === "ja" || lang === "fr" || lang === "zh") {
    return lang;
  }
  return "en";
}

/**
 * Get definitions for a specific UI language from translated definitions.
 * Falls back to the original definitions array if translations are not available.
 *
 * @param definitionTranslations - Array of definition translations (or undefined)
 * @param definitions - Original definitions array (fallback)
 * @param uiLanguage - The user's UI language
 * @returns Array of definitions in the specified language
 */
export function getDefinitions(
  definitionTranslations: DefinitionTranslationMap[] | undefined,
  definitions: string[],
  uiLanguage: UILanguage
): string[] {
  // If translations are available, use them
  if (definitionTranslations && definitionTranslations.length > 0) {
    return definitionTranslations.map((dt) => dt[uiLanguage]);
  }
  // Otherwise, fall back to original definitions
  return definitions;
}

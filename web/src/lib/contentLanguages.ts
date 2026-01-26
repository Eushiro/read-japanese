/**
 * Content language and exam configuration
 *
 * Content languages are imported from shared/contentLanguages.json to ensure consistency
 * between frontend and backend. To add a new language, update that file.
 *
 * Note: This is separate from UI/display language (i18n) which controls the interface language.
 * ContentLanguage = what the user is learning (Japanese, English, French)
 * i18n locale = what language the UI is displayed in
 */

import languagesConfig from "../../../shared/contentLanguages.json";

// Build LANGUAGES array from shared config
export const LANGUAGES = languagesConfig.supported.map((lang) => ({
  value: lang.code as "japanese" | "english" | "french",
  label: lang.name,
  nativeName: lang.nativeName,
}));

// Export config for direct access
export const SUPPORTED_LANGUAGE_CODES = languagesConfig.supported.map((l) => l.code);
export const DEFAULT_LANGUAGE_CODE = languagesConfig.default;
export const TRANSLATION_TARGETS = languagesConfig.translationTargets;

// Exam descriptions use i18n keys - translate at render time with t(`common.levels.${descriptionKey}`)
export const EXAMS_BY_LANGUAGE = {
  japanese: [
    { value: "jlpt_n5", label: "JLPT N5", descriptionKey: "beginner" },
    { value: "jlpt_n4", label: "JLPT N4", descriptionKey: "elementary" },
    { value: "jlpt_n3", label: "JLPT N3", descriptionKey: "intermediate" },
    { value: "jlpt_n2", label: "JLPT N2", descriptionKey: "upperIntermediate" },
    { value: "jlpt_n1", label: "JLPT N1", descriptionKey: "advanced" },
  ],
  english: [
    { value: "toefl", label: "TOEFL", descriptionKey: "academicEnglish" },
    { value: "sat", label: "SAT", descriptionKey: "collegeAdmission" },
    { value: "gre", label: "GRE", descriptionKey: "graduateSchool" },
  ],
  french: [
    { value: "delf_a1", label: "DELF A1", descriptionKey: "beginner" },
    { value: "delf_a2", label: "DELF A2", descriptionKey: "elementary" },
    { value: "delf_b1", label: "DELF B1", descriptionKey: "intermediate" },
    { value: "delf_b2", label: "DELF B2", descriptionKey: "upperIntermediate" },
    { value: "dalf_c1", label: "DALF C1", descriptionKey: "advanced" },
    { value: "dalf_c2", label: "DALF C2", descriptionKey: "mastery" },
    { value: "tcf", label: "TCF", descriptionKey: "generalProficiency" },
  ],
} as const;

export type ContentLanguage = (typeof LANGUAGES)[number]["value"];
export type ContentLanguageOption = (typeof LANGUAGES)[number];
export type ExamOption = (typeof EXAMS_BY_LANGUAGE)[ContentLanguage][number];

/**
 * Mapping from content language codes to UI language codes
 * Content: "japanese" | "english" | "french"
 * UI: "ja" | "en" | "fr" | "zh"
 */
const CONTENT_TO_UI_LANGUAGE: Record<ContentLanguage, string> = {
  japanese: "ja",
  english: "en",
  french: "fr",
};

/**
 * Check if content language matches UI language
 * Used to hide redundant translations (e.g., don't show Japanese translation
 * when user is studying Japanese with UI in Japanese)
 */
export function contentLanguageMatchesUI(
  contentLanguage: ContentLanguage,
  uiLanguage: string
): boolean {
  return CONTENT_TO_UI_LANGUAGE[contentLanguage] === uiLanguage;
}

// Language-specific placeholder colors for video thumbnails
export const LANGUAGE_COLORS: Record<string, { bg: string; text: string }> = {
  japanese: { bg: "bg-red-600", text: "日本語" },
  english: { bg: "bg-blue-600", text: "English" },
  french: { bg: "bg-violet-600", text: "Français" },
};

/**
 * Detect user's likely target content language based on browser locale
 */
export function detectTargetLanguage(): ContentLanguage {
  const browserLang = navigator.language.toLowerCase();

  // If browser is in English, they probably want to learn something else
  // Default to Japanese as it's our primary focus
  if (browserLang.startsWith("en")) {
    return "japanese";
  }

  // If browser is in French, suggest Japanese or English
  if (browserLang.startsWith("fr")) {
    return "japanese";
  }

  // If browser is in Japanese, suggest English
  if (browserLang.startsWith("ja")) {
    return "english";
  }

  // Default to Japanese
  return "japanese";
}

/**
 * Get exams available for a specific content language
 */
export function getExamsForLanguage(language: ContentLanguage): readonly ExamOption[] {
  return EXAMS_BY_LANGUAGE[language];
}

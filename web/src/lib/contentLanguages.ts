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

export const EXAMS_BY_LANGUAGE = {
  japanese: [
    { value: "jlpt_n5", label: "JLPT N5", description: "Beginner" },
    { value: "jlpt_n4", label: "JLPT N4", description: "Elementary" },
    { value: "jlpt_n3", label: "JLPT N3", description: "Intermediate" },
    { value: "jlpt_n2", label: "JLPT N2", description: "Upper Intermediate" },
    { value: "jlpt_n1", label: "JLPT N1", description: "Advanced" },
  ],
  english: [
    { value: "toefl", label: "TOEFL", description: "Academic English" },
    { value: "sat", label: "SAT", description: "College Admission" },
    { value: "gre", label: "GRE", description: "Graduate School" },
  ],
  french: [
    { value: "delf_a1", label: "DELF A1", description: "Beginner" },
    { value: "delf_a2", label: "DELF A2", description: "Elementary" },
    { value: "delf_b1", label: "DELF B1", description: "Intermediate" },
    { value: "delf_b2", label: "DELF B2", description: "Upper Intermediate" },
    { value: "dalf_c1", label: "DALF C1", description: "Advanced" },
    { value: "dalf_c2", label: "DALF C2", description: "Mastery" },
    { value: "tcf", label: "TCF", description: "General Proficiency" },
  ],
} as const;

export type ContentLanguage = (typeof LANGUAGES)[number]["value"];
export type ContentLanguageOption = (typeof LANGUAGES)[number];
export type ExamOption = (typeof EXAMS_BY_LANGUAGE)[ContentLanguage][number];

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

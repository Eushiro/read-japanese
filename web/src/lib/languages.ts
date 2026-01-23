// Shared language and exam configuration

export const LANGUAGES = [
  { value: "japanese", label: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  { value: "english", label: "English", flag: "🇬🇧", nativeName: "English" },
  { value: "french", label: "French", flag: "🇫🇷", nativeName: "Français" },
] as const;

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

export type Language = (typeof LANGUAGES)[number]["value"];
export type LanguageOption = (typeof LANGUAGES)[number];
export type ExamOption = (typeof EXAMS_BY_LANGUAGE)[Language][number];

// Language-specific placeholder colors for video thumbnails
export const LANGUAGE_COLORS: Record<string, { bg: string; text: string }> = {
  japanese: { bg: "bg-red-600", text: "日本語" },
  english: { bg: "bg-blue-600", text: "English" },
  french: { bg: "bg-violet-600", text: "Français" },
};

/**
 * Detect user's likely target language based on browser locale
 */
export function detectTargetLanguage(): Language {
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
 * Get exams available for a specific language
 */
export function getExamsForLanguage(language: Language): readonly ExamOption[] {
  return EXAMS_BY_LANGUAGE[language];
}

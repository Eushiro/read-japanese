/**
 * Color scheme utilities for language-related UI components.
 * Used consistently across dashboard buttons and radar charts.
 */

export type LanguageColorScheme = "blue" | "purple" | "orange";

/**
 * Get color scheme for a language based on its position in the list.
 * - 1 language: orange
 * - 2 languages: purple (first), orange (second)
 * - 3+ languages: purple, blue, orange (repeating)
 */
export function getLanguageColorScheme(index: number, total: number): LanguageColorScheme {
  if (total === 1) {
    return "orange";
  } else if (total === 2) {
    return index === 0 ? "purple" : "orange";
  } else {
    const colors: LanguageColorScheme[] = ["purple", "blue", "orange"];
    return colors[index % 3];
  }
}

/**
 * Tailwind gradient classes for language buttons (glass morphism style).
 */
export const languageButtonGradients: Record<LanguageColorScheme, string> = {
  orange:
    "from-amber-500/50 via-orange-500/50 to-amber-600/50 shadow-amber-500/20 hover:shadow-amber-500/30",
  purple:
    "from-purple-500/50 via-violet-500/50 to-purple-600/50 shadow-purple-500/20 hover:shadow-purple-500/30",
  blue: "from-blue-500/50 via-sky-500/50 to-blue-600/50 shadow-blue-500/20 hover:shadow-blue-500/30",
};

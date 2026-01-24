// Language-specific motivational phrases for study buttons

export const STUDY_PHRASES: Record<string, string[]> = {
  japanese: [
    "頑張ろう！",
    "Japanese Time!",
    "さあ、始めよう！",
    "Let's 勉強!",
    "今日も頑張る！",
  ],
  french: [
    "C'est parti !",
    "On y va !",
    "Allons-y !",
    "French Time!",
    "Au travail !",
  ],
  english: [
    "Let's Go!",
    "Time to Learn!",
    "English Time!",
    "Let's Do This!",
    "Ready to Study!",
  ],
};

/**
 * Get a random motivational phrase for the given language
 */
export function getRandomStudyPhrase(language: string): string {
  const phrases = STUDY_PHRASES[language] ?? STUDY_PHRASES.english;
  const index = Math.floor(Math.random() * phrases.length);
  return phrases[index];
}

import { useQuery } from "convex/react";
import { Check, ChevronDown, GraduationCap } from "lucide-react";
import { useState } from "react";

import { PlacementTestPromptDialog } from "@/components/PlacementTestPromptDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { usePrimaryLanguage } from "@/hooks/usePrimaryLanguage";
import { type ContentLanguage, LANGUAGES } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

interface LanguageSwitcherProps {
  /** Visual variant of the switcher */
  variant?: "compact" | "pill";
}

export function LanguageSwitcher({ variant = "compact" }: LanguageSwitcherProps) {
  const t = useT();
  const { user, isAuthenticated } = useAuth();
  const [pendingLanguage, setPendingLanguage] = useState<ContentLanguage | null>(null);

  const {
    primaryLanguage,
    userLanguages: userLanguageCodes,
    hasMultipleLanguages,
    setPrimaryLanguage,
  } = usePrimaryLanguage();

  // Get user profile for proficiency levels check
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  // Get other languages for due cards query
  const otherLanguages = userLanguageCodes.filter((l) => l !== primaryLanguage);

  // Query for due cards in other languages
  const otherLanguageStats = useQuery(
    api.flashcards.getStatsByLanguages,
    isAuthenticated && user && otherLanguages.length > 0
      ? { userId: user.id, languages: otherLanguages }
      : "skip"
  );

  // Don't render for single-language users or unauthenticated users
  // Multi-language users see the dropdown immediately (with cached language)
  if (!isAuthenticated || !hasMultipleLanguages) {
    return null;
  }

  const currentLanguage = LANGUAGES.find((l) => l.value === primaryLanguage);
  const userLanguages = LANGUAGES.filter((l) => userLanguageCodes.includes(l.value));

  // Check if language has placement test
  const hasPlacementTest = (lang: ContentLanguage): boolean => {
    return !!userProfile?.proficiencyLevels?.[lang as keyof typeof userProfile.proficiencyLevels];
  };

  // Get due cards count for a language
  const getDueCards = (lang: ContentLanguage): number => {
    if (lang === primaryLanguage) return 0;
    const stats = otherLanguageStats?.[lang];
    return stats ? stats.dueNow + stats.new : 0;
  };

  const handleLanguageChange = async (language: ContentLanguage) => {
    if (language === primaryLanguage) return;

    // If language doesn't have a placement test, show prompt
    if (!hasPlacementTest(language)) {
      setPendingLanguage(language);
      return;
    }

    // Otherwise, switch directly
    try {
      await setPrimaryLanguage(language);
    } catch (error) {
      console.error("Failed to switch language:", error);
    }
  };

  const handleSkipPlacement = async () => {
    if (!pendingLanguage) return;
    try {
      await setPrimaryLanguage(pendingLanguage);
    } catch (error) {
      console.error("Failed to switch language:", error);
    }
    setPendingLanguage(null);
  };

  const triggerClassName =
    variant === "pill"
      ? "flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border text-sm font-medium hover:bg-muted/80 transition-colors"
      : "flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={triggerClassName}>
            <span className={variant === "pill" ? "text-foreground" : "text-base"}>
              {currentLanguage ? t(`common.languages.${currentLanguage.value}`) : ""}
            </span>
            <ChevronDown className="w-3 h-3 text-foreground-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[200px]">
          {userLanguages.map((lang) => {
            const isCurrent = lang.value === primaryLanguage;
            const needsTest = !hasPlacementTest(lang.value);
            const dueCards = getDueCards(lang.value);
            return (
              <DropdownMenuItem
                key={lang.value}
                onClick={() => handleLanguageChange(lang.value)}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <span className="flex items-center gap-2">
                  <span>{t(`common.languages.${lang.value}`)}</span>
                  {needsTest && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <GraduationCap className="w-3 h-3" />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {dueCards > 0 && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {dueCards} {t("dashboard.languageSwitcher.due")}
                    </span>
                  )}
                  {isCurrent && <Check className="w-4 h-4 text-accent" />}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Placement test prompt for untested languages */}
      {pendingLanguage && (
        <PlacementTestPromptDialog
          isOpen={!!pendingLanguage}
          onClose={() => setPendingLanguage(null)}
          language={pendingLanguage}
          onSkip={handleSkipPlacement}
        />
      )}
    </>
  );
}

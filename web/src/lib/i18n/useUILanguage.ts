/**
 * Hook for managing UI language
 * Abstracts language switching with optional Convex persistence for authenticated users
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation as useI18nextTranslation } from "react-i18next";

import { setUILanguage } from "./language";
import type { UILanguage } from "./types";

interface UseUILanguageReturn {
  language: UILanguage;
  setLanguage: (lang: UILanguage) => void;
  isChanging: boolean;
}

/**
 * Hook for reading and setting the UI language
 * Handles localStorage persistence automatically
 *
 * @example
 * const { language, setLanguage } = useUILanguage();
 * return (
 *   <select value={language} onChange={(e) => setLanguage(e.target.value as UILanguage)}>
 *     <option value="en">English</option>
 *     <option value="fr">Français</option>
 *   </select>
 * );
 */
export function useUILanguage(): UseUILanguageReturn {
  const { i18n } = useI18nextTranslation();
  const [isChanging, setIsChanging] = useState(false);

  const language = i18n.language as UILanguage;

  const setLanguage = useCallback(
    async (lang: UILanguage) => {
      if (lang === language) return;

      setIsChanging(true);
      try {
        await setUILanguage(lang);
      } finally {
        setIsChanging(false);
      }
    },
    [language]
  );

  return {
    language,
    setLanguage,
    isChanging,
  };
}

/**
 * Hook that syncs UI language with authenticated user's Convex preference
 * Use this in the root layout component
 *
 * @param userId - The authenticated user's ID, or undefined if not authenticated
 * @param userPreferredLanguage - The user's stored language preference from Convex
 * @param onLanguageChange - Callback to persist language change to Convex
 */
export function useSyncUILanguage(
  userId: string | undefined,
  userPreferredLanguage: UILanguage | undefined,
  onLanguageChange?: (lang: UILanguage) => Promise<void>
): UseUILanguageReturn {
  const { language, setLanguage: setLocalLanguage, isChanging } = useUILanguage();
  const [isSyncing, setIsSyncing] = useState(false);
  const syncedUserRef = useRef<string | undefined>(undefined);

  // Sync from Convex to local when user logs in
  useEffect(() => {
    if (userId && userPreferredLanguage && syncedUserRef.current !== userId) {
      syncedUserRef.current = userId;
      if (userPreferredLanguage !== language) {
        setLocalLanguage(userPreferredLanguage);
      }
    }
  }, [userId, userPreferredLanguage, language, setLocalLanguage]);

  const setLanguage = useCallback(
    async (lang: UILanguage) => {
      if (lang === language) return;

      setIsSyncing(true);
      try {
        // Update local state first for immediate feedback
        setLocalLanguage(lang);

        // Then persist to Convex if callback provided
        if (onLanguageChange) {
          await onLanguageChange(lang);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [language, setLocalLanguage, onLanguageChange]
  );

  return {
    language,
    setLanguage,
    isChanging: isChanging || isSyncing,
  };
}

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { detectTargetLanguage } from "@/lib/contentLanguages";

import { api } from "../../convex/_generated/api";

const STORAGE_KEY = "sanlang_primary_language";

/**
 * Get cached primary language from localStorage
 * Returns null if no cached value exists
 */
function getCachedLanguage(): ContentLanguage | null {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached === "japanese" || cached === "english" || cached === "french") {
    return cached;
  }
  return null;
}

/**
 * Save primary language to localStorage
 */
function setCachedLanguage(language: ContentLanguage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, language);
}

/**
 * Hook to get the user's primary language with localStorage caching.
 *
 * This eliminates content flicker on page load by:
 * 1. Returning cached language from localStorage immediately (no loading state)
 * 2. Syncing cache when user profile loads
 * 3. Updating cache when language changes
 *
 * For new users without cached data, falls back to detected browser language.
 */
export function usePrimaryLanguage(): {
  primaryLanguage: ContentLanguage;
  isLoading: boolean;
  userLanguages: ContentLanguage[];
  hasMultipleLanguages: boolean;
  setPrimaryLanguage: (language: ContentLanguage) => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();

  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  const setPrimaryLanguageMutation = useMutation(api.users.setPrimaryLanguage);

  // Get the effective primary language:
  // 1. If profile loaded, use profile value (source of truth)
  // 2. If not loaded, use cached localStorage value
  // 3. If no cache, detect from browser
  const cachedLanguage = getCachedLanguage();
  const effectiveLanguage =
    userProfile?.primaryLanguage ?? cachedLanguage ?? detectTargetLanguage();

  // Sync localStorage cache when profile loads or changes
  useEffect(() => {
    if (userProfile?.primaryLanguage) {
      setCachedLanguage(userProfile.primaryLanguage);
    }
  }, [userProfile?.primaryLanguage]);

  // Wrapper to update language and sync cache
  const handleSetPrimaryLanguage = useCallback(
    async (language: ContentLanguage) => {
      if (!user) return;

      // Optimistically update cache
      setCachedLanguage(language);

      await setPrimaryLanguageMutation({
        clerkId: user.id,
        language: language as "japanese" | "english" | "french",
      });
    },
    [user, setPrimaryLanguageMutation]
  );

  return {
    primaryLanguage: effectiveLanguage,
    isLoading: isAuthenticated && userProfile === undefined,
    userLanguages: userProfile?.languages ?? [],
    hasMultipleLanguages: (userProfile?.languages?.length ?? 0) > 1,
    setPrimaryLanguage: handleSetPrimaryLanguage,
  };
}

import { useQuery } from "convex/react";

import { useAuth } from "@/contexts/AuthContext";
import { useStudySession } from "@/contexts/StudySessionContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useRecommendedStories } from "@/hooks/useRecommendedStories";
import type { VideoItem } from "@/hooks/useRecommendedVideos";
import { useRecommendedVideos } from "@/hooks/useRecommendedVideos";
import { useStoriesByLanguage } from "@/hooks/useStories";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { getLanguageColorScheme } from "@/lib/languageColors";
import { abilityToProgress } from "@/lib/levels";

import { api } from "../../../convex/_generated/api";

export function useMockupData() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "anonymous";
  const t = useT();
  const { state: sessionState } = useStudySession();
  const { userProfile, isPremium: isPremiumUser, isLoading: isUserDataLoading } = useUserData();

  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];
  const primaryLanguage = userLanguages[0] ?? "japanese";

  const streakData = useQuery(
    api.users.getStreak,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  const { videos: adaptiveVideos } = useRecommendedVideos(
    primaryLanguage,
    4,
    isAuthenticated ? userId : undefined
  );

  const { data: allStories } = useStoriesByLanguage(primaryLanguage);

  const { stories: adaptiveStories, reason: storyReason } = useRecommendedStories(
    allStories,
    userProfile,
    primaryLanguage,
    8,
    isAuthenticated ? userId : undefined
  );

  const allProfiles = useQuery(
    api.learnerModel.getAllProfiles,
    isAuthenticated ? { userId } : "skip"
  );

  const profilesByLanguage = new Map((allProfiles ?? []).map((p) => [p.language, p]));

  const getSkillsForLanguage = (lang: ContentLanguage) => {
    const profile = profilesByLanguage.get(lang);
    return (
      profile?.skills ?? {
        vocabulary: 50,
        grammar: 50,
        reading: 50,
        listening: 50,
        writing: 50,
        speaking: 50,
      }
    );
  };

  const getAbilityForLanguage = (lang: ContentLanguage) => {
    const profile = profilesByLanguage.get(lang);
    return profile?.abilityEstimate ?? -0.5;
  };

  const currentStreak = streakData?.currentStreak ?? 0;
  const firstName = user?.displayName?.split(" ")[0] ?? "";

  // Get primary language progress
  const primaryAbility = getAbilityForLanguage(primaryLanguage);
  const primaryProgress = abilityToProgress(primaryAbility, primaryLanguage);
  const primarySkills = getSkillsForLanguage(primaryLanguage);
  const primaryColorScheme = getLanguageColorScheme(0, userLanguages.length || 1);

  return {
    user,
    userId,
    isAuthenticated,
    authLoading,
    isUserDataLoading,
    t,
    sessionState,
    userProfile,
    isPremiumUser,
    userLanguages,
    primaryLanguage,
    streakData,
    currentStreak,
    firstName,
    suggestedStories: adaptiveStories,
    suggestedVideos: adaptiveVideos as VideoItem[],
    storyReason,
    allProfiles,
    profilesByLanguage,
    getSkillsForLanguage,
    getAbilityForLanguage,
    primaryAbility,
    primaryProgress,
    primarySkills,
    primaryColorScheme,
  };
}

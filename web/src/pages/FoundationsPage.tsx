import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

export function FoundationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { userProfile } = useUserData();
  const navigate = useNavigate();
  const t = useT();
  const userId = user?.id ?? "";

  const [isUnlocking, setIsUnlocking] = useState(false);

  // Get the user's primary language
  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];
  const primaryLanguage = userLanguages[0] ?? "japanese";

  // Fetch foundations progress
  const progress = useQuery(
    api.foundations.getProgress,
    isAuthenticated && userId ? { userId } : "skip"
  );

  // Fetch due cards count
  const cardCounts = useQuery(
    api.foundations.getDueCardsCount,
    isAuthenticated && userId ? { userId, language: primaryLanguage } : "skip"
  );

  // Mutation to unlock words
  const unlockWordsMutation = useMutation(api.foundations.unlockWords);

  const handleUnlockWords = async () => {
    if (!userId || isUnlocking) return;
    setIsUnlocking(true);
    try {
      await unlockWordsMutation({ userId });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleStartReview = () => {
    navigate({ to: "/learn", search: { tab: "review" } });
  };

  if (authLoading) {
    return <FoundationsSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">{t("foundations.title")}</h1>
          <p className="text-muted-foreground">{t("common.auth.signInRequired")}</p>
        </div>
      </div>
    );
  }

  // Check if foundations is complete
  if (progress?.isComplete) {
    return <FoundationsComplete progress={progress} />;
  }

  // Empty state - no words unlocked yet
  if (!progress || progress.wordsUnlocked === 0) {
    return <FoundationsEmptyState onGetStarted={handleUnlockWords} isUnlocking={isUnlocking} />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PremiumBackground />

      <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1
            className="text-3xl sm:text-4xl font-semibold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("foundations.title")}
          </h1>
          <p className="text-muted-foreground">{t("foundations.subtitle")}</p>
        </motion.div>

        {/* Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                {t("foundations.progress.percentComplete", {
                  percent: progress?.percentComplete ?? 0,
                })}
              </span>
              <span className="text-sm font-medium text-foreground">
                {progress?.wordsLearned ?? 0} / {progress?.totalWords ?? 100}
              </span>
            </div>
            <Progress value={progress?.percentComplete ?? 0} className="h-3" />
            <div className="flex justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                {t("foundations.progress.wordsUnlocked", {
                  count: progress?.wordsUnlocked ?? 0,
                })}
              </span>
              <span className="text-muted-foreground">
                {t("foundations.progress.storiesUnlocked", {
                  count: progress?.storiesAvailable ?? 0,
                })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Action Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Cards Due */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ActionCard
              icon={Brain}
              iconColor="purple"
              title={t("foundations.cards.dueTitle")}
              description={t("foundations.cards.dueDescription")}
              value={cardCounts?.due ?? 0}
              actionLabel={
                (cardCounts?.due ?? 0) > 0
                  ? t("foundations.cards.startReview")
                  : t("foundations.cards.noCardsDue")
              }
              onAction={(cardCounts?.due ?? 0) > 0 ? handleStartReview : undefined}
              disabled={(cardCounts?.due ?? 0) === 0}
            />
          </motion.div>

          {/* New Words */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ActionCard
              icon={Sparkles}
              iconColor="blue"
              title={t("foundations.cards.newTitle")}
              description={t("foundations.cards.newDescription")}
              value={cardCounts?.new ?? 0}
              actionLabel={t("foundations.cards.startReview")}
              onAction={(cardCounts?.new ?? 0) > 0 ? handleStartReview : undefined}
              disabled={(cardCounts?.new ?? 0) === 0}
            />
          </motion.div>
        </div>

        {/* Unlock More Words */}
        {progress?.canUnlockMore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <div className="relative rounded-2xl backdrop-blur-xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-white/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {t("foundations.unlock.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("foundations.unlock.description", { count: 10 })}
                  </p>
                </div>
                <Button
                  onClick={handleUnlockWords}
                  disabled={isUnlocking}
                  className="bg-gradient-to-r from-orange-500 to-purple-500 text-white hover:opacity-90"
                >
                  {isUnlocking ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {t("foundations.unlock.button")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Micro-Stories Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-400" />
            </div>
            <h2
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("foundations.stories.title")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("foundations.stories.description")}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((storyNum) => {
              const wordsRequired = storyNum * 20;
              const isUnlocked = (progress?.wordsLearned ?? 0) >= wordsRequired;
              const wordsNeeded = wordsRequired - (progress?.wordsLearned ?? 0);

              return (
                <StoryCard
                  key={storyNum}
                  storyNumber={storyNum}
                  isUnlocked={isUnlocked}
                  wordsNeeded={wordsNeeded}
                />
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Action Card Component
function ActionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  value,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: React.ElementType;
  iconColor: "purple" | "blue" | "orange" | "green";
  title: string;
  description: string;
  value: number;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  const colorClasses = {
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
    orange: "bg-orange-500/20 text-orange-400",
    green: "bg-green-500/20 text-green-400",
  };

  return (
    <div className="relative rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/10 p-6 h-full">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl ${colorClasses[iconColor]} flex items-center justify-center`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-3xl font-bold text-foreground">{value}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <Button
        onClick={onAction}
        disabled={disabled}
        variant={disabled ? "ghost" : "default"}
        className="w-full"
      >
        {actionLabel}
        {!disabled && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </div>
  );
}

// Story Card Component
function StoryCard({
  storyNumber,
  isUnlocked,
  wordsNeeded,
}: {
  storyNumber: number;
  isUnlocked: boolean;
  wordsNeeded: number;
}) {
  const t = useT();

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isUnlocked
          ? "bg-white/[0.02] border-white/10 hover:border-white/20"
          : "bg-white/[0.01] border-white/5 opacity-60"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        {isUnlocked ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <Lock className="w-5 h-5 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">
          {t("foundations.stories.storyNumber", { number: storyNumber })}
        </span>
      </div>
      {isUnlocked ? (
        <Button variant="ghost" size="sm" className="w-full mt-2" disabled>
          {t("foundations.stories.comingSoon")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground mt-2">
          {t("foundations.stories.locked", { count: wordsNeeded })}
        </p>
      )}
    </div>
  );
}

// Empty State Component
function FoundationsEmptyState({
  onGetStarted,
  isUnlocking,
}: {
  onGetStarted: () => void;
  isUnlocking: boolean;
}) {
  const t = useT();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PremiumBackground />

      <div className="container mx-auto px-4 sm:px-6 max-w-2xl py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-orange-400" />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-semibold text-foreground mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("foundations.emptyState.title")}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            {t("foundations.emptyState.description")}
          </p>
          <Button
            onClick={onGetStarted}
            disabled={isUnlocking}
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-purple-500 text-white hover:opacity-90 px-8"
          >
            {isUnlocking ? (
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2" />
            )}
            {t("foundations.emptyState.startButton")}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// Completion Component
function FoundationsComplete({
  progress,
}: {
  progress: {
    wordsLearned: number;
    storiesAvailable: number;
  };
}) {
  const t = useT();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PremiumBackground />

      <div className="container mx-auto px-4 sm:px-6 max-w-2xl py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-12 h-12 text-yellow-400" />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-semibold text-foreground mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("foundations.completion.title")}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            {t("foundations.completion.description")}
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">{progress.wordsLearned}</div>
              <div className="text-sm text-muted-foreground">
                {t("foundations.completion.stats.wordsLearned")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">{progress.storiesAvailable}</div>
              <div className="text-sm text-muted-foreground">
                {t("foundations.completion.stats.storiesRead")}
              </div>
            </div>
          </div>

          <Link to="/dashboard">
            <Button size="lg" className="px-8">
              {t("foundations.completion.continueButton")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

// Skeleton Loading State
function FoundationsSkeleton() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <PremiumBackground />

      <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-8 relative z-10">
        {/* Header Skeleton */}
        <div className="text-center mb-8">
          <div className="h-10 bg-white/5 rounded-lg w-48 mx-auto mb-2 animate-pulse" />
          <div className="h-5 bg-white/5 rounded w-64 mx-auto animate-pulse" />
        </div>

        {/* Progress Skeleton */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-6 mb-8">
          <div className="h-4 bg-white/5 rounded w-32 mb-4 animate-pulse" />
          <div className="h-3 bg-white/5 rounded-full animate-pulse" />
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/10 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-8 w-8 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-5 bg-white/5 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-white/5 rounded w-48 mb-4 animate-pulse" />
              <div className="h-10 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Stories Skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-6 bg-white/5 rounded w-32 animate-pulse" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white/[0.02] border border-white/10 p-4">
              <div className="h-5 bg-white/5 rounded w-24 mb-2 animate-pulse" />
              <div className="h-8 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

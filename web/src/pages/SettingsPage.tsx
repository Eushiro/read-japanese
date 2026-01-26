import { Link } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Sun,
  User,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Footer } from "@/components/Footer";
import { Paywall } from "@/components/Paywall";
import { PlacementTestPromptDialog } from "@/components/PlacementTestPromptDialog";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UILanguageSwitcher } from "@/components/UILanguageSwitcher";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { SignInButton, useAuth, UserButton } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useSettings } from "@/hooks/useSettings";
import { isAdmin } from "@/lib/admin";
import { type ContentLanguage, EXAMS_BY_LANGUAGE, LANGUAGES } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { ExamType } from "../../convex/schema";

export function SettingsPage() {
  const { trackEvent, events } = useAnalytics();
  const t = useT();

  // State for dialogs
  const [showPaywall, setShowPaywall] = useState(false);
  const [placementPromptLanguage, setPlacementPromptLanguage] = useState<ContentLanguage | null>(
    null
  );

  const {
    settings,
    isLoading: settingsLoading,
    setShowFurigana,
    setFontSize: updateFontSize,
    setAutoplayAudio: updateAutoplayAudio,
  } = useSettings();

  const { theme, setTheme } = useTheme();

  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();

  // Credit balance
  const {
    used: creditsUsed,
    limit: creditsLimit,
    percentage: creditsPercentage,
    resetDate: creditsResetDate,
    tier: creditsTier,
  } = useCreditBalance();

  // User profile and subscription from shared context (prevents refetching on navigation)
  const { userProfile, subscription, isPremium: isPremiumUser } = useUserData();
  const createPortal = useAction(api.stripe.createPortalSession);

  const updateLanguages = useMutation(api.users.updateLanguages);
  const updateTargetExams = useMutation(api.users.updateTargetExams);
  const upsertUser = useMutation(api.users.upsert);
  const toggleAdminMode = useMutation(api.subscriptions.toggleAdminMode);

  // Initialize user if they don't exist
  useEffect(() => {
    if (isAuthenticated && user && userProfile === null) {
      upsertUser({
        clerkId: user.id,
        email: user.email ?? undefined,
        name: user.displayName ?? undefined,
      });
    }
  }, [isAuthenticated, user, userProfile, upsertUser]);

  const handleLanguageToggle = async (lang: ContentLanguage) => {
    if (!user || !userProfile) return;

    const currentLanguages = userProfile.languages || [];
    const isRemoving = currentLanguages.includes(lang);

    // Don't allow removing all languages
    if (isRemoving && currentLanguages.length <= 1) return;

    // If trying to add a language and user is not premium, show paywall
    if (!isRemoving && !isPremiumUser && currentLanguages.length >= 1) {
      setShowPaywall(true);
      return;
    }

    const newLanguages = isRemoving
      ? currentLanguages.filter((l) => l !== lang)
      : [...currentLanguages, lang];

    await updateLanguages({
      clerkId: user.id,
      languages: newLanguages as ("japanese" | "english" | "french")[],
    });

    trackEvent(events.SETTING_CHANGED, {
      setting: "languages",
      value: newLanguages,
      action: isRemoving ? "remove" : "add",
    });

    // If adding a language (not removing), show placement test prompt
    if (!isRemoving) {
      setPlacementPromptLanguage(lang);
    }
  };

  const handleExamToggle = async (exam: string) => {
    if (!user || !userProfile) return;

    const currentExams = (userProfile.targetExams || []) as ExamType[];
    const examValue = exam as ExamType;
    const newExams = currentExams.includes(examValue)
      ? currentExams.filter((e) => e !== exam)
      : [...currentExams, examValue];

    await updateTargetExams({
      clerkId: user.id,
      targetExams: newExams,
    });

    trackEvent(events.SETTING_CHANGED, {
      setting: "target_exams",
      value: newExams,
      action: currentExams.includes(examValue) ? "remove" : "add",
    });
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    try {
      const result = await createPortal({
        userId: user.id,
        returnUrl: `${window.location.origin}/settings`,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error is handled in AuthContext
    }
  };

  const showFurigana = settings.showFurigana;
  const autoplayAudio = settings.autoplayAudio;
  const fontSize = settings.fontSize;

  const setFontSize = (value: string) => updateFontSize(value);
  const setAutoplayAudio = (value: boolean) => updateAutoplayAudio(value);

  // Show skeleton while auth is loading
  if (authLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen">
      {/* Animated background */}
      <PremiumBackground colorScheme="purple" starCount={5} />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-8 pb-12">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="p-2 rounded-xl bg-purple-500/20"
              >
                <User className="w-5 h-5 text-purple-400" />
              </motion.div>
              <h1
                className="text-3xl sm:text-4xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.title")}
              </h1>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* 1. Subscription & Credits */}
          {isAuthenticated && user && (
            <section className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border rounded-2xl" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

              <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/20">
                      <CreditCard className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h2
                      className="text-lg font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {t("settings.subscription.title")}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Only show Manage button if subscription was created through Stripe */}
                    {"stripeCustomerId" in (subscription ?? {}) &&
                      (subscription as { stripeCustomerId?: string })?.stripeCustomerId && (
                        <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                          {t("common.actions.manage")}
                        </Button>
                      )}
                    <Link
                      to="/settings/usage"
                      className="text-sm text-accent hover:underline flex items-center gap-1"
                    >
                      {t("settings.credits.viewHistory")}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Credit Progress bar */}
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  {/* Plan type indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-base font-semibold">
                      <span
                        className={
                          subscription?.tier === "pro"
                            ? "text-accent"
                            : subscription?.tier === "plus"
                              ? "text-blue-400"
                              : "text-foreground-muted"
                        }
                      >
                        {t(`settings.subscription.tiers.${subscription?.tier || "free"}.name`)}
                      </span>
                      <span className="text-foreground-muted font-normal ml-1">
                        {t("settings.subscription.plan")}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        creditsPercentage >= 95
                          ? "text-rose-500"
                          : creditsPercentage >= 80
                            ? "text-amber-500"
                            : "text-foreground-muted"
                      }`}
                    >
                      {creditsPercentage}% {t("settings.credits.used")}
                    </span>
                  </div>
                  <div className="text-sm text-foreground mb-2">
                    {creditsUsed} / {creditsLimit} {t("settings.credits.creditsUsed")}
                  </div>
                  <Progress
                    value={creditsPercentage}
                    className={
                      creditsPercentage >= 95
                        ? "[&>div]:bg-rose-500"
                        : creditsPercentage >= 80
                          ? "[&>div]:bg-amber-500"
                          : ""
                    }
                  />
                  <p className="text-xs text-foreground-muted mt-2">
                    {t("settings.credits.resets", {
                      date: creditsResetDate
                        ? new Date(creditsResetDate).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                          })
                        : "",
                    })}
                  </p>
                </div>

                {/* Upgrade CTA for free users */}
                {creditsTier === "free" && (
                  <div className="mt-4 p-4 rounded-xl border border-accent/30 bg-accent/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t("settings.credits.upgradeTitle")}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {t("settings.credits.upgradeDescription")}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="glass-accent">
                        <Link to="/pricing">{t("settings.credits.upgrade")}</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 2. Preferences */}
          <section className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border rounded-2xl" />
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

            <div className="relative p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-amber-500/20">
                  <Sun className="w-4 h-4 text-amber-400" />
                </div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("settings.preferences.title")}
                </h2>
              </div>

              {settingsLoading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="flex gap-2">
                    <div className="flex-1 h-10 bg-muted rounded-lg" />
                    <div className="flex-1 h-10 bg-muted rounded-lg" />
                    <div className="flex-1 h-10 bg-muted rounded-lg" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-10 w-full bg-muted rounded-lg" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">
                      {t("settings.appearance.title")}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        onClick={() => setTheme("light")}
                        className="flex-1"
                      >
                        <Sun className="w-4 h-4 mr-2" />
                        {t("settings.appearance.light")}
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        onClick={() => setTheme("dark")}
                        className="flex-1"
                      >
                        <Moon className="w-4 h-4 mr-2" />
                        {t("settings.appearance.dark")}
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        onClick={() => setTheme("system")}
                        className="flex-1"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        {t("settings.appearance.system")}
                      </Button>
                    </div>
                  </div>

                  {/* UI Language */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("settings.uiLanguage.title")}
                    </label>
                    <p className="text-sm text-foreground-muted mb-3">
                      {t("settings.uiLanguage.description")}
                    </p>
                    <UILanguageSwitcher showLabel={false} />
                  </div>

                  {/* Reading Settings */}
                  <div className="pt-2 border-t border-border">
                    <label className="block text-sm font-medium text-foreground mb-4">
                      {t("settings.reading.title")}
                    </label>
                    <div className="space-y-4">
                      {/* Show furigana toggle only if user is studying Japanese */}
                      {userProfile?.languages?.includes("japanese") && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              {showFurigana ? (
                                <Eye className="w-4 h-4 text-foreground-muted" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-foreground-muted" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {t("settings.reading.showFurigana")}
                              </div>
                              <div className="text-sm text-foreground-muted">
                                {t("settings.reading.showFuriganaDescription")}
                              </div>
                            </div>
                          </div>
                          <Switch checked={showFurigana} onCheckedChange={setShowFurigana} />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Volume2 className="w-4 h-4 text-foreground-muted" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {t("settings.reading.autoplayAudio")}
                            </div>
                            <div className="text-sm text-foreground-muted">
                              {t("settings.reading.autoplayAudioDescription")}
                            </div>
                          </div>
                        </div>
                        <Switch checked={autoplayAudio} onCheckedChange={setAutoplayAudio} />
                      </div>

                      <div className="pt-2">
                        <label className="font-medium text-foreground block mb-3">
                          {t("settings.reading.textSize")}
                        </label>
                        <Select value={fontSize} onValueChange={setFontSize}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">{t("settings.reading.small")}</SelectItem>
                            <SelectItem value="medium">{t("settings.reading.medium")}</SelectItem>
                            <SelectItem value="large">{t("settings.reading.large")}</SelectItem>
                            <SelectItem value="x-large">
                              {t("settings.reading.extraLarge")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Languages & Exams */}
          {isAuthenticated && user && (
            <section className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border rounded-2xl" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

              <div className="relative p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-blue-500/20">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2
                    className="text-lg font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("settings.languages.title")}
                  </h2>
                </div>

                {userProfile === undefined ? (
                  // Loading state
                  <div className="space-y-6 animate-pulse">
                    <div>
                      <div className="h-4 w-40 bg-muted rounded mb-3" />
                      <div className="flex gap-2">
                        <div className="h-10 w-28 bg-muted rounded-lg" />
                        <div className="h-10 w-24 bg-muted rounded-lg" />
                        <div className="h-10 w-24 bg-muted rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <div className="h-4 w-32 bg-muted rounded mb-3" />
                      <div className="flex flex-wrap gap-2">
                        <div className="h-8 w-20 bg-muted rounded-lg" />
                        <div className="h-8 w-20 bg-muted rounded-lg" />
                        <div className="h-8 w-20 bg-muted rounded-lg" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Languages */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-foreground mb-3">
                        {t("settings.languages.learningLanguages")}
                      </label>
                      {!isPremiumUser && (userProfile?.languages?.length ?? 0) >= 1 && (
                        <p className="text-xs text-foreground-muted mb-3">
                          {t("settings.languages.premiumHint")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGES.map((lang) => {
                          const isSelected = userProfile?.languages?.includes(lang.value) ?? false;
                          const isLocked =
                            !isSelected &&
                            !isPremiumUser &&
                            (userProfile?.languages?.length ?? 0) >= 1;
                          return (
                            <button
                              key={lang.value}
                              onClick={() => handleLanguageToggle(lang.value)}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                                isSelected
                                  ? "border-accent bg-accent/10 text-accent"
                                  : isLocked
                                    ? "border-border bg-muted/50 text-foreground-muted cursor-pointer"
                                    : "border-border bg-surface text-foreground-muted hover:border-foreground-muted"
                              }`}
                            >
                              {isLocked && <Lock className="w-3 h-3" />}
                              {t(`common.languages.${lang.value}`)}
                              {isSelected && <Check className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Target Exams */}
                    {userProfile?.languages && userProfile.languages.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <GraduationCap className="w-4 h-4 text-foreground-muted" />
                          <label className="block text-sm font-medium text-foreground">
                            {t("settings.languages.targetExams")}
                          </label>
                        </div>
                        <div className="space-y-4">
                          {userProfile.languages.map((lang) => {
                            const langInfo = LANGUAGES.find((l) => l.value === lang);
                            const exams =
                              EXAMS_BY_LANGUAGE[lang as keyof typeof EXAMS_BY_LANGUAGE] || [];

                            return (
                              <div key={lang}>
                                <div className="text-xs font-medium text-foreground-muted mb-2 uppercase tracking-wider">
                                  {langInfo?.label}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {exams.map((exam) => {
                                    const isSelected =
                                      (
                                        userProfile?.targetExams as ExamType[] | undefined
                                      )?.includes(exam.value as ExamType) ?? false;
                                    return (
                                      <button
                                        key={exam.value}
                                        onClick={() => handleExamToggle(exam.value)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                          isSelected
                                            ? "border-accent bg-accent/10 text-accent"
                                            : "border-border bg-surface text-foreground-muted hover:border-foreground-muted"
                                        }`}
                                      >
                                        {exam.label}
                                        {isSelected && <Check className="w-3 h-3 ml-1 inline" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* 4. Account */}
          <section className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border rounded-2xl" />
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

            <div className="relative p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-rose-500/20">
                  <User className="w-4 h-4 text-rose-400" />
                </div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("settings.account.title")}
                </h2>
              </div>
              {authLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-24 bg-muted rounded mb-2" />
                      <div className="h-3 w-40 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-10 w-full bg-muted rounded-lg" />
                </div>
              ) : isAuthenticated && user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "Profile"}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-lg font-semibold text-accent">
                          {user.displayName?.[0] || user.email?.[0] || "?"}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">
                        {user.displayName || "User"}
                      </div>
                      <div className="text-sm text-foreground-muted truncate">{user.email}</div>
                    </div>
                    <UserButton />
                  </div>
                  <Button variant="outline" onClick={handleSignOut} className="w-full">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("common.nav.signOut")}
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-sm text-foreground-muted mb-3">
                    {t("settings.account.signInPrompt")}
                  </p>
                  <SignInButton mode="modal">
                    <Button variant="outline" className="w-full">
                      {t("common.nav.signIn")}
                    </Button>
                  </SignInButton>
                </div>
              )}
            </div>
          </section>

          {/* 5. Admin Settings - for specific users */}
          {isAdmin(user?.email) && (
            <section className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-amber-500/30 rounded-2xl" />
              <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

              {/* eslint-disable i18next/no-literal-string -- Admin-only section */}
              <div className="relative p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <h2
                    className="text-lg font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Admin
                  </h2>
                </div>

                <div className="space-y-5">
                  {/* Admin Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Shield className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">Admin Mode</div>
                        <div className="text-sm text-foreground-muted">
                          Show admin panel and bypass credit limits
                        </div>
                      </div>
                    </div>
                    {/* eslint-enable i18next/no-literal-string */}
                    <Switch
                      checked={userProfile?.isAdminMode ?? false}
                      onCheckedChange={async (checked) => {
                        if (!user) return;
                        await toggleAdminMode({
                          userId: user.id,
                          enabled: checked,
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <Footer />

      {/* Paywall for premium languages */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="additionalLanguages"
        title={t("settings.languages.premiumRequired")}
        description={t("settings.languages.premiumDescription")}
      />

      {/* Placement test prompt dialog */}
      {placementPromptLanguage && (
        <PlacementTestPromptDialog
          isOpen={!!placementPromptLanguage}
          onClose={() => setPlacementPromptLanguage(null)}
          language={placementPromptLanguage}
          onSkip={() => setPlacementPromptLanguage(null)}
        />
      )}
    </div>
  );
}

// Skeleton loading state
function SettingsSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-border w-9 h-9 animate-pulse" />
            <div className="h-9 bg-border rounded-lg w-24 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Settings Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Appearance Section */}
          <section className="bg-surface rounded-2xl border border-border p-6">
            <div className="h-6 bg-border rounded w-28 mb-4 animate-pulse" />
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-border rounded-lg animate-pulse" />
              <div className="flex-1 h-10 bg-border rounded-lg animate-pulse" />
              <div className="flex-1 h-10 bg-border rounded-lg animate-pulse" />
            </div>
          </section>

          {/* Account Section */}
          <section className="bg-surface rounded-2xl border border-border p-6">
            <div className="h-6 bg-border rounded w-20 mb-4 animate-pulse" />
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-border animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 bg-border rounded w-32 animate-pulse" />
                <div className="h-4 bg-border rounded w-48 animate-pulse" />
              </div>
            </div>
          </section>

          {/* Languages Section */}
          <section className="bg-surface rounded-2xl border border-border p-6">
            <div className="h-6 bg-border rounded w-24 mb-4 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 bg-border rounded-lg w-28 animate-pulse" />
              <div className="h-10 bg-border rounded-lg w-24 animate-pulse" />
              <div className="h-10 bg-border rounded-lg w-24 animate-pulse" />
            </div>
          </section>

          {/* Reading Settings Section */}
          <section className="bg-surface rounded-2xl border border-border p-6">
            <div className="h-6 bg-border rounded w-36 mb-4 animate-pulse" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-border rounded w-32 animate-pulse" />
                <div className="h-6 w-11 bg-border rounded-full animate-pulse" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-5 bg-border rounded w-28 animate-pulse" />
                <div className="h-6 w-11 bg-border rounded-full animate-pulse" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

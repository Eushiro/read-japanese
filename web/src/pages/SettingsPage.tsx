import { Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Activity,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Compass,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Languages,
  Layers,
  LogOut,
  Monitor,
  Moon,
  PenLine,
  Shield,
  Sparkles,
  Sun,
  User,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
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
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useSettings } from "@/hooks/useSettings";
import { useT } from "@/lib/i18n";
import { EXAMS_BY_LANGUAGE, type Language, LANGUAGES } from "@/lib/languages";

import { api } from "../../convex/_generated/api";
import type { ExamType } from "../../convex/schema";

export function SettingsPage() {
  const navigate = useNavigate();
  const { trackEvent, events } = useAnalytics();
  const t = useT();

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

  // Subscription data
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const createPortal = useAction(api.stripe.createPortalSession);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // User profile data
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );
  const updateLanguages = useMutation(api.users.updateLanguages);
  const updateTargetExams = useMutation(api.users.updateTargetExams);
  const updateProficiencyLevel = useMutation(api.users.updateProficiencyLevel);
  const upsertUser = useMutation(api.users.upsert);
  const upsertSubscription = useMutation(api.subscriptions.upsert);
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

  const handleLanguageToggle = async (lang: Language) => {
    if (!user || !userProfile) return;

    const currentLanguages = userProfile.languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter((l) => l !== lang)
      : [...currentLanguages, lang];

    // Don't allow removing all languages
    if (newLanguages.length === 0) return;

    await updateLanguages({
      clerkId: user.id,
      languages: newLanguages as ("japanese" | "english" | "french")[],
    });

    trackEvent(events.SETTING_CHANGED, {
      setting: "languages",
      value: newLanguages,
      action: currentLanguages.includes(lang) ? "remove" : "add",
    });
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

  const handleUpgrade = async (tier: "plus" | "pro") => {
    if (!user || checkoutLoading) return;

    trackEvent(events.UPGRADE_CLICKED, {
      tier,
      current_tier: subscription?.tier ?? "free",
    });

    setCheckoutLoading(tier);
    try {
      const result = await createCheckout({
        userId: user.id,
        tier,
        successUrl: `${window.location.origin}/settings?success=true`,
        cancelUrl: `${window.location.origin}/settings?canceled=true`,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setCheckoutLoading(null);
    }
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
      {/* Hero Section */}
      <div className="border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-background to-accent/5" />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl relative">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-accent/20">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <h1
                className="text-3xl sm:text-4xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.title")}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Theme */}
          <section className="bg-gradient-to-br from-amber-500/5 to-surface rounded-2xl border border-amber-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-500/15">
                <Sun className="w-4 h-4 text-amber-400" />
              </div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.appearance.title")}
              </h2>
            </div>
            {settingsLoading ? (
              <div className="flex gap-2 animate-pulse">
                <div className="flex-1 h-10 bg-muted rounded-lg" />
                <div className="flex-1 h-10 bg-muted rounded-lg" />
                <div className="flex-1 h-10 bg-muted rounded-lg" />
              </div>
            ) : (
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
            )}
          </section>

          {/* Display Language */}
          <section className="bg-gradient-to-br from-violet-500/5 to-surface rounded-2xl border border-violet-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-violet-500/15">
                <Languages className="w-4 h-4 text-violet-400" />
              </div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.uiLanguage.title")}
              </h2>
            </div>
            <p className="text-sm text-foreground-muted mb-4">
              {t("settings.uiLanguage.description")}
            </p>
            <UILanguageSwitcher showLabel={false} />
          </section>

          {/* Learning Tools */}
          {isAuthenticated && (
            <section className="bg-gradient-to-br from-accent/5 to-surface rounded-2xl border border-accent/20 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-accent/15">
                  <Compass className="w-4 h-4 text-accent" />
                </div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("settings.learningTools.title")}
                </h2>
              </div>
              <p className="text-sm text-foreground-muted mb-4">
                {t("settings.learningTools.description")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/learn"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-accent/10">
                    <BookOpen className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {t("settings.learningTools.learnHub")}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {t("settings.learningTools.learnHubDescription")}
                    </div>
                  </div>
                </Link>
                <Link
                  to="/flashcards"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Layers className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {t("settings.learningTools.flashcards")}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {t("settings.learningTools.flashcardsDescription")}
                    </div>
                  </div>
                </Link>
                <Link
                  to="/vocabulary"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <BookOpen className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {t("settings.learningTools.vocabulary")}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {t("settings.learningTools.vocabularyDescription")}
                    </div>
                  </div>
                </Link>
                <Link
                  to="/practice"
                  search={{ vocabularyId: undefined }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <PenLine className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {t("settings.learningTools.practice")}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {t("settings.learningTools.practiceDescription")}
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          )}

          {/* Reading */}
          <section className="bg-gradient-to-br from-emerald-500/5 to-surface rounded-2xl border border-emerald-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-500/15">
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.reading.title")}
              </h2>
            </div>

            {settingsLoading ? (
              // Loading state to avoid flickering defaults
              <div className="space-y-5 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div>
                      <div className="h-4 w-28 bg-muted rounded mb-2" />
                      <div className="h-3 w-40 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-muted rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div>
                      <div className="h-4 w-28 bg-muted rounded mb-2" />
                      <div className="h-3 w-44 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-muted rounded-full" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-20 bg-muted rounded" />
                  <div className="w-full h-12 bg-muted rounded-lg" />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
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

                <div className="space-y-3">
                  <label className="font-medium text-foreground">
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
                      <SelectItem value="x-large">{t("settings.reading.extraLarge")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* Languages & Exams */}
          {isAuthenticated && user && (
            <section className="bg-gradient-to-br from-blue-500/5 to-surface rounded-2xl border border-blue-500/20 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
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
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => {
                        const isSelected = userProfile?.languages?.includes(lang.value) ?? false;
                        return (
                          <button
                            key={lang.value}
                            onClick={() => handleLanguageToggle(lang.value)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              isSelected
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border bg-surface text-foreground-muted hover:border-foreground-muted"
                            }`}
                          >
                            <span className="mr-2">{lang.flag}</span>
                            {lang.label}
                            {isSelected && <Check className="w-4 h-4 ml-2 inline" />}
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
                                {langInfo?.flag} {langInfo?.label}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {exams.map((exam) => {
                                  const isSelected =
                                    (userProfile?.targetExams as ExamType[] | undefined)?.includes(
                                      exam.value as ExamType
                                    ) ?? false;
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
            </section>
          )}

          {/* Placement Test */}
          {isAuthenticated && user && userProfile && (
            <section className="bg-gradient-to-br from-purple-500/5 to-surface rounded-2xl border border-purple-500/20 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-purple-500/15">
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("settings.proficiency.title")}
                </h2>
              </div>

              <p className="text-sm text-foreground-muted mb-4">
                {t("settings.proficiency.description")}
              </p>

              <div className="space-y-3">
                {userProfile.languages?.map((lang) => {
                  const langInfo = LANGUAGES.find((l) => l.value === lang);
                  const proficiency =
                    userProfile.proficiencyLevels?.[
                      lang as keyof typeof userProfile.proficiencyLevels
                    ];

                  return (
                    <div
                      key={lang}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{langInfo?.flag}</span>
                        <div>
                          <div className="font-medium text-foreground">{langInfo?.label}</div>
                          {proficiency ? (
                            <div className="text-sm text-foreground-muted">
                              {t("settings.proficiency.level")}:{" "}
                              <span className="font-semibold text-accent">{proficiency.level}</span>
                              <span className="text-xs ml-2">
                                (
                                {t("settings.proficiency.tested", {
                                  date: new Date(proficiency.assessedAt).toLocaleDateString(),
                                })}
                                )
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-foreground-muted">
                              {t("settings.proficiency.notAssessed")}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate({ to: "/placement-test", search: { language: lang } })
                        }
                      >
                        {proficiency
                          ? t("settings.proficiency.retake")
                          : t("settings.proficiency.takeTest")}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Account */}
          <section className="bg-gradient-to-br from-rose-500/5 to-surface rounded-2xl border border-rose-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-rose-500/15">
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
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
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
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
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
              <div className="p-4 rounded-xl bg-muted/50">
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
          </section>

          {/* Subscription */}
          {isAuthenticated && user && (
            <section className="bg-gradient-to-br from-cyan-500/5 to-surface rounded-2xl border border-cyan-500/20 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-cyan-500/15">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                </div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("settings.subscription.title")}
                </h2>
              </div>

              {/* Current Plan */}
              <div className="p-4 rounded-xl bg-muted/50 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm text-foreground-muted">
                      {t("settings.subscription.currentPlan")}
                    </div>
                    <div className="text-lg font-semibold text-foreground capitalize">
                      {subscription?.tier || t("settings.subscription.free")}
                    </div>
                  </div>
                  {/* Only show Manage button if subscription was created through Stripe */}
                  {"stripeCustomerId" in (subscription ?? {}) &&
                    (subscription as { stripeCustomerId?: string })?.stripeCustomerId && (
                      <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                        {t("common.actions.manage")}
                      </Button>
                    )}
                </div>

                {/* Show benefits for paid subscribers */}
                {subscription?.tier === "plus" && (
                  <ul className="text-sm text-foreground-muted space-y-1.5 pt-3 border-t border-border">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-500" /> 500 AI credits/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-500" /> Up to 500 flashcard sentences
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-500" /> Up to 250 audio generations
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-500" /> Unlimited decks
                    </li>
                  </ul>
                )}
                {subscription?.tier === "pro" && (
                  <ul className="text-sm text-foreground-muted space-y-1.5 pt-3 border-t border-border">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" /> 2,000 AI credits/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" /> Up to 2,000 flashcard sentences
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" /> Up to 1,000 audio generations
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" /> Priority support
                    </li>
                  </ul>
                )}
              </div>

              {/* Upgrade Options */}
              {(!subscription?.tier || subscription.tier === "free") && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground-muted">
                    {t("settings.subscription.upgradePlan")}
                  </h3>
                  <div className="grid gap-4">
                    {/* Plus */}
                    <div className="p-5 rounded-xl border border-border hover:border-blue-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-500" />
                          <span className="font-semibold text-foreground text-lg">Plus</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground">$7.99</span>
                          <span className="text-foreground-muted">/mo</span>
                        </div>
                      </div>
                      <ul className="text-sm text-foreground-muted space-y-1.5 mb-4">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-500" /> 500 AI credits/month
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-500" /> Unlimited custom decks
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-blue-500" /> Progress tracking
                        </li>
                      </ul>
                      <Button
                        variant="outline"
                        className={`w-full ${checkoutLoading === "plus" ? "btn-loading-gradient" : ""}`}
                        onClick={() => handleUpgrade("plus")}
                      >
                        Upgrade to Plus
                      </Button>
                    </div>

                    {/* Pro */}
                    <div className="p-5 rounded-xl border-2 border-accent bg-accent/5 relative">
                      <div className="absolute -top-3 left-4">
                        <span className="text-xs px-3 py-1 rounded-full bg-accent text-white font-medium">
                          {t("settings.subscription.mostPopular")}
                        </span>
                      </div>
                      <div className="flex items-start justify-between mb-3 mt-1">
                        <div className="flex items-center gap-2">
                          <Crown className="w-5 h-5 text-accent" />
                          <span className="font-semibold text-foreground text-lg">Pro</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground">$17.99</span>
                          <span className="text-foreground-muted">/mo</span>
                        </div>
                      </div>
                      <ul className="text-sm text-foreground-muted space-y-1.5 mb-4">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-accent" /> 2,000 AI credits/month
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-accent" /> Everything in Plus
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-accent" /> Priority support
                        </li>
                      </ul>
                      <Button
                        className={`w-full ${checkoutLoading === "pro" ? "btn-loading-gradient" : ""}`}
                        onClick={() => handleUpgrade("pro")}
                      >
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>

                  {/* View all plans link */}
                  <div className="text-center">
                    <Link
                      to="/pricing"
                      className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
                    >
                      {t("paywall.viewAllPlans")}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Credit Usage (New Unified System) */}
          {isAuthenticated && user && (
            <section className="bg-gradient-to-br from-indigo-500/5 to-surface rounded-2xl border border-indigo-500/20 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/15">
                    <Activity className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2
                    className="text-lg font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("settings.credits.title")}
                  </h2>
                </div>
                <Link
                  to="/settings/usage"
                  className="text-sm text-accent hover:underline flex items-center gap-1"
                >
                  {t("settings.credits.viewHistory")}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <p className="text-sm text-foreground-muted mb-4">
                {t("settings.credits.description")}
              </p>

              {/* Progress bar */}
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-foreground">
                    {creditsUsed} / {creditsLimit} {t("settings.credits.creditsUsed")}
                  </span>
                  <span
                    className={`font-medium ${
                      creditsPercentage >= 95
                        ? "text-rose-500"
                        : creditsPercentage >= 80
                          ? "text-amber-500"
                          : "text-foreground-muted"
                    }`}
                  >
                    {creditsPercentage}%
                  </span>
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-foreground-muted">
                    {t("settings.credits.resets", {
                      date: creditsResetDate
                        ? new Date(creditsResetDate).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                          })
                        : "",
                    })}
                  </p>
                  <span className="text-xs text-foreground-muted capitalize">
                    {creditsTier} {t("settings.credits.tier")}
                  </span>
                </div>
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
                    <Button asChild size="sm">
                      <Link to="/pricing">{t("settings.credits.upgrade")}</Link>
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Admin Settings - for specific users */}
          {user?.email === "hiro.ayettey@gmail.com" && (
            <section className="bg-surface rounded-2xl border border-amber-500/30 p-6 shadow-sm">
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
                        Bypass credit limits and unlock image generation
                      </div>
                    </div>
                  </div>
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

                {/* Tier Selection */}
                <div className="flex items-center justify-between pt-4 border-t border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Crown className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Subscription Tier</div>
                      <div className="text-sm text-foreground-muted">
                        Change tier for testing features
                      </div>
                    </div>
                  </div>
                  <Select
                    value={subscription?.tier ?? "free"}
                    onValueChange={async (value) => {
                      if (!user) return;
                      await upsertSubscription({
                        userId: user.id,
                        tier: value as "free" | "plus" | "pro",
                      });
                    }}
                  >
                    <SelectTrigger className="w-32 border-amber-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (50 credits)</SelectItem>
                      <SelectItem value="plus">Plus (500 credits)</SelectItem>
                      <SelectItem value="pro">Pro (2000 credits)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Level Override */}
                <div className="pt-4 border-t border-amber-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <GraduationCap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Level Override</div>
                      <div className="text-sm text-foreground-muted">
                        Manually set proficiency level for testing questions
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 ml-11">
                    {userProfile?.languages?.map((lang) => {
                      const langInfo = LANGUAGES.find((l) => l.value === lang);
                      const currentLevel =
                        userProfile.proficiencyLevels?.[
                          lang as keyof typeof userProfile.proficiencyLevels
                        ]?.level;
                      const levels =
                        lang === "japanese"
                          ? ["N5", "N4", "N3", "N2", "N1"]
                          : ["A1", "A2", "B1", "B2", "C1", "C2"];

                      return (
                        <div key={lang} className="flex items-center gap-3">
                          <span className="text-sm w-20">
                            {langInfo?.flag} {langInfo?.label}
                          </span>
                          <Select
                            value={currentLevel ?? "not_set"}
                            onValueChange={async (value) => {
                              if (!user || value === "not_set") return;
                              await updateProficiencyLevel({
                                clerkId: user.id,
                                language: lang as "japanese" | "english" | "french",
                                level: value,
                              });
                            }}
                          >
                            <SelectTrigger className="flex-1 h-8 text-sm border-amber-500/30">
                              <SelectValue placeholder="Not set" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_set">Not set</SelectItem>
                              {levels.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Show Onboarding */}
                <div className="pt-4 border-t border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">Show Onboarding</div>
                        <div className="text-sm text-foreground-muted">
                          Preview the onboarding flow
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.href = "/settings?onboarding=true";
                      }}
                    >
                      Show
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* About */}
          <section className="bg-gradient-to-br from-slate-500/5 to-surface rounded-2xl border border-slate-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-slate-500/15">
                <Sparkles className="w-4 h-4 text-slate-400" />
              </div>
              <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("settings.about.title")}
              </h2>
            </div>
            <div className="text-sm text-foreground-muted space-y-1">
              <p className="font-medium text-foreground">{t("settings.about.version")}</p>
              <p>{t("settings.about.description")}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Skeleton loading state
function SettingsSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-border w-9 h-9 animate-pulse" />
            <div className="h-9 bg-border rounded-lg w-24 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Settings Content Skeleton */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
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

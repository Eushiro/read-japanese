import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun, Monitor, Volume2, Eye, EyeOff, Crown, User, LogOut, CreditCard, Zap, Check, Globe, GraduationCap, Sparkles, Brain, ChevronRight, BookOpen, Layers, PenLine, Compass } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth, SignInButton, UserButton } from "@/contexts/AuthContext";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LANGUAGES, EXAMS_BY_LANGUAGE, type Language } from "@/lib/languages";

export function SettingsPage() {
  const navigate = useNavigate();
  const { trackEvent, events } = useAnalytics();

  const {
    settings,
    isLoading: settingsLoading,
    setShowFurigana,
    setFontSize: updateFontSize,
    setAutoplayAudio: updateAutoplayAudio,
    userId,
  } = useSettings();

  const { theme, setTheme } = useTheme();

  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();

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

    const currentExams = userProfile.targetExams || [];
    const newExams = currentExams.includes(exam as any)
      ? currentExams.filter((e) => e !== exam)
      : [...currentExams, exam];

    await updateTargetExams({
      clerkId: user.id,
      targetExams: newExams as any[],
    });

    trackEvent(events.SETTING_CHANGED, {
      setting: "target_exams",
      value: newExams,
      action: currentExams.includes(exam as any) ? "remove" : "add",
    });
  };

  const handleUpgrade = async (tier: "basic" | "pro" | "unlimited") => {
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

  const isPremiumUser = subscription?.tier && subscription.tier !== "free";

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
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Profile
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
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Appearance
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
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  className="flex-1"
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => setTheme("system")}
                  className="flex-1"
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  System
                </Button>
              </div>
            )}
          </section>

          {/* Learning Tools */}
          {isAuthenticated && (
            <section className="bg-gradient-to-br from-accent/5 to-surface rounded-2xl border border-accent/20 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-accent/15">
                  <Compass className="w-4 h-4 text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Learning Tools
                </h2>
              </div>
              <p className="text-sm text-foreground-muted mb-4">
                Quick access to all learning features
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
                    <div className="font-medium text-foreground text-sm">Learn Hub</div>
                    <div className="text-xs text-foreground-muted">All tools in one place</div>
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
                    <div className="font-medium text-foreground text-sm">Flashcards</div>
                    <div className="text-xs text-foreground-muted">Spaced repetition</div>
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
                    <div className="font-medium text-foreground text-sm">Vocabulary</div>
                    <div className="text-xs text-foreground-muted">Word list</div>
                  </div>
                </Link>
                <Link
                  to="/practice"
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <PenLine className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">Practice</div>
                    <div className="text-xs text-foreground-muted">Sentence writing</div>
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
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Reading
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
                        <div className="font-medium text-foreground">Show Furigana</div>
                        <div className="text-sm text-foreground-muted">
                          Display readings above kanji
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={showFurigana}
                      onCheckedChange={setShowFurigana}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Volume2 className="w-4 h-4 text-foreground-muted" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Autoplay Audio</div>
                      <div className="text-sm text-foreground-muted">
                        Automatically play chapter audio
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={autoplayAudio}
                    onCheckedChange={setAutoplayAudio}
                  />
                </div>

                <div className="space-y-3">
                  <label className="font-medium text-foreground">Text Size</label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="x-large">Extra Large</SelectItem>
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
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Languages & Exams
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
                      Languages you're learning
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
                          Target exams
                        </label>
                      </div>
                      <div className="space-y-4">
                        {userProfile.languages.map((lang) => {
                          const langInfo = LANGUAGES.find((l) => l.value === lang);
                          const exams = EXAMS_BY_LANGUAGE[lang as keyof typeof EXAMS_BY_LANGUAGE] || [];

                          return (
                            <div key={lang}>
                              <div className="text-xs font-medium text-foreground-muted mb-2 uppercase tracking-wider">
                                {langInfo?.flag} {langInfo?.label}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {exams.map((exam) => {
                                  const isSelected = userProfile?.targetExams?.includes(exam.value as any) ?? false;
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
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Proficiency Level
                </h2>
              </div>

              <p className="text-sm text-foreground-muted mb-4">
                Take an adaptive placement test to assess your level and get personalized content.
              </p>

              <div className="space-y-3">
                {userProfile.languages?.map((lang) => {
                  const langInfo = LANGUAGES.find((l) => l.value === lang);
                  const proficiency = userProfile.proficiencyLevels?.[lang as keyof typeof userProfile.proficiencyLevels];

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
                              Level: <span className="font-semibold text-accent">{proficiency.level}</span>
                              <span className="text-xs ml-2">
                                (tested {new Date(proficiency.assessedAt).toLocaleDateString()})
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-foreground-muted">Not assessed yet</div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: "/placement-test", search: { language: lang } })}
                      >
                        {proficiency ? "Retake" : "Take Test"}
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
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Account
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
                    <div className="text-sm text-foreground-muted truncate">
                      {user.email}
                    </div>
                  </div>
                  <UserButton />
                </div>
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-foreground-muted mb-3">
                  Sign in to sync your vocabulary and reading progress across devices.
                </p>
                <SignInButton mode="modal">
                  <Button variant="outline" className="w-full">
                    Sign In
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
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Subscription
                </h2>
              </div>

              {/* Current Plan */}
              <div className="p-4 rounded-xl bg-muted/50 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm text-foreground-muted">Current Plan</div>
                    <div className="text-lg font-semibold text-foreground capitalize">
                      {subscription?.tier || "Free"}
                    </div>
                  </div>
                  {/* Only show Manage button if subscription was created through Stripe */}
                  {subscription?.stripeCustomerId && (
                    <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                      Manage
                    </Button>
                  )}
                </div>

                {/* Show benefits for paid subscribers */}
                {subscription?.tier === "basic" && (
                  <ul className="text-sm text-foreground-muted space-y-1.5 pt-3 border-t border-border">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> 5 AI stories/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> 200 AI checks/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> 500 flashcards/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> 2 mock tests/month</li>
                  </ul>
                )}
                {subscription?.tier === "pro" && (
                  <ul className="text-sm text-foreground-muted space-y-1.5 pt-3 border-t border-border">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 20 AI stories/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 1,000 AI checks/month</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> Unlimited flashcards</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 10 mock tests/month</li>
                  </ul>
                )}
                {subscription?.tier === "unlimited" && (
                  <ul className="text-sm text-foreground-muted space-y-1.5 pt-3 border-t border-border">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited AI stories</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited AI checks</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited flashcards</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited mock tests</li>
                  </ul>
                )}
              </div>

              {/* Upgrade Options */}
              {(!subscription?.tier || subscription.tier === "free") && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground-muted">Upgrade your plan</h3>
                  <div className="grid gap-4">
                    {/* Basic */}
                    <div className="p-5 rounded-xl border border-border hover:border-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-blue-500" />
                          <span className="font-semibold text-foreground text-lg">Basic</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground">$5</span>
                          <span className="text-foreground-muted">/mo</span>
                        </div>
                      </div>
                      <ul className="text-sm text-foreground-muted space-y-1.5 mb-4">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 5 AI stories/month</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 200 AI checks/month</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 500 flashcards/month</li>
                      </ul>
                      <Button
                        variant="outline"
                        className={`w-full ${checkoutLoading === "basic" ? "btn-loading-gradient" : ""}`}
                        onClick={() => handleUpgrade("basic")}
                                              >
                        Get Basic
                      </Button>
                    </div>

                    {/* Pro */}
                    <div className="p-5 rounded-xl border-2 border-accent bg-accent/5 relative">
                      <div className="absolute -top-3 left-4">
                        <span className="text-xs px-3 py-1 rounded-full bg-accent text-white font-medium">
                          Most Popular
                        </span>
                      </div>
                      <div className="flex items-start justify-between mb-3 mt-1">
                        <div className="flex items-center gap-2">
                          <Crown className="w-5 h-5 text-accent" />
                          <span className="font-semibold text-foreground text-lg">Pro</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground">$15</span>
                          <span className="text-foreground-muted">/mo</span>
                        </div>
                      </div>
                      <ul className="text-sm text-foreground-muted space-y-1.5 mb-4">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 20 AI stories/month</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 1,000 AI checks/month</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> Unlimited flashcards</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> 10 mock tests/month</li>
                      </ul>
                      <Button
                        className={`w-full ${checkoutLoading === "pro" ? "btn-loading-gradient" : ""}`}
                        onClick={() => handleUpgrade("pro")}
                                              >
                        Get Pro
                      </Button>
                    </div>

                    {/* Unlimited */}
                    <div className="p-5 rounded-xl border border-border bg-gradient-to-b from-purple-500/5 to-transparent hover:border-purple-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-500" />
                          <span className="font-semibold text-foreground text-lg">Unlimited</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground">$45</span>
                          <span className="text-foreground-muted">/mo</span>
                        </div>
                      </div>
                      <ul className="text-sm text-foreground-muted space-y-1.5 mb-4">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited AI stories</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited AI checks</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited flashcards</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Unlimited mock tests</li>
                      </ul>
                      <Button
                        variant="outline"
                        className={`w-full border-purple-500/30 hover:bg-purple-500/10 ${checkoutLoading === "unlimited" ? "btn-loading-gradient" : ""}`}
                        onClick={() => handleUpgrade("unlimited")}
                                              >
                        Get Unlimited
                      </Button>
                    </div>
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
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Admin
                </h2>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Crown className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Premium Access</div>
                      <div className="text-sm text-foreground-muted">
                        Toggle Pro subscription for testing
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isPremiumUser}
                    onCheckedChange={async (checked) => {
                      if (!user) return;
                      await upsertSubscription({
                        userId: user.id,
                        tier: checked ? "pro" : "free",
                      });
                    }}
                    className="data-[state=checked]:bg-amber-500"
                  />
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
                      const currentLevel = userProfile.proficiencyLevels?.[lang as keyof typeof userProfile.proficiencyLevels]?.level;
                      const levels = lang === "japanese"
                        ? ["N5", "N4", "N3", "N2", "N1"]
                        : ["A1", "A2", "B1", "B2", "C1", "C2"];

                      return (
                        <div key={lang} className="flex items-center gap-3">
                          <span className="text-sm w-20">{langInfo?.flag} {langInfo?.label}</span>
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
                                <SelectItem key={level} value={level}>{level}</SelectItem>
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
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                About
              </h2>
            </div>
            <div className="text-sm text-foreground-muted space-y-1">
              <p className="font-medium text-foreground">SanLang v1.0.0</p>
              <p>Personalized exam prep powered by AI</p>
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

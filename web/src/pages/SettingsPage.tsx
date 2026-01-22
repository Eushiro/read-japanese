import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, Volume2, Eye, EyeOff, Settings, Crown, Code, Users, LogOut, Loader2, CreditCard, Zap, Check, Globe, GraduationCap, Sparkles } from "lucide-react";
import { useSettings, isDevUserEnabled, setDevUserEnabled } from "@/hooks/useSettings";
import { useAuth, SignInButton, UserButton } from "@/contexts/AuthContext";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Language and exam options
const LANGUAGES = [
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "english", label: "English", flag: "🇬🇧" },
  { value: "french", label: "French", flag: "🇫🇷" },
] as const;

const EXAMS_BY_LANGUAGE = {
  japanese: [
    { value: "jlpt_n5", label: "JLPT N5" },
    { value: "jlpt_n4", label: "JLPT N4" },
    { value: "jlpt_n3", label: "JLPT N3" },
    { value: "jlpt_n2", label: "JLPT N2" },
    { value: "jlpt_n1", label: "JLPT N1" },
  ],
  english: [
    { value: "toefl", label: "TOEFL" },
    { value: "sat", label: "SAT" },
    { value: "gre", label: "GRE" },
  ],
  french: [
    { value: "delf_a1", label: "DELF A1" },
    { value: "delf_a2", label: "DELF A2" },
    { value: "delf_b1", label: "DELF B1" },
    { value: "delf_b2", label: "DELF B2" },
    { value: "dalf_c1", label: "DALF C1" },
    { value: "dalf_c2", label: "DALF C2" },
    { value: "tcf", label: "TCF" },
  ],
} as const;

type Language = typeof LANGUAGES[number]["value"];

type Theme = "light" | "dark" | "system";

export function SettingsPage() {
  const {
    settings,
    isLoading: settingsLoading,
    setShowFurigana,
    setTheme: updateTheme,
    setFontSize: updateFontSize,
    setAutoplayAudio: updateAutoplayAudio,
    userId,
  } = useSettings();

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
  };

  const handleUpgrade = async (tier: "basic" | "pro" | "unlimited") => {
    if (!user) return;
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

  const [devUserToggle, setDevUserToggle] = useState(() => isDevUserEnabled());

  const isDev = import.meta.env.DEV;
  const theme = settings.theme as Theme;
  const showFurigana = settings.showFurigana;
  const autoplayAudio = settings.autoplayAudio;
  const fontSize = settings.fontSize;

  const setTheme = (value: Theme) => updateTheme(value);
  const setFontSize = (value: string) => updateFontSize(value);
  const setAutoplayAudio = (value: boolean) => updateAutoplayAudio(value);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Settings className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                Preferences
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
              Settings
            </h1>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Theme */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Appearance
            </h2>
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

          {/* Reading */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Reading
            </h2>

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
                    <button
                      onClick={() => setShowFurigana(!showFurigana)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showFurigana ? "bg-accent" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          showFurigana ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
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
                  <button
                    onClick={() => setAutoplayAudio(!autoplayAudio)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoplayAudio ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        autoplayAudio ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="font-medium text-foreground">Text Size</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="x-large">Extra Large</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Languages & Exams */}
          {isAuthenticated && user && (
            <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-accent" />
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

          {/* Account */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Account
            </h2>
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
            <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Subscription
                </h2>
              </div>

              {/* Current Plan */}
              <div className="p-4 rounded-xl bg-muted/50 mb-6">
                <div className="flex items-center justify-between">
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
                        className="w-full"
                        onClick={() => handleUpgrade("basic")}
                        disabled={checkoutLoading === "basic"}
                      >
                        {checkoutLoading === "basic" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Basic"}
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
                        className="w-full"
                        onClick={() => handleUpgrade("pro")}
                        disabled={checkoutLoading === "pro"}
                      >
                        {checkoutLoading === "pro" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Pro"}
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
                        className="w-full border-purple-500/30 hover:bg-purple-500/10"
                        onClick={() => handleUpgrade("unlimited")}
                        disabled={checkoutLoading === "unlimited"}
                      >
                        {checkoutLoading === "unlimited" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Unlimited"}
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
                  <button
                    onClick={async () => {
                      if (!user) return;
                      await upsertSubscription({
                        userId: user.id,
                        tier: isPremiumUser ? "free" : "pro",
                      });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isPremiumUser ? "bg-amber-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        isPremiumUser ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Developer Settings - only visible in development */}
          {isDev && (
            <section className="bg-surface rounded-2xl border border-amber-500/30 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Code className="w-4 h-4 text-amber-500" />
                <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  Developer
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                  DEV ONLY
                </span>
              </div>

              <div className="space-y-5">
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

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Users className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Shared Dev User</div>
                      <div className="text-sm text-foreground-muted">
                        Use shared user for Convex sync testing
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        User ID: {userId}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDevUserToggle(!devUserToggle);
                      setDevUserEnabled(!devUserToggle);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      devUserToggle ? "bg-amber-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        devUserToggle ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* About */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              About
            </h2>
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

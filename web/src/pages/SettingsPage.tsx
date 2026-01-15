import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, Volume2, Eye, EyeOff, Settings, Crown, Code, Users, LogOut, Loader2 } from "lucide-react";
import { useSettings, isDevUserEnabled, setDevUserEnabled } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";

type Theme = "light" | "dark" | "system";

export function SettingsPage() {
  const {
    settings,
    setShowFurigana,
    setTheme: updateTheme,
    setFontSize: updateFontSize,
    setAutoplayAudio: updateAutoplayAudio,
    userId,
  } = useSettings();

  const { user, isAuthenticated, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error is handled in AuthContext
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error is handled in AuthContext
    }
  };

  const [isPremiumUser, setIsPremiumUser] = useState(() => {
    return localStorage.getItem("isPremiumUser") === "true";
  });

  const [devUserToggle, setDevUserToggle] = useState(() => isDevUserEnabled());

  const isDev = import.meta.env.DEV;
  const theme = settings.theme as Theme;
  const showFurigana = settings.showFurigana;
  const autoplayAudio = settings.autoplayAudio;
  const fontSize = settings.fontSize;

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  // Save premium setting to localStorage (dev only)
  useEffect(() => {
    localStorage.setItem("isPremiumUser", String(isPremiumUser));
  }, [isPremiumUser]);

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
          </section>

          {/* Reading */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Reading
            </h2>

            <div className="space-y-5">
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
          </section>

          {/* Account */}
          <section className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Account
            </h2>
            {authLoading ? (
              <div className="p-4 rounded-xl bg-muted/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
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
                <Button
                  variant="outline"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="w-full"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </Button>
              </div>
            )}
          </section>

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
                      <Crown className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Premium Access</div>
                      <div className="text-sm text-foreground-muted">
                        Unlock all premium stories
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPremiumUser(!isPremiumUser)}
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
              <p className="font-medium text-foreground">Read Japanese Web v1.0.0</p>
              <p>Learn Japanese through graded readers</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

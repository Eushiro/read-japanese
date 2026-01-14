import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor, Volume2, Eye, EyeOff, Settings, Crown, Code } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

type Theme = "light" | "dark" | "system";

export function SettingsPage() {
  const {
    settings,
    setShowFurigana,
    setTheme: updateTheme,
    setFontSize: updateFontSize,
    setAutoplayAudio: updateAutoplayAudio,
  } = useSettings();

  const [isPremiumUser, setIsPremiumUser] = useState(() => {
    return localStorage.getItem("isPremiumUser") === "true";
  });

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
            <div className="p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-foreground-muted mb-3">
                Sign in to sync your vocabulary and reading progress across devices.
              </p>
              <Button variant="outline" disabled>
                Sign in with Google (Coming Soon)
              </Button>
            </div>
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

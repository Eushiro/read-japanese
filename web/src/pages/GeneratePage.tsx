import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Image, Loader2, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";

import {
  generateStory,
  type GenerateStoryRequest,
  type GenerationStatus,
  pollGenerationStatus,
} from "@/api/generate";
import { Paywall } from "@/components/Paywall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { JLPT_LEVELS, type JLPTLevel } from "@/types/story";

import { api } from "../../convex/_generated/api";

const GENRE_KEYS = [
  "dailyLife",
  "fantasy",
  "mystery",
  "travel",
  "school",
  "food",
  "nature",
  "adventure",
  "romance",
  "historical",
] as const;

// Map genre keys to the API values
const GENRE_API_VALUES: Record<(typeof GENRE_KEYS)[number], string> = {
  dailyLife: "Daily Life",
  fantasy: "Fantasy",
  mystery: "Mystery",
  travel: "Travel",
  school: "School",
  food: "Food",
  nature: "Nature",
  adventure: "Adventure",
  romance: "Romance",
  historical: "Historical",
};

const levelVariantMap: Record<JLPTLevel, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

export function GeneratePage() {
  const t = useT();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Form state
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>("N5");
  const [genreKey, setGenreKey] = useState<(typeof GENRE_KEYS)[number]>("dailyLife");
  const [theme, setTheme] = useState("");
  const [numChapters, setNumChapters] = useState(3);
  const [wordsPerChapter, setWordsPerChapter] = useState(150);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);

  // Check subscription status
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const [showPaywall, setShowPaywall] = useState(false);

  // Enable generation for premium users (basic, pro, unlimited)
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";
  const isGenerationEnabled = isPremiumUser;

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setError(t("generate.errors.signInRequired"));
      return;
    }
    if (!isGenerationEnabled) {
      setShowPaywall(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(t("generate.progress.starting"));

    try {
      const request: GenerateStoryRequest = {
        jlpt_level: jlptLevel,
        genre: GENRE_API_VALUES[genreKey],
        theme: theme || undefined,
        num_chapters: numChapters,
        words_per_chapter: wordsPerChapter,
        generate_audio: generateAudio,
        generate_image: generateImages,
        generate_chapter_images: generateImages,
        align_audio: generateAudio,
      };

      const response = await generateStory(request);

      if (response.status === "failed") {
        throw new Error(response.message);
      }

      // Poll for completion
      const status = await pollGenerationStatus(response.story_id!, (status: GenerationStatus) => {
        setProgress(status.progress || status.status);
      });

      if (status.status === "completed" && status.story_id) {
        navigate({ to: "/read/$storyId", params: { storyId: status.story_id } });
      } else if (status.status === "failed") {
        throw new Error(status.error || t("generate.errors.generationFailed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generate.errors.generationFailed"));
    } finally {
      setIsGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-background to-background-subtle">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-2xl">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-wider">
                {t("generate.hero.badge")}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("generate.hero.title")}
            </h1>
            <p className="text-foreground-muted text-lg">{t("generate.hero.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm space-y-8">
          {/* JLPT Level */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              {t("generate.form.jlptLevel")}
            </label>
            <div className="flex flex-wrap gap-2">
              {JLPT_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setJlptLevel(level)}
                  disabled={isGenerating}
                  className="transition-all duration-200"
                >
                  <Badge
                    variant={levelVariantMap[level]}
                    className={`cursor-pointer px-4 py-2 text-sm ${
                      jlptLevel === level
                        ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-background scale-105"
                        : "opacity-60 hover:opacity-80 hover:scale-105"
                    }`}
                  >
                    {level}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              {t("generate.form.genre")}
            </label>
            <select
              value={genreKey}
              onChange={(e) => setGenreKey(e.target.value as (typeof GENRE_KEYS)[number])}
              disabled={isGenerating}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            >
              {GENRE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`generate.genres.${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              {t("generate.form.theme")}{" "}
              <span className="text-foreground-muted font-normal">
                {t("generate.form.themeOptional")}
              </span>
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={t("generate.form.themePlaceholder")}
              disabled={isGenerating}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          {/* Chapters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {t("generate.form.chapters")}
              </label>
              <select
                value={numChapters}
                onChange={(e) => setNumChapters(Number(e.target.value))}
                disabled={isGenerating}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {t("generate.form.chaptersCount", { count: n })}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {t("generate.form.wordsPerChapter")}
              </label>
              <select
                value={wordsPerChapter}
                onChange={(e) => setWordsPerChapter(Number(e.target.value))}
                disabled={isGenerating}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                {[100, 150, 200, 250, 300].map((n) => (
                  <option key={n} value={n}>
                    {t("generate.form.wordsCount", { count: n })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground">
              {t("generate.form.options")}
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={generateAudio}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                    disabled={isGenerating}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-border rounded bg-background peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                    {generateAudio && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
                  <span className="text-sm text-foreground">
                    {t("generate.options.generateAudio")}
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={generateImages}
                    onChange={(e) => setGenerateImages(e.target.checked)}
                    disabled={isGenerating}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-border rounded bg-background peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                    {generateImages && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
                  <span className="text-sm text-foreground">
                    {t("generate.options.generateImages")}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-foreground text-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              {progress}
            </div>
          )}

          {/* Generate Button */}
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("generate.actions.generating")}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {t("generate.actions.generate")}
              </>
            )}
          </Button>

          {/* Info */}
          <p className="text-xs text-foreground-muted text-center">
            {t("generate.info.generationTime")}
          </p>
        </div>
      </div>

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { Image, Loader2, Sparkles, User, Volume2, X } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import { JLPT_LEVELS, type JLPTLevel } from "@/types/story";

import { api } from "../../convex/_generated/api";

// Genre values for the select dropdown
const GENRES = [
  "Daily Life",
  "Fantasy",
  "Mystery",
  "Travel",
  "School",
  "Food",
  "Nature",
  "Adventure",
  "Romance",
  "Historical",
];

const levelVariantMap: Record<JLPTLevel, "n5" | "n4" | "n3" | "n2" | "n1"> = {
  N5: "n5",
  N4: "n4",
  N3: "n3",
  N2: "n2",
  N1: "n1",
};

type StoryType = "standard" | "personalized";

interface GenerateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PersonalizedStoryResult {
  title: string;
  content: string;
  translation: string;
  vocabulary: Array<{
    word: string;
    reading?: string;
    meaning: string;
    isNew: boolean;
  }>;
  wordCount: number;
}

export function GenerateStoryModal({ isOpen, onClose }: GenerateStoryModalProps) {
  const t = useT();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Story type selection
  const [storyType, setStoryType] = useState<StoryType>("standard");

  // Form state
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>("N5");
  const [genre, setGenre] = useState("Daily Life");
  const [theme, setTheme] = useState("");
  const [numChapters, setNumChapters] = useState(3);
  const [wordsPerChapter, setWordsPerChapter] = useState(150);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);

  // Personalized story result
  const [personalizedResult, setPersonalizedResult] = useState<PersonalizedStoryResult | null>(
    null
  );

  // Check subscription status
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const [showPaywall, setShowPaywall] = useState(false);

  // Personalized story action
  const generatePersonalizedStory = useAction(api.stories.generatePersonalized);

  // Enable generation for premium users (basic, pro, unlimited)
  const isPremiumUser = subscription?.tier && subscription.tier !== "free";
  const isGenerationEnabled = isPremiumUser;

  const handleGenerateStandard = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress("Starting generation...");

    try {
      const request: GenerateStoryRequest = {
        jlpt_level: jlptLevel,
        genre,
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
        onClose();
        // Generated stories are currently Japanese-only (JLPT levels)
        navigate({
          to: "/read/$language/$storyId",
          params: { language: "japanese", storyId: status.story_id },
        });
      } else if (status.status === "failed") {
        throw new Error(status.error || "Generation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
      setProgress("");
    }
  };

  const handleGeneratePersonalized = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress("Creating your personalized story...");

    try {
      const result = await generatePersonalizedStory({
        language: "japanese", // Currently only Japanese supported for JLPT levels
        difficulty: jlptLevel,
        topic: theme || undefined,
        targetWordCount: 100,
      });

      setPersonalizedResult(result);
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setError("Please sign in to generate stories.");
      return;
    }
    if (!isGenerationEnabled) {
      setShowPaywall(true);
      return;
    }

    if (storyType === "personalized") {
      await handleGeneratePersonalized();
    } else {
      await handleGenerateStandard();
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setPersonalizedResult(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="bg-surface max-w-lg p-0 rounded-2xl border-border overflow-hidden"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("generate.modal.title")}
                </h2>
                <p className="text-sm text-foreground-muted">{t("generate.modal.subtitle")}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Show personalized result if available */}
          {personalizedResult ? (
            <div className="p-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="text-lg font-semibold mb-2">{personalizedResult.title}</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap mb-3">
                  {personalizedResult.content}
                </p>
                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-sm text-foreground-muted italic">
                    {personalizedResult.translation}
                  </p>
                </div>
                <div className="mt-3 text-xs text-foreground-muted">
                  {t("generate.personalized.wordCount", { count: personalizedResult.wordCount })} •{" "}
                  {t("generate.personalized.newWords", {
                    count: personalizedResult.vocabulary.filter((v) => v.isNew).length,
                  })}
                </div>
              </div>

              {/* Vocabulary list */}
              {personalizedResult.vocabulary.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    {t("generate.personalized.vocabulary")}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {personalizedResult.vocabulary.map((v, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded-lg text-sm ${v.isNew ? "bg-accent/10 border border-accent/20" : "bg-muted/30"}`}
                      >
                        <span className="font-medium">{v.word}</span>
                        {v.reading && (
                          <span className="text-foreground-muted ml-1">({v.reading})</span>
                        )}
                        <p className="text-xs text-foreground-muted mt-0.5">{v.meaning}</p>
                        {v.isNew && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded">
                            {t("generate.personalized.new")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setPersonalizedResult(null)}
                variant="outline"
                className="w-full"
              >
                {t("generate.personalized.generateAnother")}
              </Button>
            </div>
          ) : (
            <>
              {/* Form */}
              <ScrollArea className="max-h-[calc(90vh-180px)]">
                <div className="p-4 space-y-5">
                  {/* Story Type Toggle */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      {t("generate.form.storyType")}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setStoryType("standard")}
                        disabled={isGenerating}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          storyType === "standard"
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-accent" />
                          <span className="font-medium text-sm">
                            {t("generate.form.storyTypes.standard")}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted">
                          {t("generate.form.storyTypes.standardDescription")}
                        </p>
                      </button>
                      <button
                        onClick={() => setStoryType("personalized")}
                        disabled={isGenerating}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          storyType === "personalized"
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-accent" />
                          <span className="font-medium text-sm">
                            {t("generate.form.storyTypes.personalized")}
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted">
                          {t("generate.form.storyTypes.personalizedDescription")}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* JLPT Level */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      {t("generate.form.jlptLevel")}
                    </Label>
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
                            className={`cursor-pointer px-3 py-1.5 text-sm ${
                              jlptLevel === level
                                ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-surface scale-105"
                                : "opacity-60 hover:opacity-80"
                            }`}
                          >
                            {level}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Standard story options */}
                  {storyType === "standard" && (
                    <>
                      {/* Genre */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          {t("generate.form.genre")}
                        </Label>
                        <Select value={genre} onValueChange={setGenre} disabled={isGenerating}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GENRES.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Theme */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          {t("generate.form.theme")}{" "}
                          <span className="text-foreground-muted font-normal">
                            {t("generate.form.themeOptional")}
                          </span>
                        </Label>
                        <input
                          type="text"
                          value={theme}
                          onChange={(e) => setTheme(e.target.value)}
                          placeholder="e.g., cherry blossoms, summer festival..."
                          disabled={isGenerating}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                      </div>

                      {/* Chapters & Words */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">
                            {t("generate.form.chapters")}
                          </Label>
                          <Select
                            value={String(numChapters)}
                            onValueChange={(v) => setNumChapters(Number(v))}
                            disabled={isGenerating}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5, 6].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {t("generate.form.chaptersCount", { count: n })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">
                            {t("generate.form.wordsPerChapter")}
                          </Label>
                          <Select
                            value={String(wordsPerChapter)}
                            onValueChange={(v) => setWordsPerChapter(Number(v))}
                            disabled={isGenerating}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[100, 150, 200, 250, 300].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {t("generate.form.wordsCount", { count: n })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground">
                          {t("generate.form.options")}
                        </Label>
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-3">
                            <Switch
                              id="audio"
                              checked={generateAudio}
                              onCheckedChange={setGenerateAudio}
                              disabled={isGenerating}
                            />
                            <Label
                              htmlFor="audio"
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <Volume2 className="w-4 h-4 text-foreground-muted" />
                              {t("generate.options.audio")}
                            </Label>
                          </div>

                          <div className="flex items-center gap-3">
                            <Switch
                              id="images"
                              checked={generateImages}
                              onCheckedChange={setGenerateImages}
                              disabled={isGenerating}
                            />
                            <Label
                              htmlFor="images"
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <Image className="w-4 h-4 text-foreground-muted" />
                              {t("generate.options.images")}
                            </Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Personalized story options */}
                  {storyType === "personalized" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        {t("generate.form.theme")}{" "}
                        <span className="text-foreground-muted font-normal">
                          {t("generate.form.themeOptional")}
                        </span>
                      </Label>
                      <input
                        type="text"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="e.g., cherry blossoms, summer festival..."
                        disabled={isGenerating}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                      />
                      <p className="text-xs text-foreground-muted">
                        {t("generate.personalized.topicHint")}
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  {/* Progress */}
                  {progress && (
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-foreground text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      {progress}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <DialogFooter className="p-4 border-t border-border bg-muted/30 sm:flex-col sm:items-stretch gap-2">
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
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
                <p className="text-xs text-foreground-muted text-center">
                  {storyType === "personalized"
                    ? t("generate.info.personalizedBrief")
                    : t("generate.info.generationTimeBrief")}
                </p>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
    </>
  );
}

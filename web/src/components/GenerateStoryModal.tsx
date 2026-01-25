import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Image, Loader2, Sparkles, Volume2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
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

interface GenerateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateStoryModal({ isOpen, onClose }: GenerateStoryModalProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  // Form state
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>("N5");
  const [genre, setGenre] = useState("Daily Life");
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
      setError("Please sign in to generate stories.");
      return;
    }
    if (!isGenerationEnabled) {
      setShowPaywall(true);
      return;
    }

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
        navigate({ to: "/read/$storyId", params: { storyId: status.story_id } });
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

  const handleClose = () => {
    if (!isGenerating) {
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
                  Generate Story
                </h2>
                <p className="text-sm text-foreground-muted">
                  Create a custom story for your level
                </p>
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

          {/* Form */}
          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="p-4 space-y-5">
              {/* JLPT Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">JLPT Level</Label>
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

              {/* Genre */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Genre</Label>
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
                  Theme <span className="text-foreground-muted font-normal">(Optional)</span>
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
                  <Label className="text-sm font-medium text-foreground">Chapters</Label>
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
                          {n} chapters
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Words/Chapter</Label>
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
                          ~{n} words
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Options</Label>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="audio"
                      checked={generateAudio}
                      onCheckedChange={setGenerateAudio}
                      disabled={isGenerating}
                    />
                    <Label htmlFor="audio" className="flex items-center gap-1.5 cursor-pointer">
                      <Volume2 className="w-4 h-4 text-foreground-muted" />
                      Audio
                    </Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="images"
                      checked={generateImages}
                      onCheckedChange={setGenerateImages}
                      disabled={isGenerating}
                    />
                    <Label htmlFor="images" className="flex items-center gap-1.5 cursor-pointer">
                      <Image className="w-4 h-4 text-foreground-muted" />
                      Images
                    </Label>
                  </div>
                </div>
              </div>

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
          <DialogFooter className="p-4 border-t border-border bg-muted/30 flex-col gap-2">
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Story
                </>
              )}
            </Button>
            <p className="text-xs text-foreground-muted text-center">
              Generation takes 2-5 minutes
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paywall Modal */}
      <Paywall isOpen={showPaywall} onClose={() => setShowPaywall(false)} feature="stories" />
    </>
  );
}

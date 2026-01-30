import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listStories } from "@/api/stories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { type ContentLanguage, LANGUAGES } from "@/lib/contentLanguages";

import { api } from "../../../convex/_generated/api";

const GENRES = [
  "slice of life",
  "mystery",
  "adventure",
  "romance",
  "comedy",
  "fantasy",
  "horror",
  "sci-fi",
];

const STYLES = ["anime", "watercolor", "minimalist", "realistic", "ghibli"];

const LEVELS = {
  japanese: ["N5", "N4", "N3", "N2", "N1"],
  english: ["A1", "A2", "B1", "B2", "C1", "C2"],
  french: ["A1", "A2", "B1", "B2", "C1", "C2"],
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "N5/A1",
  2: "N4/A2",
  3: "N3/B1",
  4: "N2/B2",
  5: "N1/C1",
  6: "C2",
};

// Backend API URL for admin operations
const ADMIN_API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// Topology Component
function TopologyCard() {
  const { data: topology, isLoading } = useTanstackQuery({
    queryKey: ["storyTopology"],
    queryFn: async () => {
      const response = await fetch(`${ADMIN_API_URL}/admin/stories/topology`);
      if (!response.ok) throw new Error("Failed to fetch topology");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-foreground-muted">Loading content analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{topology?.total_stories || 0}</div>
            <div className="text-sm text-foreground-muted">Total Stories</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{topology?.by_language?.japanese || 0}</div>
            <div className="text-sm text-foreground-muted">Japanese</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{topology?.by_language?.english || 0}</div>
            <div className="text-sm text-foreground-muted">English</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{topology?.by_language?.french || 0}</div>
            <div className="text-sm text-foreground-muted">French</div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution by Level */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Stories by Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {["N5", "N4", "N3", "N2", "N1"].map((level) => (
              <div key={level} className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-semibold">{topology?.by_level?.[level] || 0}</div>
                <div className="text-xs text-foreground-muted">{level}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2">
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
              <div key={level} className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-semibold">{topology?.by_level?.[level] || 0}</div>
                <div className="text-xs text-foreground-muted">{level}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribution by Genre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stories by Genre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(topology?.by_genre || {}).map(([genre, count]) => (
              <Badge key={genre} variant="outline" className="capitalize">
                {genre}: {count as number}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content Gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Content Gaps
          </CardTitle>
          <CardDescription>Areas where more stories are needed</CardDescription>
        </CardHeader>
        <CardContent>
          {topology?.gaps && topology.gaps.length > 0 ? (
            <div className="space-y-2">
              {topology.gaps.slice(0, 10).map(
                (
                  gap: {
                    type: string;
                    value: string;
                    language?: string;
                    current: number;
                    suggested: number;
                    severity: string;
                  },
                  i: number
                ) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded ${
                      gap.severity === "high"
                        ? "bg-red-500/10 border border-red-500/20"
                        : gap.severity === "medium"
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={gap.severity === "high" ? "destructive" : "secondary"}>
                        {gap.type}
                      </Badge>
                      <span className="capitalize">
                        {gap.language ? `${gap.language} ` : ""}
                        {gap.value}
                      </span>
                    </div>
                    <span className="text-sm text-foreground-muted">
                      {gap.current} / {gap.suggested} stories
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted text-center py-4">
              No significant content gaps identified
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StoriesPage() {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<ContentLanguage>("japanese");
  const [selectedLevel, setSelectedLevel] = useState("N4");
  const [selectedGenre, setSelectedGenre] = useState("slice of life");
  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [detailedPrompt, setDetailedPrompt] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState<
    Array<{
      prompt: string;
      genre: string;
      reason: string;
      vocabulary_themes: string[];
    }>
  >([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Fetch stories from backend
  const {
    data: stories,
    isLoading: storiesLoading,
    refetch: refetchStories,
  } = useTanstackQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
  });

  // Fetch question stats from Convex
  const questionStats = useQuery(api.storyQuestions.listAllStats, {});

  // Delete questions mutation
  const deleteQuestions = useMutation(api.storyQuestions.remove);

  // Update level when language changes
  useEffect(() => {
    if (selectedLanguage === "japanese") {
      setSelectedLevel("N4");
    } else {
      setSelectedLevel("A2");
    }
  }, [selectedLanguage]);

  // Poll for generation status
  useEffect(() => {
    if (!generationJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${ADMIN_API_URL}/admin/stories/generate/${generationJobId}/status`
        );
        const data = await response.json();

        setGenerationStatus(data.message || data.status);

        if (data.status === "completed") {
          setIsGenerating(false);
          setGenerationJobId(null);
          refetchStories();
        } else if (data.status === "failed") {
          setIsGenerating(false);
          setGenerationJobId(null);
          setGenerationError(data.error || "Generation failed");
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [generationJobId, refetchStories]);

  // Handle story generation
  const handleGenerateStory = async () => {
    if (!detailedPrompt.trim() || detailedPrompt.length < 10) {
      setGenerationError("Please provide a detailed prompt (at least 10 characters)");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStatus("Starting generation...");

    try {
      const response = await fetch(`${ADMIN_API_URL}/admin/stories/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: selectedLanguage,
          level: selectedLevel,
          genre: selectedGenre,
          detailed_prompt: detailedPrompt,
          image_style: selectedStyle,
          num_chapters: 5,
          words_per_chapter: selectedLanguage === "japanese" ? 150 : 200,
          generate_audio: false,
          generate_images: false,
        }),
      });

      const data = await response.json();

      if (data.success && data.job_id) {
        setGenerationJobId(data.job_id);
        setGenerationStatus("Generation queued...");
      } else {
        throw new Error(data.message || "Failed to start generation");
      }
    } catch (err) {
      setIsGenerating(false);
      setGenerationError(err instanceof Error ? err.message : "Failed to generate story");
    }
  };

  // Load AI suggestions
  const handleLoadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setSuggestions([]);

    try {
      const response = await fetch(
        `${ADMIN_API_URL}/admin/stories/suggestions?language=${selectedLanguage}&level=${selectedLevel}&count=5`
      );
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Create a map of storyId -> question stats
  const questionStatsMap = useMemo(() => {
    if (!questionStats) return new Map();
    return new Map(questionStats.map((s) => [s.storyId, s]));
  }, [questionStats]);

  // Filter stories by search term
  const filteredStories = useMemo(() => {
    if (!stories) return [];
    if (!searchTerm.trim()) return stories;

    const term = searchTerm.toLowerCase();
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.titleTranslations.ja.toLowerCase().includes(term) ||
        s.titleTranslations.en.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        s.genre.toLowerCase().includes(term)
    );
  }, [stories, searchTerm]);

  const handleDeleteQuestions = async (storyId: string, difficulty: number) => {
    if (!user?.email) return;

    if (!confirm(`Delete questions for difficulty ${difficulty}?`)) return;

    try {
      await deleteQuestions({
        storyId,
        difficulty,
        adminEmail: user.email,
      });
    } catch (err) {
      console.error("Failed to delete questions:", err);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stories</h1>
          <p className="text-foreground-muted">
            Manage AI-generated stories and comprehension questions
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchStories()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Story List</TabsTrigger>
          <TabsTrigger value="generate">Generate New</TabsTrigger>
          <TabsTrigger value="topology">Content Analysis</TabsTrigger>
          <TabsTrigger value="info">Question Info</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <Input
                placeholder="Search by title, ID, or genre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stories Table */}
          {storiesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Story</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead className="text-center">Questions by Difficulty</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredStories || filteredStories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-foreground-muted">
                        No stories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStories.map((story) => {
                      const stats = questionStatsMap.get(story.id);
                      const hasDifficulty = (d: number) => stats?.difficulties.includes(d);

                      return (
                        <TableRow key={story.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{story.title}</p>
                              {story.language !== "english" && (
                                <p className="text-sm text-foreground-muted">
                                  {story.titleTranslations.en}
                                </p>
                              )}
                              <p className="text-xs text-foreground-muted font-mono">{story.id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{story.level}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{story.genre}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {[1, 2, 3, 4, 5, 6].map((d) => (
                                <div
                                  key={d}
                                  className={`relative w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors group ${
                                    hasDifficulty(d)
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-muted text-foreground-muted"
                                  }`}
                                  title={`Difficulty ${d} (${DIFFICULTY_LABELS[d]}): ${hasDifficulty(d) ? "Has questions" : "No questions"}`}
                                >
                                  {d}
                                  {hasDifficulty(d) && (
                                    <button
                                      onClick={() => handleDeleteQuestions(story.id, d)}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                      title="Delete questions"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" asChild title="Edit Questions">
                                <Link
                                  to="/admin/stories/$language/$storyId"
                                  params={{ language: story.language, storyId: story.id }}
                                >
                                  <BookOpen className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild title="Open Story">
                                <Link
                                  to="/read/$language/$storyId"
                                  params={{ language: story.language, storyId: story.id }}
                                  target="_blank"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {stories && (
            <div className="text-sm text-foreground-muted">
              {filteredStories.length} of {stories.length} stories
              {questionStats && ` • ${questionStats.length} with cached questions`}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          {/* Story Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Generate New Story
              </CardTitle>
              <CardDescription>
                Describe your story in detail and generate it directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select
                    value={selectedLanguage}
                    onValueChange={(v) => setSelectedLanguage(v as ContentLanguage)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Level</label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS[selectedLanguage].map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre} className="capitalize">
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Image Style</label>
                  <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLES.map((style) => (
                        <SelectItem key={style} value={style} className="capitalize">
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Story Prompt</label>
                <Textarea
                  placeholder="Describe your story in detail. Include setting, characters, themes, vocabulary focus areas, cultural elements, plot points...

Example: A young office worker in Tokyo discovers a hidden jazz bar in a back alley of Shimokitazawa. The elderly bartender shares stories about the neighborhood's past while teaching the protagonist about coffee and music appreciation. The story explores themes of work-life balance and finding unexpected connections in a busy city."
                  rows={6}
                  value={detailedPrompt}
                  onChange={(e) => setDetailedPrompt(e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-foreground-muted">
                  Be specific about the story you want. The more detail you provide, the better the
                  generated story will match your vision.
                </p>
              </div>

              {/* Generation status */}
              {generationError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {generationError}
                </div>
              )}

              {generationStatus && isGenerating && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {generationStatus}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateStory}
                  disabled={isGenerating || !detailedPrompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Story
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Story Suggestions
                </CardTitle>
                <CardDescription>
                  Get prompt ideas based on content gaps and user interests
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSuggestions}
                disabled={isLoadingSuggestions}
              >
                {isLoadingSuggestions ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setDetailedPrompt(s.prompt);
                        setSelectedGenre(s.genre);
                      }}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <p className="text-sm">{s.prompt}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {s.genre}
                        </Badge>
                        {s.vocabulary_themes?.slice(0, 3).map((theme) => (
                          <Badge key={theme} variant="secondary" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-foreground-muted mt-1">{s.reason}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground-muted text-center py-4">
                  Click the refresh button to generate story suggestions
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topology" className="space-y-4">
          {/* Content Topology */}
          <TopologyCard />
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          {/* Story Questions Info */}
          <Card>
            <CardHeader>
              <CardTitle>About Story Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground-muted">
                Stories have comprehension questions at 6 difficulty levels (1-6), which map to:
              </p>
              <ul className="text-sm space-y-1 text-foreground-muted">
                <li>
                  <strong>Level 1-2:</strong> N5-N4 (beginner) - Simple recall questions
                </li>
                <li>
                  <strong>Level 3-4:</strong> N3-N2 (intermediate) - Inference and analysis
                </li>
                <li>
                  <strong>Level 5-6:</strong> N1+ (advanced) - Critical thinking and opinion
                </li>
              </ul>
              <p className="text-sm text-foreground-muted">
                Questions are generated automatically when a user takes a comprehension quiz. They
                are cached per story/difficulty level and reused for all users.
              </p>
            </CardContent>
          </Card>

          {/* Question Types */}
          <Card>
            <CardHeader>
              <CardTitle>Question Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">multiple_choice</p>
                  <p className="text-foreground-muted">Auto-graded</p>
                </div>
                <div>
                  <p className="font-medium">translation</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
                <div>
                  <p className="font-medium">short_answer</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
                <div>
                  <p className="font-medium">inference</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
                <div>
                  <p className="font-medium">prediction</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
                <div>
                  <p className="font-medium">grammar</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
                <div>
                  <p className="font-medium">opinion</p>
                  <p className="text-foreground-muted">AI-graded</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

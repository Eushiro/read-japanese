import { useState, useMemo } from "react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { listStories } from "@/api/stories";
import {
  BookOpen,
  Plus,
  AlertCircle,
  Wand2,
  ArrowRight,
  Check,
  X,
  Search,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";

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

const STYLES = [
  "anime",
  "watercolor",
  "minimalist",
  "realistic",
  "ghibli",
];

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

export function StoriesPage() {
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<"japanese" | "english" | "french">("japanese");
  const [selectedLevel, setSelectedLevel] = useState("N4");
  const [selectedGenre, setSelectedGenre] = useState("slice of life");
  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [theme, setTheme] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  // Fetch stories from backend
  const { data: stories, isLoading: storiesLoading, refetch: refetchStories } = useTanstackQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
  });

  // Fetch question stats from Convex
  const questionStats = useQuery(api.storyQuestions.listAllStats, {});

  // Delete questions mutation
  const deleteQuestions = useMutation(api.storyQuestions.remove);

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
    return stories.filter((s) =>
      s.title.toLowerCase().includes(term) ||
      s.titleJapanese?.toLowerCase().includes(term) ||
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

  const generateCommand = `python backend/scripts/generate_story.py --level ${selectedLevel} --genre "${selectedGenre}"${theme ? ` --theme "${theme}"` : ""} --style ${selectedStyle}`;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stories</h1>
          <p className="text-foreground-muted">Manage AI-generated stories and comprehension questions</p>
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
                              {story.titleJapanese && (
                                <p className="text-sm text-foreground-muted">{story.titleJapanese}</p>
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
                                <Link to={`/admin/stories/${story.id}`}>
                                  <BookOpen className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild title="Open Story">
                                <Link to={`/read/${story.id}`} target="_blank">
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
                Configure options and run the generation command
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="japanese">Japanese</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="french">French</SelectItem>
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
                <label className="text-sm font-medium">Theme (optional)</label>
                <Input
                  placeholder="e.g., lost in Tokyo, first day at school, summer festival"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Run this command:</label>
                <code className="block p-3 bg-muted rounded text-sm font-mono overflow-x-auto">
                  {generateCommand}
                </code>
              </div>

              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(generateCommand)}
              >
                Copy Command
              </Button>
            </CardContent>
          </Card>
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
                <li><strong>Level 1-2:</strong> N5-N4 (beginner) - Simple recall questions</li>
                <li><strong>Level 3-4:</strong> N3-N2 (intermediate) - Inference and analysis</li>
                <li><strong>Level 5-6:</strong> N1+ (advanced) - Critical thinking and opinion</li>
              </ul>
              <p className="text-sm text-foreground-muted">
                Questions are generated automatically when a user takes a comprehension quiz.
                They are cached per story/difficulty level and reused for all users.
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

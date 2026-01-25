import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const LANGUAGES = [
  { value: "all", label: "All Languages" },
  { value: "japanese", label: "Japanese" },
  { value: "english", label: "English" },
  { value: "french", label: "French" },
];

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "N5/A1",
  2: "N4/A2",
  3: "N3/B1",
  4: "N2/B2",
  5: "N1/C1",
  6: "C2",
};

export function VideosPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const videos = useQuery(api.youtubeContent.list, {});
  const removeVideo = useMutation(api.youtubeContent.remove);

  // Get video question stats (difficulty levels)
  const questionStats = useQuery(api.videoQuestions.listAllStats, {});
  const deleteQuestions = useMutation(api.videoQuestions.remove);

  // Create a map of videoId -> question stats
  const questionStatsMap = useMemo(() => {
    if (!questionStats) return new Map();
    return new Map(questionStats.map((s) => [s.videoId, s]));
  }, [questionStats]);

  const isLoading = videos === undefined;

  // Filter videos
  const filteredVideos =
    videos?.filter((video) => {
      // Search filter
      if (search && !video.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Language filter
      if (languageFilter !== "all" && video.language !== languageFilter) {
        return false;
      }
      // Status filter - now checks videoQuestions table
      const stats = questionStatsMap.get(video.videoId);
      const hasQuestions = stats && stats.difficulties.length > 0;

      if (statusFilter === "has_questions" && !hasQuestions) {
        return false;
      }
      if (statusFilter === "needs_questions" && hasQuestions) {
        return false;
      }
      return true;
    }) ?? [];

  const handleDelete = async (id: Id<"youtubeContent">) => {
    if (confirm("Are you sure you want to delete this video?")) {
      await removeVideo({ id });
    }
  };

  const handleDeleteQuestions = async (videoId: string, difficulty: number) => {
    if (!user?.email) return;
    if (!confirm(`Delete questions for difficulty ${difficulty}?`)) return;

    try {
      await deleteQuestions({
        videoId,
        difficulty,
        adminEmail: user.email,
      });
    } catch (err) {
      console.error("Failed to delete questions:", err);
    }
  };

  // Count videos needing questions (no difficulties in videoQuestions)
  const needsWorkCount =
    videos?.filter((v) => {
      const stats = questionStatsMap.get(v.videoId);
      return !stats || stats.difficulties.length === 0;
    }).length ?? 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Videos</h1>
          <p className="text-foreground-muted">
            Manage YouTube content and comprehension questions
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/videos/$id" params={{ id: "new" }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Video
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="has_questions">Has Questions</SelectItem>
            <SelectItem value="needs_questions">Needs Questions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-foreground-muted">
        <span>Total: {videos?.length ?? 0}</span>
        <span>Showing: {filteredVideos.length}</span>
        <span className="text-amber-500">Needs work: {needsWorkCount}</span>
      </div>

      {/* Table */}
      {isLoading ? (
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
                <TableHead className="w-[280px]">Title</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-center">Questions by Difficulty</TableHead>
                <TableHead>Transcript</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVideos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-foreground-muted">
                    No videos found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVideos.map((video) => {
                  const stats = questionStatsMap.get(video.videoId);
                  const hasDifficulty = (d: number) => stats?.difficulties.includes(d);

                  return (
                    <TableRow key={video._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                            {video.thumbnailUrl && (
                              <img
                                src={video.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{video.title}</p>
                            <p className="text-xs text-foreground-muted">{video.videoId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {video.language}
                        </Badge>
                      </TableCell>
                      <TableCell>{video.level ?? "-"}</TableCell>
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
                                  onClick={() => handleDeleteQuestions(video.videoId, d)}
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
                        {video.transcript && video.transcript.length > 0 ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{video.transcript.length} lines</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-500">
                            <AlertCircle className="w-4 h-4" />
                            <span>Missing</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/admin/videos/$id" params={{ id: video._id }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(video._id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

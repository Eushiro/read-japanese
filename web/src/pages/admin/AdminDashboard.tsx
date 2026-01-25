import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AlertCircle, ArrowRight, BookOpen, Clock, Layers, Plus, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";

export function AdminDashboard() {
  // Fetch stats
  const videos = useQuery(api.youtubeContent.list, {});
  const decks = useQuery(api.premadeDecks.listAllDecks, {});
  const jobs = useQuery(api.batchJobs.list, { limit: 10 });

  const isLoading = videos === undefined || decks === undefined || jobs === undefined;

  // Calculate stats
  const totalVideos = videos?.length ?? 0;
  const videosWithQuestions =
    videos?.filter((v) => v.questions && v.questions.length > 0).length ?? 0;
  const videosNeedingWork = totalVideos - videosWithQuestions;

  const totalDecks = decks?.length ?? 0;
  const publishedDecks = decks?.filter((d) => d.isPublished).length ?? 0;

  const activeJobs =
    jobs?.filter((j) => j.status === "running" || j.status === "submitted").length ?? 0;
  const failedJobs = jobs?.filter((j) => j.status === "failed").length ?? 0;

  // Decks needing attention (less than 50% sentences)
  const decksNeedingWork =
    decks?.filter((d) => {
      if (d.totalWords === 0) return false;
      const pct = (d.wordsWithSentences / d.totalWords) * 100;
      return pct < 50;
    }) ?? [];

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-foreground-muted">Manage content and monitor generation jobs</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Videos</CardTitle>
            <Video className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVideos}</div>
            <p className="text-xs text-foreground-muted">
              {videosNeedingWork > 0 && (
                <span className="text-amber-500">{videosNeedingWork} need questions</span>
              )}
              {videosNeedingWork === 0 && "All have questions"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Decks</CardTitle>
            <Layers className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDecks}</div>
            <p className="text-xs text-foreground-muted">{publishedDecks} published</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Active Jobs</CardTitle>
            <Clock className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs}</div>
            <p className="text-xs text-foreground-muted">
              {failedJobs > 0 && <span className="text-red-500">{failedJobs} failed</span>}
              {failedJobs === 0 && "No failures"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-foreground-muted">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/admin/videos/$id" params={{ id: "new" }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Video
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/decks">
              <Layers className="w-4 h-4 mr-2" />
              Manage Decks
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/jobs">
              <Clock className="w-4 h-4 mr-2" />
              View Jobs
            </Link>
          </Button>
        </div>
      </div>

      {/* Content Needing Attention */}
      {(videosNeedingWork > 0 || decksNeedingWork.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Needs Attention
          </h2>
          <div className="space-y-3">
            {videosNeedingWork > 0 && (
              <Card className="border-amber-500/30">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium">{videosNeedingWork} videos without questions</p>
                      <p className="text-sm text-foreground-muted">
                        Generate comprehension questions
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/videos">
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {decksNeedingWork.slice(0, 3).map((deck) => {
              const pct =
                deck.totalWords > 0
                  ? Math.round((deck.wordsWithSentences / deck.totalWords) * 100)
                  : 0;
              return (
                <Card key={deck.deckId} className="border-amber-500/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium">{deck.name}</p>
                        <p className="text-sm text-foreground-muted">
                          {pct}% sentences generated ({deck.wordsWithSentences}/{deck.totalWords})
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/admin/decks/$deckId" params={{ deckId: deck.deckId }}>
                        View <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {jobs && jobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Jobs</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {jobs.slice(0, 5).map((job) => (
                  <div key={job._id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm">
                        {job.jobType} - {job.deckId ?? "Unknown deck"}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {job.processedCount}/{job.itemCount} items
                      </p>
                    </div>
                    <Badge
                      variant={
                        job.status === "succeeded"
                          ? "default"
                          : job.status === "failed"
                            ? "destructive"
                            : job.status === "running"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  Clock,
  Crown,
  FlaskConical,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { LANGUAGES } from "@/lib/contentLanguages";
import { getTier, type TierId } from "@/lib/tiers";

import { api } from "../../../convex/_generated/api";

export function AdminDashboard() {
  const { user } = useAuth();

  // Fetch stats
  const videos = useQuery(api.youtubeContent.list, {});
  const decks = useQuery(api.premadeDecks.listAllDecks, {});
  const jobs = useQuery(api.batchJobs.list, { limit: 10 });

  // Testing tools
  const userProfile = useQuery(api.users.getByClerkId, user ? { clerkId: user.id } : "skip");
  const subscription = useQuery(api.subscriptions.get, user ? { userId: user.id } : "skip");
  const upsertSubscription = useMutation(api.subscriptions.upsert);
  const updateProficiencyLevel = useMutation(api.users.updateProficiencyLevel);
  const overrideProfile = useMutation(api.learnerModel.overrideProfile);

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

      {/* Testing Tools */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-amber-500" />
          Testing Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Subscription Tier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Subscription Tier
              </CardTitle>
              <CardDescription className="text-xs">
                Test different subscription features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={subscription?.tier ?? "free"}
                onValueChange={async (value) => {
                  if (!user) return;
                  await upsertSubscription({
                    userId: user.id,
                    tier: value as TierId,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free ({getTier("free")?.credits} credits)</SelectItem>
                  <SelectItem value="plus">Plus ({getTier("plus")?.credits} credits)</SelectItem>
                  <SelectItem value="pro">Pro ({getTier("pro")?.credits} credits)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Level Override */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                Level Override
              </CardTitle>
              <CardDescription className="text-xs">
                Test questions at different difficulties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userProfile?.languages?.map((lang) => {
                  const langInfo = LANGUAGES.find((l) => l.value === lang);
                  const currentLevel =
                    userProfile.proficiencyLevels?.[
                      lang as keyof typeof userProfile.proficiencyLevels
                    ]?.level;
                  const levels =
                    lang === "japanese"
                      ? ["N5", "N4", "N3", "N2", "N1"]
                      : ["A1", "A2", "B1", "B2", "C1", "C2"];

                  return (
                    <div key={lang} className="flex items-center gap-2">
                      <span className="text-xs w-16 text-foreground-muted">{langInfo?.label}</span>
                      <Select
                        value={currentLevel ?? "not_set"}
                        onValueChange={async (value) => {
                          if (!user || value === "not_set") return;
                          await updateProficiencyLevel({
                            clerkId: user.id,
                            language: lang as "japanese" | "english" | "french",
                            level: value,
                          });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Not set" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_set">Not set</SelectItem>
                          {levels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {(!userProfile?.languages || userProfile.languages.length === 0) && (
                  <p className="text-xs text-foreground-muted">No languages configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Show Onboarding */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Show Onboarding
              </CardTitle>
              <CardDescription className="text-xs">Preview the onboarding flow</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  window.location.href = "/settings?onboarding=true";
                }}
              >
                Show Onboarding Modal
              </Button>
            </CardContent>
          </Card>

          {/* Learner Profile Override */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-500" />
                Learner Profile Override
              </CardTitle>
              <CardDescription className="text-xs">
                Switch profile between diagnostic/beginner/advanced
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userProfile?.languages?.map((lang) => {
                  const langInfo = LANGUAGES.find((l) => l.value === lang);
                  return (
                    <div key={lang} className="flex items-center gap-2">
                      <span className="text-xs w-16 text-foreground-muted">{langInfo?.label}</span>
                      <Select
                        onValueChange={async (value) => {
                          if (!user) return;
                          await overrideProfile({
                            userId: user.id,
                            language: lang as "japanese" | "english" | "french",
                            adminEmail: user.email ?? "",
                            preset: value as
                              | "diagnostic"
                              | "beginner"
                              | "intermediate"
                              | "advanced",
                          });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Select preset..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diagnostic">Reset (Diagnostic)</SelectItem>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {(!userProfile?.languages || userProfile.languages.length === 0) && (
                  <p className="text-xs text-foreground-muted">No languages configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

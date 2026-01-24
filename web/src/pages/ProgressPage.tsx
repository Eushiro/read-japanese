import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AlertTriangle,BookOpen, Clock, Flame, Target, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

export function ProgressPage() {
  const t = useT();
  const { user, isAuthenticated } = useAuth();

  // Get learner profile
  const profile = useQuery(
    api.learnerModel.getProfile,
    isAuthenticated && user ? { userId: user.id, language: "japanese" } : "skip"
  );

  // Get weak areas
  const weakAreas = useQuery(
    api.learnerModel.getWeakAreas,
    isAuthenticated && user ? { userId: user.id, language: "japanese", limit: 5 } : "skip"
  );

  // Get daily progress (last 30 days)
  const dailyProgress = useQuery(
    api.learnerModel.getDailyProgress,
    isAuthenticated && user ? { userId: user.id, language: "japanese", days: 30 } : "skip"
  );

  // Get all profiles for language comparison
  const allProfiles = useQuery(
    api.learnerModel.getAllProfiles,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );

  // Get streak from users table (source of truth)
  const streakData = useQuery(
    api.users.getStreak,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <TrendingUp className="w-16 h-16 mx-auto text-foreground-muted mb-4" />
        <h1 className="text-2xl font-bold mb-4">{t("progress.title")}</h1>
        <p className="text-foreground-muted">{t("progress.signInPrompt")}</p>
      </div>
    );
  }

  // Prepare skill data for radar chart
  const skillData = profile
    ? [
        { skill: t("progress.skills.vocabulary"), value: profile.skills.vocabulary, fullMark: 100 },
        { skill: t("progress.skills.grammar"), value: profile.skills.grammar, fullMark: 100 },
        { skill: t("progress.skills.reading"), value: profile.skills.reading, fullMark: 100 },
        { skill: t("progress.skills.listening"), value: profile.skills.listening, fullMark: 100 },
        { skill: t("progress.skills.writing"), value: profile.skills.writing, fullMark: 100 },
        { skill: t("progress.skills.speaking"), value: profile.skills.speaking, fullMark: 100 },
      ]
    : [];

  // Prepare progress chart data
  const progressChartData = dailyProgress?.map((day) => ({
    date: day.date.slice(5), // MM-DD format
    vocabulary: day.skillSnapshot.vocabulary,
    grammar: day.skillSnapshot.grammar,
    reading: day.skillSnapshot.reading,
    studyMinutes: day.studyMinutes,
  }));

  // Get streak from users table (source of truth, not stale learnerProfile)
  const currentStreak = streakData?.currentStreak ?? 0;

  // Readiness badge color
  const readinessColors: Record<string, string> = {
    not_ready: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    almost_ready: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    ready: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    confident: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const readinessLabels: Record<string, string> = {
    not_ready: t("progress.readiness.notReady"),
    almost_ready: t("progress.readiness.almostReady"),
    ready: t("progress.readiness.ready"),
    confident: t("progress.readiness.confident"),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("progress.title")}</h1>
          <p className="text-foreground-muted">
            {t("progress.subtitle")}
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Streak */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <Flame className="w-5 h-5" />
              <span className="text-sm font-medium">{t("progress.stats.streak")}</span>
            </div>
            <p className="text-2xl font-bold">{t("progress.stats.days", { count: currentStreak })}</p>
          </div>

          {/* Study Time */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">{t("progress.stats.totalStudy")}</span>
            </div>
            <p className="text-2xl font-bold">
              {t("progress.stats.hours", { count: Math.round((profile?.totalStudyMinutes ?? 0) / 60) })}
            </p>
          </div>

          {/* Vocab Coverage */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-green-500 mb-2">
              <BookOpen className="w-5 h-5" />
              <span className="text-sm font-medium">{t("progress.stats.vocabulary")}</span>
            </div>
            <p className="text-2xl font-bold">
              {profile?.vocabCoverage?.known ?? 0}
              <span className="text-sm text-foreground-muted font-normal">
                /{profile?.vocabCoverage?.totalWords ?? "—"}
              </span>
            </p>
          </div>

          {/* Readiness */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-sm font-medium">{t("progress.readiness.title")}</span>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                readinessColors[profile?.readiness?.level ?? "not_ready"]
              }`}
            >
              {readinessLabels[profile?.readiness?.level ?? "not_ready"]}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Skill Radar */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-4">{t("progress.skills.title")}</h2>
            {profile ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={skillData}>
                  <PolarGrid stroke="currentColor" className="text-border" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "currentColor", className: "text-foreground-muted text-sm" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "currentColor", className: "text-foreground-muted text-xs" }}
                  />
                  <Radar
                    name="Skills"
                    dataKey="value"
                    stroke="hsl(var(--accent))"
                    fill="hsl(var(--accent))"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground-muted">
                {t("progress.skills.noData")}
              </div>
            )}
          </div>

          {/* Weak Areas */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t("progress.focusAreas.title")}</h2>
              <Link to="/flashcards" className="text-sm text-accent hover:underline">
                {t("progress.focusAreas.practice")}
              </Link>
            </div>
            {weakAreas && weakAreas.length > 0 ? (
              <div className="space-y-3">
                {weakAreas.map((area, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          area.score < 50 ? "text-red-500" : "text-yellow-500"
                        }`}
                      />
                      <div>
                        <p className="font-medium capitalize">{area.topic}</p>
                        <p className="text-xs text-foreground-muted capitalize">{area.skill}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          area.score < 50 ? "text-red-500" : "text-yellow-500"
                        }`}
                      >
                        {area.score}%
                      </p>
                      <p className="text-xs text-foreground-muted">{t("progress.focusAreas.questions", { count: area.questionCount })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-foreground-muted">
                {t("progress.focusAreas.noWeakAreas")}
              </div>
            )}
          </div>
        </div>

        {/* Progress Over Time */}
        <div className="bg-surface rounded-xl border border-border p-6 mb-8">
          <h2 className="font-semibold mb-4">{t("progress.progressChart.title")}</h2>
          {progressChartData && progressChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={progressChartData}>
                <CartesianGrid strokeDasharray="3 3" className="text-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "currentColor", className: "text-foreground-muted text-xs" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "currentColor", className: "text-foreground-muted text-xs" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="vocabulary"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name={t("progress.skills.vocabulary")}
                />
                <Line
                  type="monotone"
                  dataKey="grammar"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name={t("progress.skills.grammar")}
                />
                <Line
                  type="monotone"
                  dataKey="reading"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name={t("progress.skills.reading")}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-foreground-muted">
              {t("progress.progressChart.noData")}
            </div>
          )}
        </div>

        {/* Language Comparison */}
        {allProfiles && allProfiles.length > 1 && (
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-4">{t("progress.languages.title")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allProfiles.map((p) => {
                const avgSkill = Math.round(
                  (p.skills.vocabulary + p.skills.grammar + p.skills.reading + p.skills.listening) /
                    4
                );
                return (
                  <div key={p._id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium capitalize">{p.language}</p>
                      <span
                        className={`text-sm px-2 py-0.5 rounded ${
                          readinessColors[p.readiness.level]
                        }`}
                      >
                        {readinessLabels[p.readiness.level]}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${avgSkill}%` }}
                      />
                    </div>
                    <p className="text-xs text-foreground-muted mt-1">{t("progress.languages.average", { percent: avgSkill })}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            to="/exams"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            <Target className="w-4 h-4" />
            {t("progress.actions.takePracticeExam")}
          </Link>
          <Link
            to="/flashcards"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-muted/50"
          >
            <BookOpen className="w-4 h-4" />
            {t("progress.actions.reviewFlashcards")}
          </Link>
        </div>
      </div>
    </div>
  );
}

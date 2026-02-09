import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, Clock, Flame, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { PremiumBackground } from "@/components/ui/premium-background";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { getLanguageColorScheme } from "@/lib/languageColors";
import { abilityToProgress, CALIBRATION_SE_THRESHOLD, getLevelVariant } from "@/lib/levels";

import { api } from "../../convex/_generated/api";

// Color configurations for each language color scheme
const colorConfigs: Record<"blue" | "purple" | "orange", { bar: string; barTrack: string }> = {
  blue: { bar: "bg-blue-500", barTrack: "bg-blue-500/20" },
  purple: { bar: "bg-purple-500", barTrack: "bg-purple-500/20" },
  orange: { bar: "bg-orange-500", barTrack: "bg-orange-500/20" },
};

export function ProgressPage() {
  const t = useT();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Get user profile to access their languages
  const { userProfile } = useUserData();

  const userLanguages = (userProfile?.languages ?? []) as ContentLanguage[];
  const [selectedLanguage, setSelectedLanguage] = useState<ContentLanguage | null>(null);

  // Use selected language or default to first language
  const activeLanguage = selectedLanguage ?? userLanguages[0] ?? "japanese";
  const languageIndex = userLanguages.indexOf(activeLanguage);
  const colorScheme = getLanguageColorScheme(
    languageIndex >= 0 ? languageIndex : 0,
    userLanguages.length || 1
  );
  const colors = colorConfigs[colorScheme];

  // Get learner profile for selected language
  const profile = useQuery(
    api.learnerModel.getProfile,
    isAuthenticated && user ? { userId: user.id, language: activeLanguage } : "skip"
  );

  // Get weak areas for selected language
  const weakAreas = useQuery(
    api.learnerModel.getWeakAreas,
    isAuthenticated && user ? { userId: user.id, language: activeLanguage, limit: 5 } : "skip"
  );

  // Get daily progress (last 30 days) for selected language
  const dailyProgress = useQuery(
    api.learnerModel.getDailyProgress,
    isAuthenticated && user ? { userId: user.id, language: activeLanguage, days: 30 } : "skip"
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

  // Skill keys for iteration
  const SKILL_KEYS = [
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "writing",
    "speaking",
  ] as const;

  // Level progress
  const levelProgress = profile ? abilityToProgress(profile.abilityEstimate, activeLanguage) : null;
  const isCalibrating = (profile?.abilityConfidence ?? 1.0) > CALIBRATION_SE_THRESHOLD;

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
    <div className="h-full flex flex-col overflow-hidden">
      <PremiumBackground colorScheme="cool" starCount={6} />
      <div className="container mx-auto px-4 py-8 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.history.back()}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("common.actions.back")}
            </button>
            <div className="flex items-baseline gap-3 mb-2">
              <h1 className="text-3xl font-bold">{t("progress.title")}</h1>
              {userLanguages.length > 1 ? (
                <Select
                  value={activeLanguage}
                  onValueChange={(value) => setSelectedLanguage(value as ContentLanguage)}
                >
                  <SelectTrigger className="w-auto h-8 px-3 rounded-full bg-surface/80 border border-border backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {userLanguages.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {t(`common.languages.${lang}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : userLanguages.length === 1 ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface/80 border border-border text-sm font-medium backdrop-blur-sm">
                  {t(`common.languages.${activeLanguage}`)}
                </span>
              ) : null}
            </div>
            <p className="text-foreground-muted">{t("progress.subtitle")}</p>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Streak */}
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <Flame className="w-5 h-5" />
                <span className="text-sm font-medium">{t("progress.stats.streak")}</span>
              </div>
              <p className="text-2xl font-bold">
                {t("progress.stats.days", { count: currentStreak })}
              </p>
            </div>

            {/* Study Time */}
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">{t("progress.stats.totalStudy")}</span>
              </div>
              <p className="text-2xl font-bold">
                {t("progress.stats.hours", {
                  count: Math.round((profile?.totalStudyMinutes ?? 0) / 60),
                })}
              </p>
            </div>

            {/* Vocab Coverage */}
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
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
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
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
            {/* Level + Skills */}
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <h2 className="font-semibold mb-4">{t("progress.skills.title")}</h2>
              {isCalibrating ? (
                <div className="flex flex-col items-center text-center py-10 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <Target className="w-7 h-7 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {t("dashboard.skills.calibrating.title")}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {t("dashboard.skills.calibrating.description")}
                    </p>
                  </div>
                  <Link
                    to="/adaptive-practice"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 transition-colors"
                  >
                    {t("dashboard.cta.startPractice")}
                  </Link>
                </div>
              ) : profile && levelProgress ? (
                <div className="space-y-5">
                  {/* Current level badge */}
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={getLevelVariant(levelProgress.currentLevel)}
                      className="text-lg px-4 py-1"
                    >
                      {levelProgress.currentLevel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {t("dashboard.skills.currentLevel")}
                    </span>
                  </div>

                  {/* Progress to next level */}
                  {levelProgress.nextLevel ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("dashboard.skills.progressToNext", {
                            nextLevel: levelProgress.nextLevel,
                          })}
                        </span>
                        <span className="font-medium text-foreground">
                          {levelProgress.progressPercent}%
                        </span>
                      </div>
                      <Progress value={levelProgress.progressPercent} gradient />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("dashboard.skills.maxLevel")}
                    </div>
                  )}

                  {/* Per-skill bars */}
                  <div className="space-y-3">
                    {SKILL_KEYS.map((key) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t(`progress.skills.${key}`)}
                          </span>
                          <span className="font-medium text-foreground">{profile.skills[key]}</span>
                        </div>
                        <div className={`h-1.5 w-full rounded-full ${colors.barTrack}`}>
                          <div
                            className={`h-full rounded-full transition-all ${colors.bar}`}
                            style={{ width: `${profile.skills[key]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-foreground-muted">
                  {t("progress.skills.noData")}
                </div>
              )}
            </div>

            {/* Focus Areas */}
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <h2 className="font-semibold mb-4">{t("progress.focusAreas.title")}</h2>
              {weakAreas && weakAreas.length > 0 ? (
                <div className="space-y-3">
                  {weakAreas.map((area, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium capitalize">{area.topic}</p>
                        <p className="text-xs text-foreground-muted capitalize">{area.skill}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground-muted">{area.score}%</p>
                        <p className="text-xs text-foreground-muted">
                          {t("progress.focusAreas.questions", { count: area.questionCount })}
                        </p>
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
          <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
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
            <div className="rounded-xl backdrop-blur-md bg-surface/80 dark:bg-white/[0.03] border border-border dark:border-white/10 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <h2 className="font-semibold mb-4">{t("progress.languages.title")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allProfiles.map((p) => {
                  const avgSkill = Math.round(
                    (p.skills.vocabulary +
                      p.skills.grammar +
                      p.skills.reading +
                      p.skills.listening) /
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
                      <p className="text-xs text-foreground-muted mt-1">
                        {t("progress.languages.average", { percent: avgSkill })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

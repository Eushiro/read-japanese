import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  Clock,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Map exam types to colors (names/descriptions come from i18n)
const EXAM_COLORS: Record<string, string> = {
  jlpt_n5: "bg-green-500",
  jlpt_n4: "bg-green-600",
  jlpt_n3: "bg-yellow-500",
  jlpt_n2: "bg-orange-500",
  jlpt_n1: "bg-red-500",
  toefl: "bg-blue-500",
  delf_a1: "bg-indigo-400",
  delf_a2: "bg-indigo-500",
  delf_b1: "bg-indigo-600",
  delf_b2: "bg-indigo-700",
};

export function ExamsPage() {
  const { user, isAuthenticated } = useAuth();
  const t = useT();

  // Get available exam templates
  const templates = useQuery(
    api.examTemplates.list,
    isAuthenticated ? { publishedOnly: true } : "skip"
  );

  // Get user's exam analytics
  const analytics = useQuery(
    api.examAttempts.getAnalytics,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );

  // Get in-progress attempts
  const inProgressAttempts = useQuery(
    api.examAttempts.listByUser,
    isAuthenticated && user ? { userId: user.id, status: "in_progress", limit: 5 } : "skip"
  );

  // Get learner profile for readiness
  const learnerProfile = useQuery(
    api.learnerModel.getProfile,
    isAuthenticated && user ? { userId: user.id, language: "japanese" } : "skip"
  );

  // Group templates by exam type
  const templatesByType = templates?.reduce(
    (acc, template) => {
      if (!acc[template.examType]) {
        acc[template.examType] = [];
      }
      acc[template.examType].push(template);
      return acc;
    },
    {} as Record<string, typeof templates>
  );

  // Get analytics as a map
  const analyticsMap = Array.isArray(analytics)
    ? analytics.reduce(
        (acc, a) => {
          acc[a.examType] = a;
          return acc;
        },
        {} as Record<string, (typeof analytics)[0]>
      )
    : analytics
      ? { [analytics.examType]: analytics }
      : {};

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto text-center">
          <BookOpen className="w-16 h-16 mx-auto text-foreground-muted mb-4" />
          <h1 className="text-2xl font-bold mb-4">{t("exams.signIn.title")}</h1>
          <p className="text-foreground-muted mb-6">{t("exams.signIn.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("exams.hero.title")}</h1>
          <p className="text-foreground-muted">{t("exams.hero.subtitle")}</p>
        </div>

        {/* Readiness Indicator */}
        {learnerProfile && (
          <div className="bg-surface rounded-xl border border-border p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t("exams.readiness.title")}</h2>
              <Link
                to="/progress"
                className="text-sm text-accent hover:underline flex items-center gap-1"
              >
                {t("exams.readiness.viewProgress")} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  learnerProfile.readiness.level === "confident"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : learnerProfile.readiness.level === "ready"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : learnerProfile.readiness.level === "almost_ready"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {learnerProfile.readiness.level === "confident"
                  ? t("exams.readiness.levels.confident")
                  : learnerProfile.readiness.level === "ready"
                    ? t("exams.readiness.levels.ready")
                    : learnerProfile.readiness.level === "almost_ready"
                      ? t("exams.readiness.levels.almostReady")
                      : t("exams.readiness.levels.keepStudying")}
              </div>
              <div className="text-sm text-foreground-muted">
                {t("exams.readiness.vocabularyMastered", {
                  known: learnerProfile.vocabCoverage?.known || 0,
                  total: learnerProfile.vocabCoverage?.totalWords || "?",
                })}
              </div>
            </div>
          </div>
        )}

        {/* In Progress Exams */}
        {inProgressAttempts && inProgressAttempts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              {t("exams.continueExam.title")}
            </h2>
            <div className="space-y-3">
              {inProgressAttempts.map((attempt) => (
                <Link
                  key={attempt._id}
                  to="/exams/$templateId"
                  params={{ templateId: attempt.templateId }}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border hover:border-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {t(`exams.examTypes.${attempt.examType}.name`, {
                        defaultValue: attempt.examType,
                      })}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {t("exams.continueExam.questionsAnswered", {
                        answered: attempt.questions.filter((q) => q.userAnswer).length,
                        total: attempt.questions.length,
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-foreground-muted" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Available Exams */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{t("exams.available.title")}</h2>

          {templates === undefined ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 bg-surface rounded-xl border border-border">
              <AlertCircle className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
              <p className="text-foreground-muted">{t("exams.available.empty")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(templatesByType || {}).map(([examType, exams]) => {
                const color = EXAM_COLORS[examType] || "bg-gray-500";
                const examAnalytics = analyticsMap[examType];

                return (
                  <div
                    key={examType}
                    className="bg-surface rounded-xl border border-border overflow-hidden"
                  >
                    {/* Exam Type Header */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${color}`} />
                          <div>
                            <h3 className="font-semibold">
                              {t(`exams.examTypes.${examType}.name`, { defaultValue: examType })}
                            </h3>
                            <p className="text-sm text-foreground-muted">
                              {t(`exams.examTypes.${examType}.description`, { defaultValue: "" })}
                            </p>
                          </div>
                        </div>
                        {examAnalytics && (
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-foreground-muted">
                              <Target className="w-4 h-4" />
                              {t("exams.available.attempts", {
                                count: examAnalytics.totalAttempts,
                              })}
                            </div>
                            <div className="flex items-center gap-1 text-foreground-muted">
                              <Trophy className="w-4 h-4 text-yellow-500" />
                              {t("exams.available.best", { score: examAnalytics.highestScore })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Exam List */}
                    <div className="divide-y divide-border">
                      {exams?.map((template) => (
                        <Link
                          key={template._id}
                          to="/exams/$templateId"
                          params={{ templateId: template._id }}
                          className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{template.title}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-foreground-muted">
                              {template.year && <span>{template.year}</span>}
                              <span>
                                {t("exams.available.questions", {
                                  count: template.sections.reduce(
                                    (sum, s) => sum + s.questionCount,
                                    0
                                  ),
                                })}
                              </span>
                              {template.totalTimeLimitMinutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {t("exams.available.minutes", {
                                    count: template.totalTimeLimitMinutes,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-foreground-muted" />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Results */}
        {analyticsMap && Object.keys(analyticsMap).length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {t("exams.progress.title")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(analyticsMap).map(([examType, data]) => {
                return (
                  <div key={examType} className="p-4 bg-surface rounded-lg border border-border">
                    <h4 className="font-medium mb-2">
                      {t(`exams.examTypes.${examType}.name`, { defaultValue: examType })}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-foreground-muted">{t("exams.progress.average")}</span>
                        <span>{data.averageScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground-muted">{t("exams.progress.best")}</span>
                        <span className="text-green-500">{data.highestScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground-muted">
                          {t("exams.progress.attempts")}
                        </span>
                        <span>{data.totalAttempts}</span>
                      </div>
                    </div>
                    {data.weakAreas && data.weakAreas.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-foreground-muted mb-1">
                          {t("exams.progress.focusAreas")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {data.weakAreas.slice(0, 3).map((area) => (
                            <span
                              key={area}
                              className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

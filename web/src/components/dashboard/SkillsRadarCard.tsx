import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { SignInButton } from "@/contexts/AuthContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { LanguageColorScheme } from "@/lib/languageColors";

interface SkillScores {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
}

interface SkillsRadarCardProps {
  language: ContentLanguage;
  skills: SkillScores;
  isPreview: boolean;
  colorScheme: LanguageColorScheme;
}

// Color configurations for each scheme
const colorConfigs: Record<
  LanguageColorScheme,
  {
    iconBg: string;
    iconText: string;
    stroke: string;
    fill: string;
    glowFrom: string;
    glowTo: string;
    buttonGradient: string;
    chipStyle: string;
  }
> = {
  blue: {
    iconBg: "bg-blue-500/20",
    iconText: "text-blue-400",
    stroke: "#3b82f6", // blue-500
    fill: "#3b82f6",
    glowFrom: "from-blue-500/10",
    glowTo: "to-sky-500/5",
    buttonGradient: "from-blue-500 to-sky-500",
    chipStyle: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  purple: {
    iconBg: "bg-purple-500/20",
    iconText: "text-purple-400",
    stroke: "#a855f7", // purple-500
    fill: "#a855f7",
    glowFrom: "from-purple-500/10",
    glowTo: "to-violet-500/5",
    buttonGradient: "from-purple-500 to-violet-500",
    chipStyle: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  },
  orange: {
    iconBg: "bg-orange-500/20",
    iconText: "text-orange-400",
    stroke: "#f97316", // orange-500
    fill: "#f97316",
    glowFrom: "from-orange-500/10",
    glowTo: "to-amber-500/5",
    buttonGradient: "from-orange-500 to-amber-500",
    chipStyle: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  },
};

export function SkillsRadarCard({
  language,
  skills,
  isPreview,
  colorScheme,
}: SkillsRadarCardProps) {
  const t = useT();
  const colors = colorConfigs[colorScheme];

  // Prepare skill data for radar chart
  const skillData = [
    { skill: t("progress.skills.vocabulary"), value: skills.vocabulary, fullMark: 100 },
    { skill: t("progress.skills.grammar"), value: skills.grammar, fullMark: 100 },
    { skill: t("progress.skills.reading"), value: skills.reading, fullMark: 100 },
    { skill: t("progress.skills.listening"), value: skills.listening, fullMark: 100 },
    { skill: t("progress.skills.writing"), value: skills.writing, fullMark: 100 },
    { skill: t("progress.skills.speaking"), value: skills.speaking, fullMark: 100 },
  ];

  // Find weak areas (skills below 50% are red, 50-70% are yellow)
  const weakAreas = Object.entries(skills)
    .map(([skill, value]) => ({ skill, value }))
    .filter((s) => s.value < 70)
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className="relative group"
    >
      {/* Ambient glow */}
      <div
        className={`absolute -inset-4 bg-gradient-to-br ${colors.glowFrom} via-transparent ${colors.glowTo} rounded-[2rem] blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      {/* Card */}
      <div className="relative rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
        {/* Glass inner glow */}
        <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none rounded-2xl" />

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
              <TrendingUp className={`w-4 h-4 ${colors.iconText}`} />
            </div>
            <h3 className="font-semibold text-foreground">{t(`common.languages.${language}`)}</h3>
          </div>

          {/* Radar Chart */}
          <div className="h-[200px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skillData}>
                <PolarGrid stroke="currentColor" className="text-border" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: "currentColor", className: "text-foreground-muted text-[10px]" }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Skills"
                  dataKey="value"
                  stroke={colors.stroke}
                  fill={colors.fill}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Focus Areas Chips */}
          {weakAreas.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">
                {t("dashboard.skills.focusAreas")}
              </p>
              <div className="flex flex-wrap gap-2">
                {weakAreas.map(({ skill, value }) => (
                  <span
                    key={skill}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.chipStyle}`}
                  >
                    {t(`progress.skills.${skill}`)}
                    <span className="opacity-70">{value}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview overlay */}
        {isPreview && (
          <div className="absolute inset-0 backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground mb-3">{t("dashboard.skills.noData")}</p>
            <SignInButton mode="modal">
              <button
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r ${colors.buttonGradient} hover:opacity-90 transition-opacity`}
              >
                {t("common.actions.signIn")}
              </button>
            </SignInButton>
          </div>
        )}
      </div>
    </motion.div>
  );

  return cardContent;
}

// Skeleton loading state
export function SkillsRadarCardSkeleton() {
  return (
    <div className="rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-5 w-20 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-[200px] sm:h-[220px] flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-white/5 animate-pulse" />
      </div>
      <div className="mt-4">
        <div className="h-3 w-16 bg-white/5 rounded animate-pulse mb-2" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-white/5 rounded-full animate-pulse" />
          <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

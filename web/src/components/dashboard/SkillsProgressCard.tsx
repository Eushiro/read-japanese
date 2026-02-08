import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SignInButton } from "@/contexts/AuthContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import type { LanguageColorScheme } from "@/lib/languageColors";
import { abilityToProgress, getLevelVariant } from "@/lib/levels";

interface SkillScores {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  writing: number;
  speaking: number;
}

interface SkillsProgressCardProps {
  language: ContentLanguage;
  skills: SkillScores;
  abilityEstimate: number;
  isPreview: boolean;
  colorScheme: LanguageColorScheme;
  showLanguageHeader?: boolean;
}

// Color configs for skill bar accent colors per scheme
const schemeColors: Record<LanguageColorScheme, string> = {
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
};

const schemeTrackColors: Record<LanguageColorScheme, string> = {
  orange: "bg-orange-500/20",
  purple: "bg-purple-500/20",
  blue: "bg-blue-500/20",
};

const SKILL_KEYS = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "writing",
  "speaking",
] as const;

export function SkillsProgressCard({
  language,
  skills,
  abilityEstimate,
  isPreview,
  colorScheme,
  showLanguageHeader = true,
}: SkillsProgressCardProps) {
  const t = useT();
  const { currentLevel, nextLevel, progressPercent } = abilityToProgress(abilityEstimate, language);
  const levelVariant = getLevelVariant(currentLevel);

  const sortedSkills = SKILL_KEYS.map((key) => ({ key, value: skills[key] })).sort(
    (a, b) => b.value - a.value
  );
  const bestSkill = sortedSkills[0];
  const focusSkill = sortedSkills[sortedSkills.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className="relative space-y-6"
    >
      {/* Language header (shown in multi-language mode) */}
      {showLanguageHeader && (
        <h3 className="font-semibold text-foreground">{t(`common.languages.${language}`)}</h3>
      )}

      {/* Current level badge */}
      <div className="flex items-center gap-3">
        <Badge variant={levelVariant} className="text-lg px-4 py-1">
          {currentLevel}
        </Badge>
        <span className="text-sm text-muted-foreground">{t("dashboard.skills.currentLevel")}</span>
      </div>

      {/* Progress to next level */}
      {nextLevel ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("dashboard.skills.progressToNext", { nextLevel })}
            </span>
            <span className="font-medium text-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} gradient />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{t("dashboard.skills.maxLevel")}</div>
      )}

      {/* Per-skill bars */}
      <div className="space-y-3">
        {SKILL_KEYS.map((key) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t(`progress.skills.${key}`)}</span>
              <span className="font-medium text-foreground">{skills[key]}</span>
            </div>
            <div className={`h-1.5 w-full rounded-full ${schemeTrackColors[colorScheme]}`}>
              <div
                className={`h-full rounded-full transition-all ${schemeColors[colorScheme]}`}
                style={{ width: `${skills[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("dashboard.skills.summary", {
            best: t(`progress.skills.${bestSkill.key}`),
            focus: t(`progress.skills.${focusSkill.key}`),
          })}
        </p>
        {!isPreview && (
          <Link
            to="/adaptive-practice"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 border border-white/10 hover:bg-white/15 transition-colors"
          >
            {t("dashboard.skills.practice", {
              skill: t(`progress.skills.${focusSkill.key}`),
            })}
          </Link>
        )}
      </div>

      {/* Preview overlay */}
      {isPreview && (
        <div className="absolute inset-0 backdrop-blur-sm bg-background/60 flex flex-col items-center justify-center rounded-xl">
          <p className="text-sm text-muted-foreground mb-3">{t("dashboard.skills.noData")}</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 transition-opacity">
              {t("common.actions.signIn")}
            </button>
          </SignInButton>
        </div>
      )}
    </motion.div>
  );
}

// Skeleton loading state
export function SkillsProgressCardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-14 bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-8 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

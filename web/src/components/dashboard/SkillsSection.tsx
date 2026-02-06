import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ChevronRight, Target } from "lucide-react";

import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";
import { getLanguageColorScheme } from "@/lib/languageColors";

import { api } from "../../../convex/_generated/api";
import { SkillsRadarCard, SkillsRadarCardSkeleton } from "./SkillsRadarCard";

interface SkillsSectionProps {
  userId: string;
  userLanguages: ContentLanguage[];
  isPreview: boolean;
}

// Sample data for preview mode
const SAMPLE_SKILLS = {
  vocabulary: 65,
  grammar: 45,
  reading: 72,
  listening: 58,
  writing: 40,
  speaking: 35,
};

// Default skills for languages without a learner profile yet
const DEFAULT_SKILLS = {
  vocabulary: 50,
  grammar: 50,
  reading: 50,
  listening: 50,
  writing: 50,
  speaking: 50,
};

export function SkillsSection({ userId, userLanguages, isPreview }: SkillsSectionProps) {
  const t = useT();

  // Fetch all learner profiles for the user
  const allProfiles = useQuery(api.learnerModel.getAllProfiles, isPreview ? "skip" : { userId });

  // Build a map of language -> profile for quick lookup
  const profilesByLanguage = new Map((allProfiles ?? []).map((p) => [p.language, p]));

  // Get skills for a language (from profile or default)
  const getSkillsForLanguage = (lang: ContentLanguage) => {
    const profile = profilesByLanguage.get(lang);
    return profile?.skills ?? DEFAULT_SKILLS;
  };

  // Loading state
  if (!isPreview && allProfiles === undefined) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="relative py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("dashboard.skills.title")}
              </h2>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <SkillsRadarCardSkeleton />
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  // Preview mode - show sample data
  if (isPreview) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Ambient glow pool */}
        <div className="absolute -inset-12 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 rounded-[4rem] blur-3xl pointer-events-none" />

        <div className="relative py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"
              >
                <Target className="w-5 h-5 text-purple-400" />
              </motion.div>
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("dashboard.skills.title")}
              </h2>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <SkillsRadarCard
                language="japanese"
                skills={SAMPLE_SKILLS}
                isPreview
                colorScheme="orange"
              />
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  // No languages selected - show empty state prompting to take placement test
  if (userLanguages.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="absolute -inset-12 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 rounded-[4rem] blur-3xl pointer-events-none" />

        <div className="relative py-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"
              >
                <Target className="w-5 h-5 text-purple-400" />
              </motion.div>
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("dashboard.skills.title")}
              </h2>
            </div>
          </div>

          {/* Empty state */}
          <div className="rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-muted-foreground mb-4">{t("dashboard.skills.noData")}</p>
            <Link
              to="/adaptive-practice"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 transition-opacity"
            >
              {t("dashboard.cta.startPractice")}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.section>
    );
  }

  // Render radar cards for each of the user's languages
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {/* Ambient glow pool */}
      <div className="absolute -inset-12 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/5 rounded-[4rem] blur-3xl pointer-events-none" />

      <div className="relative py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"
            >
              <Target className="w-5 h-5 text-purple-400" />
            </motion.div>
            <h2
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("dashboard.skills.title")}
            </h2>
          </div>
          <Link
            to="/progress"
            className="text-sm text-muted-foreground hover:text-foreground/80 flex items-center gap-1 transition-colors"
          >
            {t("dashboard.skills.viewProgress")}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Radar cards - centered for single, grid for multiple */}
        {userLanguages.length === 1 ? (
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <SkillsRadarCard
                language={userLanguages[0]}
                skills={getSkillsForLanguage(userLanguages[0])}
                isPreview={false}
                colorScheme={getLanguageColorScheme(0, 1)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userLanguages.map((lang, index) => (
              <SkillsRadarCard
                key={lang}
                language={lang}
                skills={getSkillsForLanguage(lang)}
                isPreview={false}
                colorScheme={getLanguageColorScheme(index, userLanguages.length)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

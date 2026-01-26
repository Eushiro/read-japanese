import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Globe,
  GraduationCap,
  Headphones,
  Languages,
  Mic,
  PenLine,
  Sparkles,
  Target,
  Volume2,
} from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";

import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const t = useT();

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero Section */}
      <HeroSection isAuthenticated={isAuthenticated} t={t} />

      {/* Supported Exams - Floating Cards */}
      <ExamsSection t={t} />

      {/* What Makes Us Different */}
      <ComparisonSection t={t} />

      {/* The Learning Loop - Connected Flow */}
      <LearningLoopSection t={t} />

      {/* Features - Bento Grid */}
      <FeaturesSection t={t} />

      {/* CTA Section */}
      <CTASection isAuthenticated={isAuthenticated} t={t} />
    </div>
  );
}

// ============================================================================
// HERO SECTION - Dramatic entrance with floating orbs
// ============================================================================

function HeroSection({
  isAuthenticated,
  t,
}: {
  isAuthenticated: boolean;
  t: ReturnType<typeof useT>;
}) {
  const [examIndex, setExamIndex] = useState(0);
  const examNames = [
    t("landing.hero.examName1"),
    t("landing.hero.examName2"),
    t("landing.hero.examName3"),
    t("landing.hero.examName4"),
    t("landing.hero.examName5"),
    t("landing.hero.examName6"),
  ];

  // Rotate through exam names
  useEffect(() => {
    const interval = setInterval(() => {
      setExamIndex((prev) => (prev + 1) % examNames.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [examNames.length]);

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Floating stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 10) % 100}%`,
              opacity: 0.1 + (i % 4) * 0.1,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + (i % 5),
              repeat: Infinity,
              delay: (i % 8) * 0.6,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
          style={{
            background: "radial-gradient(circle, #ff8400 0%, transparent 70%)",
            top: "10%",
            left: "20%",
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-25"
          style={{
            background: "radial-gradient(circle, #df91f7 0%, transparent 70%)",
            bottom: "20%",
            right: "15%",
          }}
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-20"
          style={{
            background: "radial-gradient(circle, #feed7a 0%, transparent 70%)",
            top: "50%",
            right: "30%",
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, -80, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Title - with animated exam name on separate line */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
          >
            <h1
              className="text-[clamp(2rem,8vw,6rem)] font-semibold leading-[0.95] tracking-tight text-foreground whitespace-nowrap"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.hero.title")}
            </h1>
            <div
              className="mt-2 text-[clamp(2rem,8vw,6rem)] font-semibold leading-[0.95] tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={examIndex}
                  className="inline-block bg-gradient-to-r from-yellow-300 via-orange-400 to-purple-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                >
                  {examNames[examIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Subtitle - fade up */}
          <motion.p
            className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.19, 1, 0.22, 1] }}
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          {/* Buttons - with enhanced styling */}
          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.19, 1, 0.22, 1] }}
          >
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button
                  size="lg"
                  className="group relative w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {/* Pulsing glow */}
                  <span className="absolute inset-0 animate-pulse-glow rounded-lg" />
                  <BookOpen className="w-5 h-5 mr-2 relative z-10" />
                  <span className="relative z-10">{t("landing.hero.startLearning")}</span>
                  <ArrowRight className="w-4 h-4 ml-2 relative z-10" />
                </Button>
              </Link>
            ) : (
              <SignInButton mode="modal">
                <Button
                  size="lg"
                  className="group relative w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {/* Pulsing glow */}
                  <span className="absolute inset-0 animate-pulse-glow rounded-lg" />
                  <Sparkles className="w-5 h-5 mr-2 relative z-10" />
                  <span className="relative z-10">{t("landing.hero.getStartedFree")}</span>
                  <ArrowRight className="w-4 h-4 ml-2 relative z-10" />
                </Button>
              </SignInButton>
            )}
            <Link to="/library">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <BookOpen className="w-5 h-5 mr-2" />
                {t("landing.hero.browseLibrary")}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator - bouncing chevron */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {t("landing.hero.scroll")}
          </span>
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ============================================================================
// EXAMS SECTION - 3D Tilt Cards
// ============================================================================

function ExamsSection({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <section className="py-32 relative">
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2
            className="text-4xl sm:text-5xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.exams.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("landing.exams.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <TiltCard delay={0}>
            <LanguageExamCard
              languageName={t("landing.exams.japanese")}
              tagline={t("landing.exams.japaneseTagline")}
              exams={[
                t("landing.exams.jlptN5"),
                t("landing.exams.jlptN4"),
                t("landing.exams.jlptN3"),
                t("landing.exams.jlptN2"),
                t("landing.exams.jlptN1"),
              ]}
              gradient="from-red-500/20 via-red-600/10 to-transparent"
              accentColor="text-red-400"
              borderColor="border-red-500/30 hover:border-red-500/50"
              icon={Languages}
              stat={t("landing.exams.japaneseStat")}
              skills={["reading", "listening", "writing", "speaking"]}
              language="japanese"
            />
          </TiltCard>
          <TiltCard delay={0.1}>
            <LanguageExamCard
              languageName={t("landing.exams.english")}
              tagline={t("landing.exams.englishTagline")}
              exams={[t("landing.exams.toefl"), t("landing.exams.sat"), t("landing.exams.gre")]}
              gradient="from-blue-500/20 via-blue-600/10 to-transparent"
              accentColor="text-blue-400"
              borderColor="border-blue-500/30 hover:border-blue-500/50"
              icon={Globe}
              stat={t("landing.exams.englishStat")}
              skills={["reading", "listening", "writing", "speaking"]}
              language="english"
            />
          </TiltCard>
          <TiltCard delay={0.2}>
            <LanguageExamCard
              languageName={t("landing.exams.french")}
              tagline={t("landing.exams.frenchTagline")}
              exams={[t("landing.exams.delf"), t("landing.exams.dalf"), t("landing.exams.tcf")]}
              gradient="from-purple-500/20 via-purple-600/10 to-transparent"
              accentColor="text-purple-400"
              borderColor="border-purple-500/30 hover:border-purple-500/50"
              icon={GraduationCap}
              stat={t("landing.exams.frenchStat")}
              skills={["reading", "listening", "writing", "speaking"]}
              language="french"
            />
          </TiltCard>
        </div>
      </div>
    </section>
  );
}

function TiltCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: [0.19, 1, 0.22, 1] }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="h-full cursor-pointer"
    >
      {children}
    </motion.div>
  );
}

type SkillType = "reading" | "listening" | "writing" | "speaking";

const skillIcons: Record<SkillType, React.ComponentType<{ className?: string }>> = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenLine,
  speaking: Mic,
};

const examColors: Record<ContentLanguage, string[]> = {
  japanese: ["#fbbf24", "#f59e0b", "#ea580c", "#dc2626", "#b91c1c"], // amber → red
  english: ["#22d3ee", "#0ea5e9", "#2563eb"], // cyan → blue (toned down)
  french: ["#e879f9", "#c084fc", "#a855f7"], // fuchsia → violet (boosted)
};

function DecorativePattern({
  language,
  accentColor,
}: {
  language: ContentLanguage;
  accentColor: string;
}) {
  const colorClass = accentColor.replace("text-", "");

  if (language === "japanese") {
    // Seigaiha-inspired wave pattern
    return (
      <svg
        className={`absolute -top-4 -right-4 w-40 h-40 opacity-10 text-${colorClass}`}
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <defs>
          <pattern id="waves" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M0 20 Q5 10 10 20 Q15 30 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M0 15 Q5 5 10 15 Q15 25 20 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M0 10 Q5 0 10 10 Q15 20 20 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#waves)" />
      </svg>
    );
  }

  if (language === "english") {
    // Geometric globe/circle pattern
    return (
      <svg
        className={`absolute -top-4 -right-4 w-40 h-40 opacity-10 text-${colorClass}`}
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="70" cy="30" r="25" strokeWidth="1.5" />
        <circle cx="70" cy="30" r="18" strokeWidth="1" />
        <circle cx="70" cy="30" r="11" strokeWidth="1" />
        <ellipse cx="70" cy="30" rx="25" ry="10" strokeWidth="1" />
        <ellipse cx="70" cy="30" rx="10" ry="25" strokeWidth="1" />
        <line x1="45" y1="30" x2="95" y2="30" strokeWidth="1" />
        <line x1="70" y1="5" x2="70" y2="55" strokeWidth="1" />
      </svg>
    );
  }

  // French - elegant arc/flourish pattern
  return (
    <svg
      className={`absolute -top-4 -right-4 w-40 h-40 opacity-10 text-${colorClass}`}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
    >
      <path d="M50 10 Q90 10 90 50 Q90 90 50 90" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M55 20 Q80 20 80 50 Q80 80 55 80" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M60 30 Q70 30 70 50 Q70 70 60 70" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="75" cy="25" r="3" fill="currentColor" />
      <circle cx="80" cy="50" r="2" fill="currentColor" />
      <circle cx="75" cy="75" r="3" fill="currentColor" />
    </svg>
  );
}

function LanguageExamCard({
  languageName,
  tagline,
  exams,
  gradient,
  accentColor,
  borderColor,
  icon: Icon,
  stat,
  skills,
  language,
}: {
  languageName: string;
  tagline: string;
  exams: string[];
  gradient: string;
  accentColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  stat: string;
  skills: SkillType[];
  language: ContentLanguage;
}) {
  const allSkills: SkillType[] = ["reading", "listening", "writing", "speaking"];

  return (
    <div
      className={`relative h-full min-h-[280px] p-6 rounded-2xl bg-gradient-to-br ${gradient} border ${borderColor} backdrop-blur-md transition-all duration-300 group overflow-hidden`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-white/[0.02] rounded-2xl" />
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-2xl" />

      {/* Decorative pattern */}
      <DecorativePattern language={language} accentColor={accentColor} />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
      />

      <div style={{ transform: "translateZ(20px)" }} className="relative z-10 h-full flex flex-col">
        {/* Icon and language */}
        <div className="flex items-center gap-3 mb-1">
          <div
            className={`p-2 rounded-lg ${accentColor.replace("text-", "bg-")}/20 backdrop-blur-sm`}
          >
            <Icon className={`w-5 h-5 ${accentColor}`} />
          </div>
          <h3 className="text-2xl font-semibold text-foreground">{languageName}</h3>
        </div>

        {/* Stat */}
        <p className={`text-sm font-medium ${accentColor} mb-1 ml-12`}>{stat}</p>

        {/* Tagline */}
        <p className="text-sm text-muted-foreground mb-4">{tagline}</p>

        {/* Skills icons */}
        <div className="flex gap-2 mb-5">
          {allSkills.map((skill) => {
            const SkillIcon = skillIcons[skill];
            const isActive = skills.includes(skill);
            return (
              <div
                key={skill}
                className={`p-1.5 rounded-full ${
                  isActive
                    ? `${accentColor.replace("text-", "bg-")}/20 ${accentColor}`
                    : "bg-white/5 text-muted-foreground/40"
                } transition-colors`}
                title={skill.charAt(0).toUpperCase() + skill.slice(1)}
              >
                <SkillIcon className="w-3.5 h-3.5" />
              </div>
            );
          })}
        </div>

        {/* Exams */}
        <div className="flex flex-wrap gap-1.5">
          {exams.map((exam, index) => {
            const colors = examColors[language];
            const badgeColor = colors[index % colors.length];
            return (
              <span
                key={exam}
                className="px-3 py-1.5 rounded-lg backdrop-blur-md text-base font-semibold whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] bg-white/80 dark:bg-black/30"
                style={{
                  borderWidth: "1px",
                  borderColor: badgeColor,
                  color: badgeColor,
                }}
              >
                {exam}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPARISON SECTION - Side by side with glow
// ============================================================================

function ComparisonSection({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <section className="py-32 relative overflow-hidden">
      {/* Pulsing background glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-orange-500/10 rounded-full blur-[150px]"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2
            className="text-4xl sm:text-5xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.comparison.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("landing.comparison.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Us - Glowing card */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-purple-500/10 dark:from-orange-500/20 dark:to-purple-500/20 rounded-3xl blur-xl" />
            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-orange-500/5 to-purple-500/[0.02] dark:from-orange-500/10 dark:to-purple-500/5 border border-orange-500/20 dark:border-orange-500/30 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-orange-600 dark:text-orange-400 mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t("landing.comparison.sanlang")}
              </h3>
              <ul className="space-y-4">
                {[
                  t("landing.comparison.us.item1"),
                  t("landing.comparison.us.item2"),
                  t("landing.comparison.us.item3"),
                  t("landing.comparison.us.item4"),
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  >
                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-foreground/80">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Others - Muted card */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-border">
              <h3 className="text-xl font-semibold text-muted-foreground mb-6">
                {t("landing.comparison.others")}
              </h3>
              <ul className="space-y-4">
                {[
                  t("landing.comparison.them.item1"),
                  t("landing.comparison.them.item2"),
                  t("landing.comparison.them.item3"),
                  t("landing.comparison.them.item4"),
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  >
                    <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LEARNING LOOP - Connected flowing cards
// ============================================================================

function LearningLoopSection({ t }: { t: ReturnType<typeof useT> }) {
  const steps = [
    {
      icon: BookOpen,
      title: t("landing.loop.input.title"),
      desc: t("landing.loop.input.description"),
      color: "yellow",
    },
    {
      icon: BookmarkCheck,
      title: t("landing.loop.capture.title"),
      desc: t("landing.loop.capture.description"),
      color: "orange",
    },
    {
      icon: Brain,
      title: t("landing.loop.review.title"),
      desc: t("landing.loop.review.description"),
      color: "purple",
    },
    {
      icon: PenLine,
      title: t("landing.loop.output.title"),
      desc: t("landing.loop.output.description"),
      color: "pink",
    },
  ];

  const colorStyles = {
    yellow: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      glow: "shadow-yellow-500/30",
      border: "border-yellow-500/30",
    },
    orange: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      glow: "shadow-orange-500/30",
      border: "border-orange-500/30",
    },
    purple: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      glow: "shadow-purple-500/30",
      border: "border-purple-500/30",
    },
    pink: {
      bg: "bg-pink-500/20",
      text: "text-pink-400",
      glow: "shadow-pink-500/30",
      border: "border-pink-500/30",
    },
  };

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2
            className="text-4xl sm:text-5xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.loop.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("landing.loop.subtitle")}
          </p>
        </motion.div>

        {/* Connected cards with flowing line */}
        <div className="relative max-w-5xl mx-auto">
          {/* Animated gradient line */}
          <motion.div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 overflow-hidden">
            <motion.div
              className="h-full w-[200%] bg-gradient-to-r from-yellow-500/20 via-orange-500/20 via-purple-500/20 to-pink-500/20 dark:from-yellow-500/50 dark:via-orange-500/50 dark:via-purple-500/50 dark:to-pink-500/50"
              animate={{ x: ["-50%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const colors = colorStyles[step.color as keyof typeof colorStyles];

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 60, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: index * 0.15, ease: [0.19, 1, 0.22, 1] }}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="relative"
                >
                  <div
                    className={`h-full p-6 rounded-2xl bg-white/[0.03] border ${colors.border} backdrop-blur-sm relative overflow-hidden group`}
                  >
                    {/* Glow effect on hover */}
                    <div
                      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${colors.bg.replace("/20", "/10")} to-transparent`}
                    />

                    {/* Step number */}
                    <div
                      className={`absolute top-3 right-3 w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center text-xs font-bold ${colors.text}`}
                    >
                      {index + 1}
                    </div>

                    <div className="relative">
                      {/* Icon with glow */}
                      <motion.div
                        className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4 shadow-lg ${colors.glow}`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Icon className={`w-7 h-7 ${colors.text}`} />
                      </motion.div>

                      <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURES - Bento Grid Layout
// ============================================================================

function FeaturesSection({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <section className="py-32 relative">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2
            className="text-4xl sm:text-5xl font-semibold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.features.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("landing.features.subtitle")}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {/* Large card - AI Flashcards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="md:col-span-2 lg:col-span-1 lg:row-span-2"
          >
            <BentoCard
              icon={Sparkles}
              title={t("landing.features.flashcards.title")}
              description={t("landing.features.flashcards.description")}
              gradient="from-orange-500/20 to-yellow-500/10"
              iconColor="text-orange-400"
              iconBg="bg-orange-500/20"
              large
            />
          </motion.div>

          {/* Writing Practice */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <BentoCard
              icon={PenLine}
              title={t("landing.features.writing.title")}
              description={t("landing.features.writing.description")}
              gradient="from-purple-500/20 to-pink-500/10"
              iconColor="text-purple-400"
              iconBg="bg-purple-500/20"
            />
          </motion.div>

          {/* Personalized */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <BentoCard
              icon={Target}
              title={t("landing.features.personalized.title")}
              description={t("landing.features.personalized.description")}
              gradient="from-yellow-500/20 to-orange-500/10"
              iconColor="text-yellow-400"
              iconBg="bg-yellow-500/20"
            />
          </motion.div>

          {/* Exam Formats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <BentoCard
              icon={GraduationCap}
              title={t("landing.features.exams.title")}
              description={t("landing.features.exams.description")}
              gradient="from-emerald-500/20 to-teal-500/10"
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/20"
            />
          </motion.div>

          {/* Native Audio */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <BentoCard
              icon={Volume2}
              title={t("landing.features.audio.title")}
              description={t("landing.features.audio.description")}
              gradient="from-pink-500/20 to-rose-500/10"
              iconColor="text-pink-400"
              iconBg="bg-pink-500/20"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  icon: Icon,
  title,
  description,
  gradient,
  iconColor,
  iconBg,
  large = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
  iconBg: string;
  large?: boolean;
}) {
  return (
    <motion.div
      className={`group relative h-full rounded-2xl backdrop-blur-md bg-white/[0.03] border border-border dark:border-white/10 overflow-hidden ${large ? "p-8" : "p-6"} shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
      whileHover={{
        boxShadow: "0 0 30px rgba(255,255,255,0.05)",
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Glass highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent rounded-2xl pointer-events-none" />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full bg-white/20 ${i % 2 === 0 ? "w-1 h-1" : "w-0.5 h-0.5"}`}
            style={{
              left: `${10 + i * 15}%`,
              top: "100%",
            }}
            animate={{
              y: [0, -200],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <motion.div
          className={`${large ? "w-16 h-16" : "w-12 h-12"} rounded-xl ${iconBg} backdrop-blur-sm flex items-center justify-center mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Icon className={`${large ? "w-8 h-8" : "w-6 h-6"} ${iconColor}`} />
        </motion.div>

        <h3 className={`${large ? "text-xl" : "text-lg"} font-semibold text-foreground mb-2`}>
          {title}
        </h3>
        <p className={`${large ? "text-base" : "text-sm"} text-muted-foreground leading-relaxed`}>
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// CTA SECTION
// ============================================================================

function CTASection({
  isAuthenticated,
  t,
}: {
  isAuthenticated: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <section className="pt-32 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full blur-[200px] opacity-20"
          style={{
            background: "radial-gradient(circle, #ff8400 0%, #df91f7 50%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Floating sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-orange-400/40 rounded-full"
            style={{
              left: `${10 + i * 10}%`,
              bottom: 0,
            }}
            animate={{
              y: [0, -300],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 4 + (i % 3),
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.cta.title")}
          </h2>
          <p className="text-muted-foreground text-xl mb-10 max-w-xl mx-auto">
            {t("landing.cta.subtitle")}
          </p>

          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 text-black font-semibold shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all text-lg px-10 py-6"
              >
                <BookOpen className="w-6 h-6 mr-2" />
                {t("landing.hero.startLearning")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          ) : (
            <SignInButton mode="modal">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 text-black font-semibold shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all text-lg px-10 py-6"
              >
                <Sparkles className="w-6 h-6 mr-2" />
                {t("landing.cta.getStartedFree")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </SignInButton>
          )}

          <p className="text-sm text-muted-foreground/50 mt-6">{t("landing.cta.noCreditCard")}</p>
        </motion.div>
      </div>

      {/* Footer overlaid on the animated background */}
      <div className="relative z-10 mt-16">
        <Footer />
      </div>
    </section>
  );
}

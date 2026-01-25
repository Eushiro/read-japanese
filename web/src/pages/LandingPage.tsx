import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Brain,
  Check,
  GraduationCap,
  Languages,
  PenLine,
  Sparkles,
  Target,
  Volume2,
} from "lucide-react";

import { AmbientBackground } from "@/components/ui/ambient-background";
import { Button } from "@/components/ui/button";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const t = useT();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden border-b border-border">
        <AmbientBackground variant="warm" />

        <div className="container mx-auto px-4 sm:px-6 py-24 sm:py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] text-sm font-medium mb-8 dark:text-foreground">
                <Sparkles className="w-4 h-4 text-warm-orange" />
                {t("landing.hero.tagline")}
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1
                className="text-[clamp(2.5rem,8vw,5rem)] font-semibold leading-[1.1] tracking-tight mb-8"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("landing.hero.title")}{" "}
                <span className="whitespace-nowrap">
                  <span className="text-gradient-warm">
                    {t("landing.hero.titleHighlight")}
                  </span>
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-lg sm:text-xl text-foreground-muted mb-12 max-w-2xl mx-auto leading-relaxed">
                {t("landing.hero.subtitle")}
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg dark:shadow-orange-500/20">
                      <BookOpen className="w-5 h-5 mr-2" />
                      {t("landing.hero.startLearning")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <SignInButton mode="modal">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg dark:shadow-orange-500/20">
                      <Sparkles className="w-5 h-5 mr-2" />
                      {t("landing.hero.getStartedFree")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </SignInButton>
                )}
                <Link to="/library">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <BookOpen className="w-5 h-5 mr-2" />
                    {t("landing.hero.browseLibrary")}
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* Decorative text */}
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-[200px] font-bold text-white/[0.02] select-none hidden lg:block">
            三
          </div>
        </div>
      </section>

      {/* Supported Exams */}
      <section className="py-24 sm:py-32 bg-background-subtle border-b border-border relative">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <h2
                className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("landing.exams.title")}
              </h2>
              <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
                {t("landing.exams.subtitle")}
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <StaggerItem>
              <LanguageCard
                language={t("landing.exams.japanese")}
                exams={["JLPT N5", "JLPT N4", "JLPT N3", "JLPT N2", "JLPT N1"]}
                color="red"
              />
            </StaggerItem>
            <StaggerItem>
              <LanguageCard
                language={t("landing.exams.english")}
                exams={["TOEFL", "SAT", "GRE"]}
                color="blue"
              />
            </StaggerItem>
            <StaggerItem>
              <LanguageCard
                language={t("landing.exams.french")}
                exams={["DELF A1-B2", "DALF C1-C2", "TCF"]}
                color="purple"
              />
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-24 sm:py-32 relative">
        <AmbientBackground variant="mixed" intensity={0.5} />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <FadeIn>
            <div className="text-center mb-16">
              <h2
                className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("landing.comparison.title")}
              </h2>
              <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
                {t("landing.comparison.subtitle")}
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <StaggerItem>
              <ComparisonCard
                title={t("landing.comparison.sanlang")}
                isUs={true}
                items={[
                  t("landing.comparison.us.item1"),
                  t("landing.comparison.us.item2"),
                  t("landing.comparison.us.item3"),
                  t("landing.comparison.us.item4"),
                ]}
              />
            </StaggerItem>
            <StaggerItem>
              <ComparisonCard
                title={t("landing.comparison.others")}
                isUs={false}
                items={[
                  t("landing.comparison.them.item1"),
                  t("landing.comparison.them.item2"),
                  t("landing.comparison.them.item3"),
                  t("landing.comparison.them.item4"),
                ]}
              />
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* The Learning Loop */}
      <section className="py-24 sm:py-32 bg-background-subtle border-y border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <h2
                className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("landing.loop.title")}
              </h2>
              <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
                {t("landing.loop.subtitle")}
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <StaggerItem>
              <LoopCard
                icon={BookOpen}
                step={1}
                title={t("landing.loop.input.title")}
                description={t("landing.loop.input.description")}
                color="yellow"
              />
            </StaggerItem>
            <StaggerItem>
              <LoopCard
                icon={BookmarkCheck}
                step={2}
                title={t("landing.loop.capture.title")}
                description={t("landing.loop.capture.description")}
                color="orange"
              />
            </StaggerItem>
            <StaggerItem>
              <LoopCard
                icon={Brain}
                step={3}
                title={t("landing.loop.review.title")}
                description={t("landing.loop.review.description")}
                color="purple"
              />
            </StaggerItem>
            <StaggerItem>
              <LoopCard
                icon={PenLine}
                step={4}
                title={t("landing.loop.output.title")}
                description={t("landing.loop.output.description")}
                color="pink"
              />
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32 relative">
        <AmbientBackground variant="cool" intensity={0.4} />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <FadeIn>
            <div className="text-center mb-16">
              <h2
                className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-foreground mb-4"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("landing.features.title")}
              </h2>
              <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
                {t("landing.features.subtitle")}
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <StaggerItem>
              <FeatureCard
                icon={Sparkles}
                title={t("landing.features.flashcards.title")}
                description={t("landing.features.flashcards.description")}
                color="orange"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={PenLine}
                title={t("landing.features.writing.title")}
                description={t("landing.features.writing.description")}
                color="purple"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={Target}
                title={t("landing.features.personalized.title")}
                description={t("landing.features.personalized.description")}
                color="yellow"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={GraduationCap}
                title={t("landing.features.exams.title")}
                description={t("landing.features.exams.description")}
                color="green"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={Volume2}
                title={t("landing.features.audio.title")}
                description={t("landing.features.audio.description")}
                color="pink"
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon={Languages}
                title={t("landing.features.tapDefine.title")}
                description={t("landing.features.tapDefine.description")}
                color="cyan"
              />
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 border-t border-border relative overflow-hidden">
        <AmbientBackground variant="warm" />
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <FadeIn>
            <h2
              className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.cta.title")}
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-foreground-muted text-lg mb-10 max-w-xl mx-auto">
              {t("landing.cta.subtitle")}
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            {isAuthenticated ? (
              <Link to="/library">
                <Button size="lg" className="shadow-lg dark:shadow-orange-500/20">
                  <BookOpen className="w-5 h-5 mr-2" />
                  {t("landing.cta.goToLibrary")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <SignInButton mode="modal">
                <Button size="lg" className="shadow-lg dark:shadow-orange-500/20">
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t("landing.cta.getStartedFree")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </SignInButton>
            )}
            <p className="text-sm text-foreground-muted mt-6">{t("landing.cta.noCreditCard")}</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-foreground-muted">
            <p>{t("landing.footer.tagline")}</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: "purple" | "orange" | "yellow" | "green" | "pink" | "cyan";
}

const featureColorClasses = {
  purple: {
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/20",
    icon: "text-purple-400",
  },
  orange: {
    gradient: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/20 hover:border-orange-500/40",
    iconBg: "bg-orange-500/20",
    icon: "text-orange-400",
  },
  yellow: {
    gradient: "from-yellow-500/10 to-yellow-500/5",
    border: "border-yellow-500/20 hover:border-yellow-500/40",
    iconBg: "bg-yellow-500/20",
    icon: "text-yellow-400",
  },
  green: {
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/20",
    icon: "text-emerald-400",
  },
  pink: {
    gradient: "from-pink-500/10 to-pink-500/5",
    border: "border-pink-500/20 hover:border-pink-500/40",
    iconBg: "bg-pink-500/20",
    icon: "text-pink-400",
  },
  cyan: {
    gradient: "from-cyan-500/10 to-cyan-500/5",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    iconBg: "bg-cyan-500/20",
    icon: "text-cyan-400",
  },
};

function FeatureCard({ icon: Icon, title, description, color }: FeatureCardProps) {
  const colors = featureColorClasses[color];
  return (
    <div
      className={`p-8 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all duration-300 hover:scale-[1.02]`}
    >
      <div
        className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center mb-5`}
      >
        <Icon className={`w-7 h-7 ${colors.icon}`} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

interface LoopCardProps {
  icon: React.ComponentType<{ className?: string }>;
  step: number;
  title: string;
  description: string;
  color: "yellow" | "orange" | "purple" | "pink";
}

const loopColorClasses = {
  yellow: {
    gradient: "from-yellow-500/10 to-yellow-500/5",
    border: "border-yellow-500/20",
    iconBg: "bg-yellow-500/20",
    icon: "text-yellow-400",
    badge: "bg-yellow-500",
  },
  orange: {
    gradient: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/20",
    iconBg: "bg-orange-500/20",
    icon: "text-orange-400",
    badge: "bg-orange-500",
  },
  purple: {
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20",
    iconBg: "bg-purple-500/20",
    icon: "text-purple-400",
    badge: "bg-purple-500",
  },
  pink: {
    gradient: "from-pink-500/10 to-pink-500/5",
    border: "border-pink-500/20",
    iconBg: "bg-pink-500/20",
    icon: "text-pink-400",
    badge: "bg-pink-500",
  },
};

function LoopCard({ icon: Icon, step, title, description, color }: LoopCardProps) {
  const colors = loopColorClasses[color];
  return (
    <div
      className={`text-center p-8 rounded-2xl bg-gradient-to-br ${colors.gradient} border ${colors.border}`}
    >
      <div className="relative inline-block mb-5">
        <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <div
          className={`absolute -top-2 -right-2 w-7 h-7 rounded-full ${colors.badge} text-white text-xs font-bold flex items-center justify-center shadow-lg`}
        >
          {step}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

interface ComparisonCardProps {
  title: string;
  isUs: boolean;
  items: string[];
}

function ComparisonCard({ title, isUs, items }: ComparisonCardProps) {
  return (
    <div
      className={`p-8 rounded-2xl border-2 transition-all duration-300 ${
        isUs
          ? "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-purple-500/5 dark:hover:border-orange-500/50"
          : "border-border bg-background-subtle"
      }`}
    >
      <h3
        className={`text-lg font-semibold mb-5 ${isUs ? "text-warm-orange dark:text-orange-400" : "text-foreground-muted"}`}
      >
        {title}
      </h3>
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            {isUs ? (
              <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-orange-400" />
              </div>
            ) : (
              <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground-muted/50" />
              </div>
            )}
            <span className={`leading-relaxed ${isUs ? "text-foreground" : "text-foreground-muted"}`}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LanguageCardProps {
  language: string;
  exams: string[];
  color: "red" | "blue" | "purple";
}

const colorClasses = {
  red: {
    gradient: "from-red-500/10 to-red-500/5",
    border: "border-red-500/20 hover:border-red-500/40",
    iconBg: "bg-red-500/20",
    badge: "bg-red-500/10 text-red-400",
  },
  blue: {
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    iconBg: "bg-blue-500/20",
    badge: "bg-blue-500/10 text-blue-400",
  },
  purple: {
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/20",
    badge: "bg-purple-500/10 text-purple-400",
  },
};

function LanguageCard({ language, exams, color }: LanguageCardProps) {
  const colors = colorClasses[color];
  return (
    <div
      className={`flex flex-col items-center gap-4 px-6 py-10 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all duration-300 hover:scale-[1.02]`}
    >
      <div className="text-center">
        <div className="font-semibold text-foreground text-lg mb-4">{language}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {exams.map((exam) => (
            <span key={exam} className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${colors.badge}`}>
              {exam}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

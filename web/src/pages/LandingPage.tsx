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

import { Button } from "@/components/ui/button";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const t = useT();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent" />
        {/* Decorative blur elements */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              {t("landing.hero.tagline")}
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.hero.title")}{" "}
              <span className="whitespace-nowrap">
                <span className="bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
                  {t("landing.hero.titleHighlight")}
                </span>
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground mb-8 max-w-2xl mx-auto">
              {t("landing.hero.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-accent/25">
                    <BookOpen className="w-5 h-5 mr-2" />
                    {t("landing.hero.startLearning")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-accent/25">
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
          </div>

          {/* Decorative text */}
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-[200px] font-bold text-accent/5 select-none hidden lg:block">
            三
          </div>
        </div>
      </section>

      {/* Supported Exams */}
      <section className="py-16 sm:py-24 bg-surface border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.exams.title")}
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              {t("landing.exams.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <LanguageCard
              flag="🇯🇵"
              language={t("landing.exams.japanese")}
              exams={["JLPT N5", "JLPT N4", "JLPT N3", "JLPT N2", "JLPT N1"]}
              color="red"
            />
            <LanguageCard
              flag="🇬🇧"
              language={t("landing.exams.english")}
              exams={["TOEFL", "SAT", "GRE"]}
              color="blue"
            />
            <LanguageCard
              flag="🇫🇷"
              language={t("landing.exams.french")}
              exams={["DELF A1-B2", "DALF C1-C2", "TCF"]}
              color="purple"
            />
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.comparison.title")}
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              {t("landing.comparison.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
          </div>
        </div>
      </section>

      {/* The Learning Loop */}
      <section className="py-16 sm:py-24 bg-surface border-y border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.loop.title")}
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              {t("landing.loop.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <LoopCard
              icon={BookOpen}
              step={1}
              title={t("landing.loop.input.title")}
              description={t("landing.loop.input.description")}
              color="blue"
            />
            <LoopCard
              icon={BookmarkCheck}
              step={2}
              title={t("landing.loop.capture.title")}
              description={t("landing.loop.capture.description")}
              color="green"
            />
            <LoopCard
              icon={Brain}
              step={3}
              title={t("landing.loop.review.title")}
              description={t("landing.loop.review.description")}
              color="purple"
            />
            <LoopCard
              icon={PenLine}
              step={4}
              title={t("landing.loop.output.title")}
              description={t("landing.loop.output.description")}
              color="orange"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("landing.features.title")}
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={Sparkles}
              title={t("landing.features.flashcards.title")}
              description={t("landing.features.flashcards.description")}
              color="purple"
            />
            <FeatureCard
              icon={PenLine}
              title={t("landing.features.writing.title")}
              description={t("landing.features.writing.description")}
              color="blue"
            />
            <FeatureCard
              icon={Target}
              title={t("landing.features.personalized.title")}
              description={t("landing.features.personalized.description")}
              color="orange"
            />
            <FeatureCard
              icon={GraduationCap}
              title={t("landing.features.exams.title")}
              description={t("landing.features.exams.description")}
              color="green"
            />
            <FeatureCard
              icon={Volume2}
              title={t("landing.features.audio.title")}
              description={t("landing.features.audio.description")}
              color="pink"
            />
            <FeatureCard
              icon={Languages}
              title={t("landing.features.tapDefine.title")}
              description={t("landing.features.tapDefine.description")}
              color="cyan"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent" />
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="container mx-auto px-4 sm:px-6 text-center relative">
          <h2
            className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("landing.cta.title")}
          </h2>
          <p className="text-foreground text-lg mb-8 max-w-xl mx-auto">
            {t("landing.cta.subtitle")}
          </p>
          {isAuthenticated ? (
            <Link to="/library">
              <Button size="lg" className="shadow-lg shadow-accent/25">
                <BookOpen className="w-5 h-5 mr-2" />
                {t("landing.cta.goToLibrary")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <SignInButton mode="modal">
              <Button size="lg" className="shadow-lg shadow-accent/25">
                <Sparkles className="w-5 h-5 mr-2" />
                {t("landing.cta.getStartedFree")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </SignInButton>
          )}
          <p className="text-sm text-foreground mt-4">{t("landing.cta.noCreditCard")}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
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
  color: "purple" | "blue" | "orange" | "green" | "pink" | "cyan";
}

const featureColorClasses = {
  purple: {
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/20",
    icon: "text-purple-400",
  },
  blue: {
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    iconBg: "bg-blue-500/20",
    icon: "text-blue-400",
  },
  orange: {
    gradient: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/20 hover:border-orange-500/40",
    iconBg: "bg-orange-500/20",
    icon: "text-orange-400",
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
      className={`p-6 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all hover:scale-[1.02]`}
    >
      <div
        className={`w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center mb-4`}
      >
        <Icon className={`w-6 h-6 ${colors.icon}`} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm">{description}</p>
    </div>
  );
}

interface LoopCardProps {
  icon: React.ComponentType<{ className?: string }>;
  step: number;
  title: string;
  description: string;
  color: "blue" | "green" | "purple" | "orange";
}

const loopColorClasses = {
  blue: {
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20",
    iconBg: "bg-blue-500/20",
    icon: "text-blue-400",
    badge: "bg-blue-500",
  },
  green: {
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/20",
    icon: "text-emerald-400",
    badge: "bg-emerald-500",
  },
  purple: {
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20",
    iconBg: "bg-purple-500/20",
    icon: "text-purple-400",
    badge: "bg-purple-500",
  },
  orange: {
    gradient: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/20",
    iconBg: "bg-orange-500/20",
    icon: "text-orange-400",
    badge: "bg-orange-500",
  },
};

function LoopCard({ icon: Icon, step, title, description, color }: LoopCardProps) {
  const colors = loopColorClasses[color];
  return (
    <div
      className={`text-center p-6 rounded-2xl bg-gradient-to-br ${colors.gradient} border ${colors.border}`}
    >
      <div className="relative inline-block mb-4">
        <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <div
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${colors.badge} text-white text-xs font-bold flex items-center justify-center shadow-lg`}
        >
          {step}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm">{description}</p>
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
      className={`p-6 rounded-2xl border-2 ${isUs ? "border-accent/30 bg-gradient-to-br from-accent/10 to-purple-500/5" : "border-border bg-surface"}`}
    >
      <h3
        className={`text-lg font-semibold mb-4 ${isUs ? "text-accent" : "text-foreground-muted"}`}
      >
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            {isUs ? (
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-accent" />
              </div>
            ) : (
              <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground-muted/50" />
              </div>
            )}
            <span className={isUs ? "text-foreground" : "text-foreground-muted"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LanguageCardProps {
  flag: string;
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

function LanguageCard({ flag, language, exams, color }: LanguageCardProps) {
  const colors = colorClasses[color];
  return (
    <div
      className={`flex flex-col items-center gap-4 px-6 py-8 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all hover:scale-[1.02]`}
    >
      <div
        className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center text-4xl`}
      >
        {flag}
      </div>
      <div className="text-center">
        <div className="font-bold text-foreground text-lg mb-3">{language}</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {exams.map((exam) => (
            <span key={exam} className={`text-xs font-medium px-2 py-1 rounded-md ${colors.badge}`}>
              {exam}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

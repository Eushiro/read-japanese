import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Volume2,
  BookmarkCheck,
  Sparkles,
  Languages,
  GraduationCap,
  ArrowRight,
  Check,
  PenLine,
  Brain,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

export function LandingPage() {
  const { isAuthenticated } = useAuth();

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
              AI-Powered Exam Prep
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Personalized Learning{" "}
              <span className="whitespace-nowrap">
                for <span className="bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">Your Exam</span>
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground mb-8 max-w-2xl mx-auto">
              AI generates content from your vocabulary, verifies your writing,
              and creates mock tests tailored to your target exam. Not generic
              study materials—a learning path built for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-accent/25">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Start Learning
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-accent/25">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </SignInButton>
              )}
              <Link to="/library">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Browse Library
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
              Prep for the exams that matter
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              Content and tests aligned with official exam formats and vocabulary lists.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <LanguageCard flag="🇯🇵" language="Japanese" exams={["JLPT N5", "JLPT N4", "JLPT N3", "JLPT N2", "JLPT N1"]} color="red" />
            <LanguageCard flag="🇬🇧" language="English" exams={["TOEFL", "SAT", "GRE"]} color="blue" />
            <LanguageCard flag="🇫🇷" language="French" exams={["DELF A1-B2", "DALF C1-C2", "TCF"]} color="purple" />
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
              Not another flashcard app
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              Most apps test what you recognize. We test what you can produce.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <ComparisonCard
              title="SanLang"
              isUs={true}
              items={[
                "Write sentences, get AI feedback",
                "Content generated from YOUR vocabulary",
                "Mock tests in real exam formats",
                "Multi-modal: text, audio, images",
              ]}
            />
            <ComparisonCard
              title="Other Apps"
              isUs={false}
              items={[
                "Flip cards, tap correct answer",
                "Generic word lists for everyone",
                "Gamified but not exam-focused",
                "Usually single-modal",
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
              The complete learning loop
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              Input, practice, output, repeat. Every feature connects to help you actually learn.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <LoopCard
              icon={BookOpen}
              step={1}
              title="Input"
              description="Read stories, listen to audio, watch videos—all at your level"
              color="blue"
            />
            <LoopCard
              icon={BookmarkCheck}
              step={2}
              title="Capture"
              description="Save words automatically or manually. Build your personal vocabulary."
              color="green"
            />
            <LoopCard
              icon={Brain}
              step={3}
              title="Review"
              description="AI-generated flashcards with example sentences, refreshed to stay relevant"
              color="purple"
            />
            <LoopCard
              icon={PenLine}
              step={4}
              title="Output"
              description="Write sentences, get instant AI feedback on grammar and usage"
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
              Everything you need to pass your exam
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto">
              From vocabulary building to mock tests, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Flashcards"
              description="Cards auto-generated with example sentences at your level. Sentences refresh periodically so you don't just memorize patterns."
              color="purple"
            />
            <FeatureCard
              icon={PenLine}
              title="Writing Practice"
              description="Create sentences using target words. AI checks grammar, word usage, and naturalness—then shows you how to improve."
              color="blue"
            />
            <FeatureCard
              icon={Target}
              title="Personalized Content"
              description="Stories and tests generated from YOUR vocabulary. Practice exactly what you need to learn."
              color="orange"
            />
            <FeatureCard
              icon={GraduationCap}
              title="Real Exam Formats"
              description="Mock tests that match JLPT, TOEFL, DELF, and other official exam structures and scoring."
              color="green"
            />
            <FeatureCard
              icon={Volume2}
              title="Native Audio"
              description="Listen to stories and flashcards with natural pronunciation. Train your ears while you learn."
              color="pink"
            />
            <FeatureCard
              icon={Languages}
              title="Tap-to-Define"
              description="Tap any word for instant definitions. Reading aids like furigana help you stay in flow."
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
            Start learning smarter
          </h2>
          <p className="text-foreground text-lg mb-8 max-w-xl mx-auto">
            Join learners who are preparing for their exams with AI-powered,
            personalized study materials.
          </p>
          {isAuthenticated ? (
            <Link to="/library">
              <Button size="lg" className="shadow-lg shadow-accent/25">
                <BookOpen className="w-5 h-5 mr-2" />
                Go to Library
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <SignInButton mode="modal">
              <Button size="lg" className="shadow-lg shadow-accent/25">
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </SignInButton>
          )}
          <p className="text-sm text-foreground mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 text-center text-foreground-muted text-sm">
          <p>SanLang - Personalized exam prep powered by AI</p>
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
    <div className={`p-6 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all hover:scale-[1.02]`}>
      <div className={`w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center mb-4`}>
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
    <div className={`text-center p-6 rounded-2xl bg-gradient-to-br ${colors.gradient} border ${colors.border}`}>
      <div className="relative inline-block mb-4">
        <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center`}>
          <Icon className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${colors.badge} text-white text-xs font-bold flex items-center justify-center shadow-lg`}>
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
    <div className={`p-6 rounded-2xl border-2 ${isUs ? "border-accent/30 bg-gradient-to-br from-accent/10 to-purple-500/5" : "border-border bg-surface"}`}>
      <h3 className={`text-lg font-semibold mb-4 ${isUs ? "text-accent" : "text-foreground-muted"}`}>
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
            <span className={isUs ? "text-foreground" : "text-foreground-muted"}>
              {item}
            </span>
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
    <div className={`flex flex-col items-center gap-4 px-6 py-8 rounded-xl bg-gradient-to-br ${colors.gradient} border ${colors.border} transition-all hover:scale-[1.02]`}>
      <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center text-4xl`}>
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

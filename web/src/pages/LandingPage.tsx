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
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Exam Prep
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Personalized Learning{" "}
              <span className="whitespace-nowrap">
                for <span className="text-accent">Your Exam</span>
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground-muted mb-8 max-w-2xl mx-auto">
              AI generates content from your vocabulary, verifies your writing,
              and creates mock tests tailored to your target exam. Not generic
              study materials—a learning path built for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link to="/library">
                  <Button size="lg" className="w-full sm:w-auto">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Start Learning
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <Button size="lg" className="w-full sm:w-auto">
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
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
              Content and tests aligned with official exam formats and vocabulary lists.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <LanguageCard flag="🇯🇵" language="Japanese" exams={["JLPT N5", "JLPT N4", "JLPT N3", "JLPT N2", "JLPT N1"]} />
            <LanguageCard flag="🇬🇧" language="English" exams={["TOEFL", "SAT", "GRE"]} />
            <LanguageCard flag="🇫🇷" language="French" exams={["DELF A1-B2", "DALF C1-C2", "TCF"]} />
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
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
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
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
              Input, practice, output, repeat. Every feature connects to help you actually learn.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <LoopCard
              icon={BookOpen}
              step={1}
              title="Input"
              description="Read stories, listen to audio, watch videos—all at your level"
            />
            <LoopCard
              icon={BookmarkCheck}
              step={2}
              title="Capture"
              description="Save words automatically or manually. Build your personal vocabulary."
            />
            <LoopCard
              icon={Brain}
              step={3}
              title="Review"
              description="AI-generated flashcards with example sentences, refreshed to stay relevant"
            />
            <LoopCard
              icon={PenLine}
              step={4}
              title="Output"
              description="Write sentences, get instant AI feedback on grammar and usage"
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
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
              From vocabulary building to mock tests, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Flashcards"
              description="Cards auto-generated with example sentences at your level. Sentences refresh periodically so you don't just memorize patterns."
            />
            <FeatureCard
              icon={PenLine}
              title="Writing Practice"
              description="Create sentences using target words. AI checks grammar, word usage, and naturalness—then shows you how to improve."
            />
            <FeatureCard
              icon={Target}
              title="Personalized Content"
              description="Stories and tests generated from YOUR vocabulary. Practice exactly what you need to learn."
            />
            <FeatureCard
              icon={GraduationCap}
              title="Real Exam Formats"
              description="Mock tests that match JLPT, TOEFL, DELF, and other official exam structures and scoring."
            />
            <FeatureCard
              icon={Volume2}
              title="Native Audio"
              description="Listen to stories and flashcards with natural pronunciation. Train your ears while you learn."
            />
            <FeatureCard
              icon={Languages}
              title="Tap-to-Define"
              description="Tap any word for instant definitions. Reading aids like furigana help you stay in flow."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-accent/5 to-transparent border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Start learning smarter
          </h2>
          <p className="text-foreground-muted text-lg mb-8 max-w-xl mx-auto">
            Join learners who are preparing for their exams with AI-powered,
            personalized study materials.
          </p>
          {isAuthenticated ? (
            <Link to="/library">
              <Button size="lg">
                <BookOpen className="w-5 h-5 mr-2" />
                Go to Library
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <SignInButton mode="modal">
              <Button size="lg">
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </SignInButton>
          )}
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
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-accent" />
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
}

function LoopCard({ icon: Icon, step, title, description }: LoopCardProps) {
  return (
    <div className="text-center p-6">
      <div className="relative inline-block mb-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-accent" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
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
    <div className={`p-6 rounded-xl border ${isUs ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
      <h3 className={`text-lg font-semibold mb-4 ${isUs ? "text-accent" : "text-foreground-muted"}`}>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            {isUs ? (
              <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            ) : (
              <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground-muted" />
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
}

function LanguageCard({ flag, language, exams }: LanguageCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8 rounded-xl bg-background border border-border hover:border-accent/30 transition-colors">
      <div className="text-5xl">{flag}</div>
      <div className="text-center">
        <div className="font-bold text-foreground text-lg mb-2">{language}</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {exams.map((exam) => (
            <span key={exam} className="text-xs font-medium px-2 py-1 rounded-md bg-accent/10 text-accent">
              {exam}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Learn Japanese naturally
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Master Japanese Through{" "}
              <span className="text-accent">Graded Stories</span>
            </h1>
            <p className="text-lg sm:text-xl text-foreground-muted mb-8 max-w-2xl mx-auto">
              Immerse yourself in Japanese reading with stories tailored to your
              JLPT level. Tap any word for instant definitions, listen with
              native audio, and build vocabulary naturally.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/library">
                <Button size="lg" className="w-full sm:w-auto">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Start Reading
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/generate">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate a Story
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative Japanese text */}
          <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-[200px] font-bold text-accent/5 select-none hidden lg:block">
            読
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Everything you need to read Japanese
            </h2>
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
              Our graded reader is designed specifically for Japanese learners,
              with features that make reading accessible at any level.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={GraduationCap}
              title="JLPT-Graded Content"
              description="Stories carefully crafted for N5 through N1 levels, using vocabulary and grammar appropriate for your stage."
            />
            <FeatureCard
              icon={Languages}
              title="Tap-to-Define"
              description="Tap any word to instantly see its meaning, reading, and part of speech. No more switching to a dictionary."
            />
            <FeatureCard
              icon={BookOpen}
              title="Furigana Support"
              description="Reading annotations appear above kanji, helping you read fluently while learning new characters."
            />
            <FeatureCard
              icon={Volume2}
              title="Native Audio"
              description="Listen to stories read by native speakers with synchronized highlighting to follow along."
            />
            <FeatureCard
              icon={BookmarkCheck}
              title="Vocabulary Tracking"
              description="Save words you want to remember. Review them anytime and watch your vocabulary grow."
            />
            <FeatureCard
              icon={Sparkles}
              title="AI-Generated Stories"
              description="Create custom stories tailored to your interests and level using our AI story generator."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-24 bg-surface border-y border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              How it works
            </h2>
            <p className="text-foreground-muted text-lg">
              Start reading Japanese in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number={1}
              title="Choose Your Level"
              description="Select a story that matches your JLPT level, from beginner (N5) to advanced (N1)."
            />
            <StepCard
              number={2}
              title="Read & Listen"
              description="Read at your own pace, tap words for definitions, and listen to native audio narration."
            />
            <StepCard
              number={3}
              title="Build Vocabulary"
              description="Save new words to your vocabulary list and review them to reinforce your learning."
            />
          </div>
        </div>
      </section>

      {/* Levels Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Content for every level
            </h2>
            <p className="text-foreground-muted text-lg max-w-2xl mx-auto">
              From your first steps in Japanese to advanced reading, we have
              stories for you.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            <LevelBadge level="N5" label="Beginner" color="bg-green-500" />
            <LevelBadge level="N4" label="Elementary" color="bg-teal-500" />
            <LevelBadge level="N3" label="Intermediate" color="bg-blue-500" />
            <LevelBadge level="N2" label="Upper-Int" color="bg-purple-500" />
            <LevelBadge level="N1" label="Advanced" color="bg-red-500" />
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
            Ready to start reading?
          </h2>
          <p className="text-foreground-muted text-lg mb-8 max-w-xl mx-auto">
            Jump into our library of graded Japanese stories and start your
            reading journey today.
          </p>
          <Link to="/library">
            <Button size="lg">
              <BookOpen className="w-5 h-5 mr-2" />
              Browse Stories
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 text-center text-foreground-muted text-sm">
          <p>Read Japanese - Learn through stories</p>
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

interface StepCardProps {
  number: number;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-accent text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm">{description}</p>
    </div>
  );
}

interface LevelBadgeProps {
  level: string;
  label: string;
  color: string;
}

function LevelBadge({ level, label, color }: LevelBadgeProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-surface border border-border">
      <div
        className={`w-10 h-10 rounded-lg ${color} text-white font-bold flex items-center justify-center`}
      >
        {level}
      </div>
      <div className="text-left">
        <div className="font-semibold text-foreground">{level}</div>
        <div className="text-xs text-foreground-muted">{label}</div>
      </div>
    </div>
  );
}

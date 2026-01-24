import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { X, Crown, Zap, Sparkles, Check, BookOpen, Brain, Mic, PenLine } from "lucide-react";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: "flashcards" | "sentences" | "comprehension" | "stories" | "general";
}

export function Paywall({
  isOpen,
  onClose,
  title = "Upgrade Your Plan",
  description = "Unlock AI-powered features to accelerate your learning.",
  feature = "general",
}: PaywallProps) {
  const { user, isAuthenticated } = useAuth();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: "basic" | "pro" | "unlimited") => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(tier);
    try {
      const result = await createCheckout({
        userId: user.id,
        tier,
        successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
        cancelUrl: window.location.href,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (!isOpen) return null;

  // Feature-specific messaging
  const featureMessages = {
    flashcards: {
      title: "Upgrade for AI Sentences",
      description: "Generate new example sentences for your flashcards with AI.",
    },
    sentences: {
      title: "Upgrade for AI Feedback",
      description: "Get detailed feedback on your writing with grammar corrections and suggestions.",
    },
    comprehension: {
      title: "Upgrade for AI Comprehension",
      description: "Generate comprehension questions and get AI-powered grading on your answers.",
    },
    stories: {
      title: "Upgrade for Premium Content",
      description: "Access premium stories and reading materials to improve your comprehension.",
    },
    general: {
      title,
      description,
    },
  };

  const content = featureMessages[feature];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface rounded-2xl border border-border shadow-lg max-w-6xl w-full p-6 sm:p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-foreground-muted" />
        </button>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {content.title}
          </h3>
          <p className="text-foreground-muted">
            {content.description}
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-3 max-w-sm mx-auto">
            <p className="text-sm text-foreground-muted text-center">
              Sign in to view pricing and upgrade.
            </p>
            <SignInButton mode="modal">
              <Button className="w-full" size="lg">
                Sign In to Continue
              </Button>
            </SignInButton>
          </div>
        ) : (
          <>
            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <Brain className="w-4 h-4 text-accent" />
                <span>SRS Flashcards</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <PenLine className="w-4 h-4 text-accent" />
                <span>Writing Feedback</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <BookOpen className="w-4 h-4 text-accent" />
                <span>Comprehension</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <Mic className="w-4 h-4 text-accent" />
                <span>Audio Support</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Free Tier */}
              <div className="p-5 rounded-xl border border-border bg-muted/30 flex flex-col">
                <div className="text-center mb-4">
                  <span className="text-sm font-medium text-foreground-muted uppercase tracking-wider">Free</span>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">$0</span>
                    <span className="text-foreground-muted">/mo</span>
                  </div>
                </div>
                <ul className="text-sm space-y-2.5 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground">Premade vocabulary decks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground">Basic flashcard reviews</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground">5 reading sessions/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-foreground-muted mt-0.5 shrink-0" />
                    <span className="text-foreground-muted">No AI feedback</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-foreground-muted mt-0.5 shrink-0" />
                    <span className="text-foreground-muted">No AI sentence generation</span>
                  </li>
                </ul>
                <div className="text-center text-sm text-foreground-muted mt-5">
                  Current plan
                </div>
              </div>

              {/* Basic Tier */}
              <div className="p-5 rounded-xl border border-border flex flex-col">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-foreground uppercase tracking-wider">Basic</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">$5</span>
                    <span className="text-foreground-muted">/mo</span>
                  </div>
                </div>
                <ul className="text-sm space-y-2.5 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">Everything in Free</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>200</strong> AI feedback/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>100</strong> audio generations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">20 reading sessions/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">AI comprehension quizzes</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  className={`w-full mt-5 ${checkoutLoading === "basic" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("basic")}
                >
                  Get Basic
                </Button>
              </div>

              {/* Pro Tier - Recommended */}
              <div className="p-5 pt-8 rounded-xl border-2 border-accent bg-accent/5 relative flex flex-col">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs px-3 py-1 rounded-full bg-accent text-white font-medium">
                    Most Popular
                  </span>
                </div>
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Crown className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-accent uppercase tracking-wider">Pro</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">$15</span>
                    <span className="text-foreground-muted">/mo</span>
                  </div>
                </div>
                <ul className="text-sm space-y-2.5 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground">Everything in Basic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>1,000</strong> AI feedback/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>500</strong> audio generations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>Unlimited</strong> reading</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>Unlimited</strong> flashcards</span>
                  </li>
                </ul>
                <Button
                  className={`w-full mt-5 ${checkoutLoading === "pro" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("pro")}
                >
                  Get Pro
                </Button>
              </div>

              {/* Unlimited Tier */}
              <div className="p-5 rounded-xl border border-border bg-gradient-to-b from-purple-500/5 to-transparent flex flex-col">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-foreground uppercase tracking-wider">Unlimited</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">$45</span>
                    <span className="text-foreground-muted">/mo</span>
                  </div>
                </div>
                <ul className="text-sm space-y-2.5 flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">Everything in Pro</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>Unlimited</strong> AI feedback</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-foreground"><strong>Unlimited</strong> audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">Early access to new features</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  className={`w-full mt-5 border-purple-500/30 hover:bg-purple-500/10 ${checkoutLoading === "unlimited" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("unlimited")}
                >
                  Get Unlimited
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

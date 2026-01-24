import { useAction } from "convex/react";
import { BookOpen, Brain, Check, Crown, Mic,PenLine, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SignInButton,useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

export function PricingPage() {
  const t = useT();
  const { user, isAuthenticated } = useAuth();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: "basic" | "pro" | "power") => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(tier);
    try {
      const result = await createCheckout({
        userId: user.id,
        tier,
        successUrl: `${window.location.origin}/settings?success=true`,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-background to-accent/5" />
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 max-w-6xl relative">
          <div className="text-center animate-fade-in-up">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-accent/20">
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
                {t('pricing.hero.badge')}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t('pricing.hero.title')}
            </h1>
            <p className="text-lg text-foreground max-w-2xl mx-auto">
              {t('pricing.hero.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-6xl">
        {/* Feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t('pricing.features.srsFlashcards')}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t('pricing.features.writingFeedback')}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t('pricing.features.comprehension')}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t('pricing.features.audioSupport')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Tier */}
          <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col">
            <div className="text-center mb-6">
              <span className="text-sm font-medium text-foreground-muted uppercase tracking-wider">
                Free
              </span>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-foreground-muted">/mo</span>
              </div>
              <p className="text-sm text-foreground-muted mt-2">Get started with the basics</p>
            </div>
            <ul className="text-sm space-y-3 flex-1">
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
            <div className="mt-6">
              {isAuthenticated ? (
                <div className="text-center text-sm text-foreground-muted py-2">Current plan</div>
              ) : (
                <SignInButton mode="modal">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>

          {/* Basic Tier */}
          <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-foreground uppercase tracking-wider">
                  Basic
                </span>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$5</span>
                <span className="text-foreground-muted">/mo</span>
              </div>
              <p className="text-sm text-foreground-muted mt-2">For regular learners</p>
            </div>
            <ul className="text-sm space-y-3 flex-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <span className="text-foreground">Everything in Free</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>200</strong> AI feedback/month
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>100</strong> audio generations
                </span>
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
            <div className="mt-6">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  className={`w-full ${checkoutLoading === "basic" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("basic")}
                >
                  Get Basic
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button variant="outline" className="w-full">
                    Get Basic
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>

          {/* Pro Tier - Recommended */}
          <div className="p-6 pt-10 rounded-2xl border-2 border-accent bg-accent/5 relative flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-xs px-3 py-1 rounded-full bg-accent text-white font-medium">
                Most Popular
              </span>
            </div>
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2">
                <Crown className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent uppercase tracking-wider">
                  Pro
                </span>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$15</span>
                <span className="text-foreground-muted">/mo</span>
              </div>
              <p className="text-sm text-foreground-muted mt-2">For serious learners</p>
            </div>
            <ul className="text-sm space-y-3 flex-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">Everything in Basic</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>1,000</strong> AI feedback/month
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>500</strong> audio generations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>100</strong> reading sessions
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>3,000</strong> flashcards/month
                </span>
              </li>
            </ul>
            <div className="mt-6">
              {isAuthenticated ? (
                <Button
                  className={`w-full ${checkoutLoading === "pro" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("pro")}
                >
                  Get Pro
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button className="w-full">Get Pro</Button>
                </SignInButton>
              )}
            </div>
          </div>

          {/* Power Tier */}
          <div className="p-6 rounded-2xl border border-border bg-gradient-to-b from-purple-500/5 to-transparent flex flex-col">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-foreground uppercase tracking-wider">
                  Power
                </span>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$45</span>
                <span className="text-foreground-muted">/mo</span>
              </div>
              <p className="text-sm text-foreground-muted mt-2">5x Pro for power users</p>
            </div>
            <ul className="text-sm space-y-3 flex-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <span className="text-foreground">Everything in Pro</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>5,000</strong> AI feedback/month
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>2,500</strong> audio generations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  <strong>15,000</strong> flashcards/month
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <span className="text-foreground">Priority support</span>
              </li>
            </ul>
            <div className="mt-6">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  className={`w-full border-purple-500/30 hover:bg-purple-500/10 ${checkoutLoading === "power" ? "btn-loading-gradient" : ""}`}
                  onClick={() => handleUpgrade("power")}
                >
                  Get Power
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button
                    variant="outline"
                    className="w-full border-purple-500/30 hover:bg-purple-500/10"
                  >
                    Get Power
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2
            className="text-2xl font-bold text-foreground text-center mb-8"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t('pricing.faq.title')}
          </h2>
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">What is AI feedback?</h3>
              <p className="text-sm text-foreground-muted">
                AI feedback includes writing corrections, comprehension quiz grading, and sentence
                generation for flashcards. Each time you get feedback on your writing or generate
                new example sentences, it uses one AI credit.
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                Are the premade vocabulary decks free?
              </h3>
              <p className="text-sm text-foreground-muted">
                Yes! All premade vocabulary decks (JLPT N5-N1, etc.) are free to use with basic
                flashcard reviews. Premium features like AI sentence generation and writing feedback
                require a paid plan.
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">Can I change plans anytime?</h3>
              <p className="text-sm text-foreground-muted">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect
                immediately, and we'll prorate any differences.
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-sm text-foreground-muted">
                We accept all major credit cards, debit cards, and Apple Pay through our secure
                payment processor, Stripe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

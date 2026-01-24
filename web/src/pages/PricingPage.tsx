import { useAction, useQuery } from "convex/react";
import { BookOpen, Brain, Check, Crown, Mic, PenLine, Sparkles, Zap } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Credit costs for the reference table
const CREDIT_COSTS = [
  { action: "AI flashcard sentence", credits: 1, upTo500: "500" },
  { action: "Writing feedback", credits: 1, upTo500: "500" },
  { action: "Quiz grading", credits: 1, upTo500: "500" },
  { action: "Audio generation", credits: 2, upTo500: "250" },
  { action: "Shadowing session", credits: 3, upTo500: "166" },
];

export function PricingPage() {
  const t = useT();
  const { user, isAuthenticated } = useAuth();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  // Get current subscription
  const subscription = useQuery(
    api.subscriptions.get,
    isAuthenticated && user ? { userId: user.id } : "skip"
  );
  const currentTier = subscription?.tier ?? "free";

  const handleUpgrade = async (tier: "starter" | "pro") => {
    if (!user || checkoutLoading) return;
    setCheckoutLoading(tier);
    try {
      const result = await createCheckout({
        userId: user.id,
        tier,
        billingPeriod,
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

  // Pricing data
  const tiers = [
    {
      id: "free",
      name: "Free",
      icon: Zap,
      iconColor: "text-slate-400",
      price: { monthly: 0, annual: 0 },
      credits: 50,
      description: t("pricing.tiers.free.description", "Get started with the basics"),
      features: [
        t("pricing.tiers.free.features.0", "50 AI credits/month"),
        t("pricing.tiers.free.features.1", "Premade vocabulary decks"),
        t("pricing.tiers.free.features.2", "Basic flashcard reviews"),
        t("pricing.tiers.free.features.3", "Graded reading library"),
      ],
      borderClass: "border-border",
      bgClass: "bg-surface",
    },
    {
      id: "starter",
      name: "Starter",
      icon: Sparkles,
      iconColor: "text-blue-500",
      price: { monthly: 7.99, annual: 79.99 },
      credits: 500,
      popular: true,
      description: t("pricing.tiers.starter.description", "For regular learners"),
      features: [
        t("pricing.tiers.starter.features.0", "500 AI credits/month"),
        t("pricing.tiers.starter.features.1", "Everything in Free"),
        t("pricing.tiers.starter.features.2", "AI writing feedback"),
        t("pricing.tiers.starter.features.3", "Audio generation"),
        t("pricing.tiers.starter.features.4", "Progress tracking"),
      ],
      borderClass: "border-blue-500/50",
      bgClass: "bg-blue-500/5",
    },
    {
      id: "pro",
      name: "Pro",
      icon: Crown,
      iconColor: "text-accent",
      price: { monthly: 17.99, annual: 179.99 },
      credits: 2000,
      description: t("pricing.tiers.pro.description", "For serious learners"),
      features: [
        t("pricing.tiers.pro.features.0", "2,000 AI credits/month"),
        t("pricing.tiers.pro.features.1", "Everything in Starter"),
        t("pricing.tiers.pro.features.2", "Shadowing practice"),
        t("pricing.tiers.pro.features.3", "Priority support"),
        t("pricing.tiers.pro.features.4", "Early access to features"),
      ],
      borderClass: "border-accent/50",
      bgClass: "bg-accent/5",
    },
  ];

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
                {t("pricing.hero.badge", "Simple Pricing")}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("pricing.hero.title", "Unlock AI-Powered Learning")}
            </h1>
            <p className="text-lg text-foreground max-w-2xl mx-auto">
              {t(
                "pricing.hero.subtitle",
                "One simple credit system for all AI features. Mix and match however you learn best."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-6xl">
        {/* Feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">
              {t("pricing.features.srsFlashcards", "AI Flashcards")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">
              {t("pricing.features.writingFeedback", "Writing Feedback")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">
              {t("pricing.features.comprehension", "Quiz Grading")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">
              {t("pricing.features.audioSupport", "Audio & Shadowing")}
            </span>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <Tabs
            value={billingPeriod}
            onValueChange={(v) => setBillingPeriod(v as "monthly" | "annual")}
          >
            <TabsList className="bg-muted/50">
              <TabsTrigger value="monthly">{t("pricing.monthly", "Monthly")}</TabsTrigger>
              <TabsTrigger value="annual" className="flex items-center gap-2">
                {t("pricing.annual", "Annual")}
                <Badge variant="secondary" className="bg-green-500/20 text-green-600 text-xs">
                  {t("pricing.save17", "Save 17%")}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const isCurrentPlan = currentTier === tier.id;
            const Icon = tier.icon;
            const price = tier.price[billingPeriod];
            const isPaidTier = tier.id !== "free";

            return (
              <div
                key={tier.id}
                className={`p-6 rounded-2xl border ${tier.borderClass} ${tier.bgClass} flex flex-col relative ${
                  tier.popular ? "ring-2 ring-blue-500/50" : ""
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">
                      {t("pricing.mostPopular", "Most Popular")}
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className={`w-5 h-5 ${tier.iconColor}`} />
                    <span className="text-lg font-semibold text-foreground">{tier.name}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-foreground">
                      ${price === 0 ? "0" : price.toFixed(2)}
                    </span>
                    <span className="text-foreground-muted">
                      /
                      {billingPeriod === "annual"
                        ? t("pricing.year", "year")
                        : t("pricing.month", "mo")}
                    </span>
                  </div>
                  {billingPeriod === "annual" && isPaidTier && (
                    <p className="text-sm text-green-600 mt-1">
                      {t("pricing.billedAnnually", "Billed annually")}
                    </p>
                  )}
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      {tier.credits.toLocaleString()}{" "}
                      {t("pricing.creditsPerMonth", "credits/month")}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground-muted mt-2">{tier.description}</p>
                </div>

                <ul className="text-sm space-y-3 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check
                        className={`w-4 h-4 mt-0.5 shrink-0 ${tier.id === "pro" ? "text-accent" : tier.id === "starter" ? "text-blue-500" : "text-success"}`}
                      />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrentPlan ? (
                    <div className="text-center text-sm text-foreground-muted py-2 border border-border rounded-lg">
                      {t("pricing.currentPlan", "Current plan")}
                    </div>
                  ) : tier.id === "free" ? (
                    !isAuthenticated ? (
                      <SignInButton mode="modal">
                        <Button variant="outline" className="w-full">
                          {t("pricing.getStarted", "Get Started")}
                        </Button>
                      </SignInButton>
                    ) : null
                  ) : isAuthenticated ? (
                    <Button
                      variant={tier.id === "pro" ? "default" : "outline"}
                      className={`w-full ${checkoutLoading === tier.id ? "btn-loading-gradient" : ""}`}
                      onClick={() => handleUpgrade(tier.id as "starter" | "pro")}
                      disabled={!!checkoutLoading}
                    >
                      {t("pricing.upgrade", "Upgrade to {{tier}}", { tier: tier.name })}
                    </Button>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        variant={tier.id === "pro" ? "default" : "outline"}
                        className="w-full"
                      >
                        {t("pricing.upgrade", "Upgrade to {{tier}}", { tier: tier.name })}
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Credit Costs Reference */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2
            className="text-xl font-bold text-foreground text-center mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("pricing.creditCosts.title", "How Credits Work")}
          </h2>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pricing.creditCosts.action", "Feature")}</TableHead>
                  <TableHead className="text-center">
                    {t("pricing.creditCosts.credits", "Credits")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("pricing.creditCosts.starterUpTo", "Starter (up to)")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CREDIT_COSTS.map((row) => (
                  <TableRow key={row.action}>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{row.credits}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-foreground-muted">
                      {row.upTo500}/month
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-center text-sm text-foreground-muted mt-4">
            {t(
              "pricing.creditCosts.footer",
              "Credits reset monthly. Mix and match however you learn best."
            )}
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2
            className="text-2xl font-bold text-foreground text-center mb-8"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("pricing.faq.title", "Frequently Asked Questions")}
          </h2>
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.whatAreCredits.q", "What are AI credits?")}
              </h3>
              <p className="text-sm text-foreground-muted">
                {t(
                  "pricing.faq.whatAreCredits.a",
                  "AI credits are a unified currency for all AI-powered features. Each action costs a set number of credits - for example, generating a flashcard sentence costs 1 credit, while audio generation costs 2 credits. This gives you flexibility to use features however suits your learning style."
                )}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.premadeDecks.q", "Are the premade vocabulary decks free?")}
              </h3>
              <p className="text-sm text-foreground-muted">
                {t(
                  "pricing.faq.premadeDecks.a",
                  "Yes! All premade vocabulary decks (JLPT N5-N1, CEFR levels) are free to access and study. Premium features like AI sentence generation and audio require credits."
                )}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.changePlans.q", "Can I change plans anytime?")}
              </h3>
              <p className="text-sm text-foreground-muted">
                {t(
                  "pricing.faq.changePlans.a",
                  "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences."
                )}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.rollOver.q", "Do unused credits roll over?")}
              </h3>
              <p className="text-sm text-foreground-muted">
                {t(
                  "pricing.faq.rollOver.a",
                  "Credits reset at the start of each billing period. We recommend using your credits throughout the month for consistent learning progress."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
import { formatPrice, getTier, type PaidTierId } from "@/lib/tiers";

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

  const handleUpgrade = async (tier: PaidTierId) => {
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

  // Pricing data - uses centralized config from shared/tiers.json
  const freeTier = getTier("free");
  const plusTier = getTier("plus");
  const proTier = getTier("pro");

  const tiers = [
    {
      id: "free",
      name: t("settings.subscription.tiers.free.name"),
      icon: Zap,
      iconColor: "text-slate-400",
      price: freeTier?.price ?? { monthly: 0, annual: 0 },
      credits: freeTier?.credits ?? 50,
      description: t("pricing.tiers.free.description"),
      features: [
        t("pricing.tiers.free.features.0"),
        t("pricing.tiers.free.features.1"),
        t("pricing.tiers.free.features.2"),
        t("pricing.tiers.free.features.3"),
      ],
      borderClass: "border-border",
      bgClass: "bg-surface",
    },
    {
      id: "plus",
      name: t("settings.subscription.tiers.plus.name"),
      icon: Sparkles,
      iconColor: "text-blue-500",
      price: plusTier?.price ?? { monthly: 7.99, annual: 79.99 },
      credits: plusTier?.credits ?? 500,
      popular: true,
      description: t("pricing.tiers.plus.description"),
      features: [
        t("pricing.tiers.plus.features.0"),
        t("pricing.tiers.plus.features.1"),
        t("pricing.tiers.plus.features.2"),
        t("pricing.tiers.plus.features.3"),
        t("pricing.tiers.plus.features.4"),
      ],
      borderClass: "border-blue-500/50",
      bgClass: "bg-blue-500/5",
    },
    {
      id: "pro",
      name: t("settings.subscription.tiers.pro.name"),
      icon: Crown,
      iconColor: "text-accent",
      price: proTier?.price ?? { monthly: 17.99, annual: 179.99 },
      credits: proTier?.credits ?? 2000,
      description: t("pricing.tiers.pro.description"),
      features: [
        t("pricing.tiers.pro.features.0"),
        t("pricing.tiers.pro.features.1"),
        t("pricing.tiers.pro.features.2"),
        t("pricing.tiers.pro.features.3"),
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
                {t("pricing.hero.badge")}
              </span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("pricing.hero.title")}
            </h1>
            <p className="text-lg text-foreground max-w-2xl mx-auto">
              {t("pricing.hero.subtitle")}
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
            <span className="text-sm text-foreground">{t("pricing.features.srsFlashcards")}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t("pricing.features.writingFeedback")}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t("pricing.features.comprehension")}</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Mic className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-foreground">{t("pricing.features.audioSupport")}</span>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <Tabs
            value={billingPeriod}
            onValueChange={(v) => setBillingPeriod(v as "monthly" | "annual")}
          >
            <TabsList className="bg-muted/50">
              <TabsTrigger value="monthly">{t("pricing.monthly")}</TabsTrigger>
              <TabsTrigger value="annual" className="flex items-center gap-2">
                {t("pricing.annual")}
                <Badge variant="secondary" className="bg-green-500/20 text-green-600 text-xs">
                  {t("pricing.save17")}
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
                    <Badge className="bg-blue-500 text-white">{t("pricing.mostPopular")}</Badge>
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
                      /{billingPeriod === "annual" ? t("pricing.year") : t("pricing.month")}
                    </span>
                  </div>
                  {billingPeriod === "annual" && isPaidTier && (
                    <p className="text-sm text-green-600 mt-1">{t("pricing.billedAnnually")}</p>
                  )}
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      {tier.credits.toLocaleString()} {t("pricing.creditsPerMonth")}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground-muted mt-2">{tier.description}</p>
                </div>

                <ul className="text-sm space-y-3 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check
                        className={`w-4 h-4 mt-0.5 shrink-0 ${tier.id === "pro" ? "text-accent" : tier.id === "plus" ? "text-blue-500" : "text-success"}`}
                      />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrentPlan ? (
                    <div className="text-center text-sm text-foreground-muted py-2 border border-border rounded-lg">
                      {t("pricing.currentPlan")}
                    </div>
                  ) : tier.id === "free" ? (
                    !isAuthenticated ? (
                      <SignInButton mode="modal">
                        <Button variant="outline" className="w-full">
                          {t("pricing.getStarted")}
                        </Button>
                      </SignInButton>
                    ) : null
                  ) : isAuthenticated ? (
                    <Button
                      variant={tier.id === "pro" ? "default" : "outline"}
                      className={`w-full ${checkoutLoading === tier.id ? "btn-loading-gradient" : ""}`}
                      onClick={() => handleUpgrade(tier.id as "plus" | "pro")}
                      disabled={!!checkoutLoading}
                    >
                      {t("pricing.upgrade", { tier: tier.name })}
                    </Button>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        variant={tier.id === "pro" ? "default" : "outline"}
                        className="w-full"
                      >
                        {t("pricing.upgrade", { tier: tier.name })}
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
            {t("pricing.creditCosts.title")}
          </h2>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("pricing.creditCosts.action")}</TableHead>
                  <TableHead className="text-center">{t("pricing.creditCosts.credits")}</TableHead>
                  <TableHead className="text-right">{t("pricing.creditCosts.plusUpTo")}</TableHead>
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
            {t("pricing.creditCosts.footer")}
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2
            className="text-2xl font-bold text-foreground text-center mb-8"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("pricing.faq.title")}
          </h2>
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.whatAreCredits.q")}
              </h3>
              <p className="text-sm text-foreground-muted">{t("pricing.faq.whatAreCredits.a")}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.premadeDecks.q")}
              </h3>
              <p className="text-sm text-foreground-muted">{t("pricing.faq.premadeDecks.a")}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">
                {t("pricing.faq.changePlans.q")}
              </h3>
              <p className="text-sm text-foreground-muted">{t("pricing.faq.changePlans.a")}</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-2">{t("pricing.faq.rollOver.q")}</h3>
              <p className="text-sm text-foreground-muted">{t("pricing.faq.rollOver.a")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

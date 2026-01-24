import { useAction } from "convex/react";
import { Check, Crown, Minus,Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SignInButton,useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?:
    | "flashcards"
    | "sentences"
    | "comprehension"
    | "stories"
    | "shadowing"
    | "images"
    | "general";
  /** Minimum tier required for the feature (default: "basic") */
  requiredTier?: "basic" | "pro" | "power";
}

// Feature comparison data - translation keys for feature names
const FEATURE_KEYS = [
  {
    nameKey: "pricing.paywall.comparison.premiumStories",
    free: false,
    basic: true,
    pro: true,
    power: true,
    highlight: "stories",
  },
  { nameKey: "pricing.paywall.comparison.aiWritingFeedback", free: "—", basic: "200/mo", pro: "1,000/mo", power: "5,000/mo" },
  { nameKey: "pricing.paywall.comparison.audioGeneration", free: "20/mo", basic: "100/mo", pro: "500/mo", power: "2,500/mo" },
  { nameKey: "pricing.paywall.comparison.readingSessions", free: "5/mo", basic: "20/mo", pro: "100/mo", power: "500/mo" },
  {
    nameKey: "pricing.paywall.comparison.flashcardGeneration",
    free: "100/mo",
    basic: "500/mo",
    pro: "3,000/mo",
    power: "15,000/mo",
  },
  {
    nameKey: "pricing.paywall.comparison.shadowingPractice",
    free: false,
    basic: false,
    pro: true,
    power: true,
    highlight: "shadowing",
  },
  {
    nameKey: "pricing.paywall.comparison.aiImageGeneration",
    free: false,
    basic: false,
    pro: true,
    power: true,
    highlight: "images",
  },
  { nameKey: "pricing.paywall.comparison.comprehensionQuizzes", free: false, basic: true, pro: true, power: true },
  { nameKey: "pricing.paywall.comparison.prioritySupport", free: false, basic: false, pro: false, power: true },
] as const;

type TierKey = "free" | "basic" | "pro" | "power";

// Tier info with translation keys
const TIER_CONFIG: Record<TierKey, { nameKey: string; priceKey: string; icon: typeof Zap; color: string }> =
  {
    free: { nameKey: "pricing.tiers.free.name", priceKey: "pricing.tiers.free.price", icon: Minus, color: "text-foreground-muted" },
    basic: { nameKey: "pricing.tiers.basic.name", priceKey: "pricing.tiers.basic.price", icon: Zap, color: "text-blue-500" },
    pro: { nameKey: "pricing.tiers.pro.name", priceKey: "pricing.tiers.pro.price", icon: Crown, color: "text-accent" },
    power: { nameKey: "pricing.tiers.power.name", priceKey: "pricing.tiers.power.price", icon: Sparkles, color: "text-purple-500" },
  };

export function Paywall({
  isOpen,
  onClose,
  title,
  description,
  feature = "general",
  requiredTier = "basic",
}: PaywallProps) {
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

  // Get translated content based on feature type
  const getFeatureContent = () => {
    if (feature === "general") {
      return {
        title: title || t("pricing.paywall.defaultTitle"),
        description: description || t("pricing.paywall.defaultDescription"),
      };
    }

    // Feature-specific translations
    const featureKey = feature as "flashcards" | "sentences" | "comprehension" | "stories" | "shadowing" | "images";
    return {
      title: t(`pricing.paywall.features.${featureKey}.title`),
      description: t(`pricing.paywall.features.${featureKey}.description`),
    };
  };

  const content = getFeatureContent();

  // Determine which tiers to show based on requiredTier
  const showTiers: TierKey[] =
    requiredTier === "pro" || requiredTier === "power"
      ? ["pro", "power"]
      : ["free", "basic", "pro", "power"];

  const renderCell = (value: boolean | string, tierKey: TierKey, featureHighlight?: string) => {
    const isHighlighted = featureHighlight === feature;

    if (typeof value === "boolean") {
      if (value) {
        return (
          <div className={`flex justify-center ${isHighlighted ? "scale-110" : ""}`}>
            <Check className={`w-5 h-5 ${TIER_CONFIG[tierKey].color}`} />
          </div>
        );
      }
      return (
        <div className="flex justify-center">
          <Minus className="w-5 h-5 text-foreground-muted/40" />
        </div>
      );
    }

    return (
      <span
        className={`text-sm font-medium ${value === "—" ? "text-foreground-muted/40" : "text-foreground"}`}
      >
        {value}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border shadow-lg max-w-4xl w-full p-6 sm:p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-foreground-muted" />
        </button>

        <div className="text-center mb-6">
          <h3
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {content.title}
          </h3>
          <p className="text-foreground-muted">{content.description}</p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-3 max-w-sm mx-auto">
            <p className="text-sm text-foreground-muted text-center">
              {t("pricing.paywall.signInPrompt")}
            </p>
            <SignInButton mode="modal">
              <Button className="w-full" size="lg">
                {t("pricing.paywall.signInButton")}
              </Button>
            </SignInButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Comparison Table */}
            <table className="w-full">
              {/* Header Row - Tier names and prices */}
              <thead>
                <tr>
                  <th className="text-left py-3 px-2 w-[180px]"></th>
                  {showTiers.map((tier) => {
                    const config = TIER_CONFIG[tier];
                    const Icon = config.icon;
                    const isRecommended = tier === "pro";
                    const isCurrent = tier === "free";

                    return (
                      <th
                        key={tier}
                        className={`text-center py-3 px-3 min-w-[100px] ${isRecommended ? "bg-accent/5 rounded-t-xl" : ""}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {isRecommended && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-white font-medium mb-1">
                              {t("pricing.paywall.recommended")}
                            </span>
                          )}
                          <div className={`flex items-center gap-1.5 ${config.color}`}>
                            <Icon className="w-4 h-4" />
                            <span className="font-semibold">{t(config.nameKey)}</span>
                          </div>
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-2xl font-bold text-foreground">{t(config.priceKey)}</span>
                            <span className="text-xs text-foreground-muted">{t("pricing.tiers.free.period")}</span>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] text-foreground-muted">{t("pricing.paywall.current")}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Feature Rows */}
              <tbody>
                {FEATURES.map((row, idx) => {
                  const isHighlighted = row.highlight === feature;

                  return (
                    <tr
                      key={row.name}
                      className={`border-t border-border/50 ${isHighlighted ? "bg-accent/5" : idx % 2 === 0 ? "bg-muted/20" : ""}`}
                    >
                      <td
                        className={`py-3 px-2 text-sm ${isHighlighted ? "font-semibold text-accent" : "text-foreground"}`}
                      >
                        {row.name}
                        {isHighlighted && <span className="ml-1 text-accent">←</span>}
                      </td>
                      {showTiers.map((tier) => {
                        const isRecommended = tier === "pro";
                        return (
                          <td
                            key={tier}
                            className={`py-3 px-3 text-center ${isRecommended ? "bg-accent/5" : ""}`}
                          >
                            {renderCell(row[tier], tier, row.highlight)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              {/* Action Row - Upgrade buttons */}
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-4 px-2"></td>
                  {showTiers.map((tier) => {
                    if (tier === "free") {
                      return <td key={tier} className="py-4 px-3"></td>;
                    }

                    const isRecommended = tier === "pro";
                    const info = TIER_INFO[tier];

                    return (
                      <td
                        key={tier}
                        className={`py-4 px-3 ${isRecommended ? "bg-accent/5 rounded-b-xl" : ""}`}
                      >
                        <Button
                          variant={isRecommended ? "default" : "outline"}
                          size="sm"
                          className={`w-full ${
                            tier === "power" ? "border-purple-500/30 hover:bg-purple-500/10" : ""
                          } ${checkoutLoading === tier ? "btn-loading-gradient" : ""}`}
                          onClick={() => handleUpgrade(tier as "basic" | "pro" | "power")}
                        >
                          Get {info.name}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

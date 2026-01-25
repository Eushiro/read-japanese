import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Crown, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useT } from "@/lib/i18n";

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  /** The action that triggered the paywall (e.g., "generate a sentence") */
  action?: string;
  /** Alias for action - the feature that triggered the paywall */
  feature?: string;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Required subscription tier for the feature */
  requiredTier?: string;
  /** Credits required for the action */
  creditsNeeded?: number;
}

export function Paywall({
  isOpen,
  onClose,
  action,
  feature,
  title,
  description,
  requiredTier: _requiredTier,
  creditsNeeded = 1,
}: PaywallProps) {
  // Use feature as alias for action
  const actionText = action || feature;
  const t = useT();
  const { isAuthenticated } = useAuth();
  const { remaining, limit, tier } = useCreditBalance();

  if (!isOpen) return null;

  const isOutOfCredits = remaining < creditsNeeded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border shadow-lg max-w-md w-full p-6 sm:p-8 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-foreground-muted" />
        </button>

        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>

          {/* Title */}
          <h3
            className="text-xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title
              ? title
              : isOutOfCredits
                ? t("paywall.outOfCredits")
                : t("paywall.upgradeRequired")}
          </h3>

          {/* Description */}
          <p className="text-foreground-muted mb-6">
            {description
              ? description
              : isOutOfCredits
                ? t("paywall.outOfCreditsMessage", { limit })
                : actionText
                  ? t("paywall.actionMessage", { action: actionText })
                  : t("paywall.genericMessage")}
          </p>

          {/* Current status */}
          <div className="bg-muted/50 rounded-lg p-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">{t("paywall.currentPlan")}</span>
              <span className="font-medium text-foreground capitalize">{tier}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-foreground-muted">{t("paywall.creditsRemaining")}</span>
              <span
                className={`font-medium ${remaining === 0 ? "text-red-500" : "text-foreground"}`}
              >
                {remaining} / {limit}
              </span>
            </div>
          </div>

          {/* Actions */}
          {!isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground-muted">{t("paywall.signInPrompt")}</p>
              <SignInButton mode="modal">
                <Button className="w-full" size="lg">
                  {t("paywall.signIn")}
                </Button>
              </SignInButton>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Upgrade options */}
              <div className="grid grid-cols-2 gap-3">
                {tier === "free" && (
                  <Link to="/pricing" className="block">
                    <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-sm">Plus</span>
                      </div>
                      <p className="text-xs text-foreground-muted">500 credits/mo</p>
                      <p className="text-sm font-bold text-foreground mt-1">$7.99/mo</p>
                    </div>
                  </Link>
                )}
                <Link to="/pricing" className="block">
                  <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-accent" />
                      <span className="font-semibold text-sm">Pro</span>
                    </div>
                    <p className="text-xs text-foreground-muted">2,000 credits/mo</p>
                    <p className="text-sm font-bold text-foreground mt-1">$17.99/mo</p>
                  </div>
                </Link>
              </div>

              {/* View all plans link */}
              <Button asChild variant="outline" className="w-full">
                <Link to="/pricing" className="flex items-center justify-center gap-2">
                  {t("paywall.viewAllPlans")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>

              {/* View usage link */}
              <Link
                to="/settings/usage"
                className="block text-sm text-foreground-muted hover:text-foreground text-center"
              >
                {t("paywall.viewUsage")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

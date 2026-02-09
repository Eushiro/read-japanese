import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Crown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInButton, useAuth } from "@/contexts/AuthContext";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useT } from "@/lib/i18n";
import { formatPrice, getTier, type TierId } from "@/lib/tiers";

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
  const t = useT();
  // Use feature as alias for action, and translate it
  const featureKey = action || feature;
  const actionText = featureKey ? t(`paywall.features.${featureKey}`) : undefined;
  const { isAuthenticated } = useAuth();
  const { remaining, tier } = useCreditBalance();

  const isOutOfCredits = remaining < creditsNeeded;

  const resolvedTitle = title
    ? title
    : isOutOfCredits
      ? t("paywall.outOfCredits")
      : t("paywall.upgradeRequired");

  const resolvedDescription = description
    ? description
    : isOutOfCredits
      ? t("paywall.outOfCreditsMessage")
      : actionText
        ? t("paywall.actionMessage", { action: actionText })
        : t("paywall.genericMessage");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface max-w-md p-6 sm:p-8 rounded-2xl border-border">
        <DialogHeader className="text-center space-y-4">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>

          {/* Title */}
          <DialogTitle
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {resolvedTitle}
          </DialogTitle>

          {/* Description */}
          <DialogDescription className="text-foreground-muted">
            {resolvedDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Current status */}
        <div className="bg-muted/50 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">{t("paywall.currentPlan")}</span>
            <span className="font-medium text-foreground">
              {t(`settings.subscription.tiers.${tier as TierId}.name`)}
            </span>
          </div>
        </div>

        {/* Actions */}
        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted text-center">{t("paywall.signInPrompt")}</p>
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
                      <span className="font-semibold text-sm">
                        {t("settings.subscription.tiers.plus.name")}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {t("pricing.tiers.plus.features.0")}
                    </p>
                    <p className="text-sm font-bold text-foreground mt-1">
                      {formatPrice(getTier("plus")?.price.monthly ?? 7.99)}
                      {t("settings.subscription.perMonth")}
                    </p>
                  </div>
                </Link>
              )}
              <Link to="/pricing" className="block">
                <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-accent" />
                    <span className="font-semibold text-sm">
                      {t("settings.subscription.tiers.pro.name")}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted">
                    {t("pricing.tiers.pro.features.0")}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {formatPrice(getTier("pro")?.price.monthly ?? 17.99)}
                    {t("settings.subscription.perMonth")}
                  </p>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { X, Loader2, Crown, Zap, Sparkles, Check } from "lucide-react";
import { useAuth, SignInButton } from "@/contexts/AuthContext";

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  feature?: "flashcards" | "sentences" | "stories" | "general";
}

export function Paywall({
  isOpen,
  onClose,
  title = "Upgrade Your Plan",
  description = "Unlock premium features to enhance your learning.",
  icon,
  feature = "general",
}: PaywallProps) {
  const { user, isAuthenticated } = useAuth();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: "basic" | "pro" | "unlimited") => {
    if (!user) return;
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

  // Feature-specific content
  const featureContent = {
    flashcards: {
      title: "Upgrade for AI Flashcards",
      description: "Generate AI-powered flashcards with example sentences for your vocabulary.",
      basicFeatures: ["500 flashcards/month", "200 AI checks/month"],
      proFeatures: ["Unlimited flashcards", "1,000 AI checks/month"],
    },
    sentences: {
      title: "Upgrade for AI Feedback",
      description: "Get AI-powered feedback on your sentences with grammar corrections and suggestions.",
      basicFeatures: ["200 AI checks/month", "Basic feedback"],
      proFeatures: ["1,000 AI checks/month", "Detailed grammar feedback"],
    },
    stories: {
      title: "Upgrade to Generate Stories",
      description: "Create custom stories tailored to your level and interests with AI.",
      basicFeatures: ["5 AI stories/month", "20 stories access"],
      proFeatures: ["20 AI stories/month", "Unlimited reading"],
    },
    general: {
      title: title,
      description: description,
      basicFeatures: ["200 AI checks/month", "500 flashcards/month", "5 AI stories/month"],
      proFeatures: ["1,000 AI checks/month", "Unlimited flashcards", "20 AI stories/month"],
    },
  };

  const content = featureContent[feature];

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Free Tier */}
            <div className="p-6 rounded-xl border border-border bg-muted/30 flex flex-col min-h-[380px]">
              <div className="text-center mb-4">
                <span className="text-sm font-medium text-foreground-muted uppercase tracking-wider">Free</span>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">$0</span>
                  <span className="text-foreground-muted">/mo</span>
                </div>
              </div>
              <ul className="text-sm space-y-2 flex-1">
                <li className="flex items-start gap-2">
                  <X className="w-4 h-4 text-foreground-muted mt-0.5 shrink-0" />
                  <span className="text-foreground-muted">No AI generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">5 stories/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">50 AI checks/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">100 flashcards/month</span>
                </li>
              </ul>
              <div className="text-center text-sm text-foreground-muted mt-5">
                Current plan
              </div>
            </div>

            {/* Basic Tier */}
            <div className="p-6 rounded-xl border border-border flex flex-col min-h-[380px]">
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
              <ul className="text-sm space-y-2 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>5</strong> AI stories/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">20 stories/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">200 AI checks/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">500 flashcards/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">2 mock tests/month</span>
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full mt-5"
                onClick={() => handleUpgrade("basic")}
                disabled={checkoutLoading === "basic"}
              >
                {checkoutLoading === "basic" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Basic"}
              </Button>
            </div>

            {/* Pro Tier - Recommended */}
            <div className="p-6 pt-9 rounded-xl border-2 border-accent bg-accent/5 relative flex flex-col min-h-[380px]">
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
              <ul className="text-sm space-y-2 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>20</strong> AI stories/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> reading</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-foreground">1,000 AI checks/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> flashcards</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-foreground">10 mock tests/month</span>
                </li>
              </ul>
              <Button
                className="w-full mt-5"
                onClick={() => handleUpgrade("pro")}
                disabled={checkoutLoading === "pro"}
              >
                {checkoutLoading === "pro" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Pro"}
              </Button>
            </div>

            {/* Unlimited Tier */}
            <div className="p-6 rounded-xl border border-border bg-gradient-to-b from-purple-500/5 to-transparent flex flex-col min-h-[380px]">
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
              <ul className="text-sm space-y-2 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> AI stories</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> reading</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> AI checks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> flashcards</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span className="text-foreground"><strong>Unlimited</strong> mock tests</span>
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full mt-5 border-purple-500/30 hover:bg-purple-500/10"
                onClick={() => handleUpgrade("unlimited")}
                disabled={checkoutLoading === "unlimited"}
              >
                {checkoutLoading === "unlimited" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Unlimited"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

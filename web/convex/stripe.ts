"use node";

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

// ============================================
// STRIPE CONFIGURATION
// ============================================

// Price IDs for new unified credit system (Starter/Pro)
// Set these in Stripe Dashboard and add to Convex env vars
const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
} as const;

// Legacy price IDs (for existing subscribers - maps to new tiers)
const LEGACY_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC, // Maps to starter
  pro: process.env.STRIPE_PRICE_PRO,
  power: process.env.STRIPE_PRICE_UNLIMITED, // Maps to pro
};

// Tier from price ID (reverse lookup)
type NewTier = "starter" | "pro";
const TIER_FROM_PRICE: Record<string, NewTier> = {};

// Map new prices
if (PRICE_IDS.starter_monthly) TIER_FROM_PRICE[PRICE_IDS.starter_monthly] = "starter";
if (PRICE_IDS.starter_annual) TIER_FROM_PRICE[PRICE_IDS.starter_annual] = "starter";
if (PRICE_IDS.pro_monthly) TIER_FROM_PRICE[PRICE_IDS.pro_monthly] = "pro";
if (PRICE_IDS.pro_annual) TIER_FROM_PRICE[PRICE_IDS.pro_annual] = "pro";

// Map legacy prices to new tiers for existing subscribers
if (LEGACY_PRICE_IDS.basic) TIER_FROM_PRICE[LEGACY_PRICE_IDS.basic] = "starter";
if (LEGACY_PRICE_IDS.pro) TIER_FROM_PRICE[LEGACY_PRICE_IDS.pro] = "pro";
if (LEGACY_PRICE_IDS.power) TIER_FROM_PRICE[LEGACY_PRICE_IDS.power] = "pro";

// Cache Stripe instance to avoid re-initialization
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("[Stripe] STRIPE_SECRET_KEY environment variable is not set in Convex dashboard");
    throw new Error("Payment system is not configured. Please contact support.");
  }
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

function getTierFromPriceId(priceId: string): NewTier | null {
  return TIER_FROM_PRICE[priceId] || null;
}

// Helper to check which env vars are missing
function getMissingPriceIds(): string[] {
  const missing: string[] = [];
  if (!PRICE_IDS.starter_monthly) missing.push("STRIPE_PRICE_STARTER");
  if (!PRICE_IDS.starter_annual) missing.push("STRIPE_PRICE_STARTER_ANNUAL");
  if (!PRICE_IDS.pro_monthly) missing.push("STRIPE_PRICE_PRO");
  if (!PRICE_IDS.pro_annual) missing.push("STRIPE_PRICE_PRO_ANNUAL");
  return missing;
}

// ============================================
// CUSTOMER PRE-CREATION (for faster checkout)
// ============================================

// Create Stripe customer during onboarding (before checkout)
// This removes one API call from the checkout flow
export const ensureStripeCustomer = action({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ customerId: string | null }> => {
    try {
      // Check if user already has a customer ID
      const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
        clerkId: args.userId,
      });

      if (user?.stripeCustomerId) {
        console.log(`[Stripe] User ${args.userId} already has customer ID`);
        return { customerId: user.stripeCustomerId };
      }

      // Also check subscription table (backwards compat)
      const existingSub = await ctx.runQuery(internal.stripeHelpers.getSubscriptionByUserId, {
        userId: args.userId,
      });

      if (existingSub?.stripeCustomerId) {
        // Migrate customer ID to user table
        await ctx.runMutation(internal.stripeHelpers.saveStripeCustomerId, {
          clerkId: args.userId,
          stripeCustomerId: existingSub.stripeCustomerId,
        });
        return { customerId: existingSub.stripeCustomerId };
      }

      // Create new Stripe customer
      const stripe = getStripe();
      console.log(`[Stripe] Pre-creating customer for user ${args.userId}`);

      const customer = await stripe.customers.create({
        email: args.email,
        metadata: { userId: args.userId },
      });

      // Save to user table
      await ctx.runMutation(internal.stripeHelpers.saveStripeCustomerId, {
        clerkId: args.userId,
        stripeCustomerId: customer.id,
      });

      console.log(`[Stripe] Pre-created customer ${customer.id}`);
      return { customerId: customer.id };
    } catch (error) {
      // Don't fail onboarding if Stripe customer creation fails
      console.error("[Stripe] Error pre-creating customer:", error);
      return { customerId: null };
    }
  },
});

// ============================================
// CHECKOUT ACTIONS
// ============================================

// Create a checkout session for subscription
export const createCheckoutSession = action({
  args: {
    userId: v.string(),
    tier: v.union(v.literal("starter"), v.literal("pro")),
    billingPeriod: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ sessionId: string; url: string | null }> => {
    try {
      const billingPeriod = args.billingPeriod ?? "monthly";

      // Log missing configuration for debugging
      const missingPrices = getMissingPriceIds();
      if (missingPrices.length > 0) {
        console.error(`[Stripe] Missing price IDs in Convex env vars: ${missingPrices.join(", ")}`);
      }

      // Get the appropriate price ID based on tier and billing period
      const priceKey = `${args.tier}_${billingPeriod}` as keyof typeof PRICE_IDS;
      const priceId = PRICE_IDS[priceKey];

      if (!priceId) {
        console.error(`[Stripe] Price ID for ${priceKey} is not set in Convex dashboard`);
        throw new Error(
          `Subscription for ${args.tier} (${billingPeriod}) is not available. Please contact support.`
        );
      }

      // Initialize Stripe (will throw user-friendly error if key is missing)
      const stripe = getStripe();

      // Check user table first for pre-created customer ID
      const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
        clerkId: args.userId,
      });

      let customerId: string | undefined = user?.stripeCustomerId ?? undefined;

      // Fallback: check subscription table (backwards compat)
      if (!customerId) {
        const existingSub = await ctx.runQuery(internal.stripeHelpers.getSubscriptionByUserId, {
          userId: args.userId,
        });
        customerId = existingSub?.stripeCustomerId ?? undefined;
      }

      // Create customer only if not pre-created (shouldn't happen often)
      if (!customerId) {
        console.log(`[Stripe] Customer not pre-created, creating now for user ${args.userId}`);
        const customer = await stripe.customers.create({
          metadata: { userId: args.userId },
        });
        customerId = customer.id;

        // Save for future use
        await ctx.runMutation(internal.stripeHelpers.saveStripeCustomerId, {
          clerkId: args.userId,
          stripeCustomerId: customerId,
        });
        console.log(`[Stripe] Created customer ${customerId}`);
      } else {
        console.log(`[Stripe] Using pre-created customer ${customerId}`);
      }

      console.log(
        `[Stripe] Creating checkout session for tier ${args.tier} (${billingPeriod}), price ${priceId}`
      );

      // Create checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        subscription_data: {
          metadata: { userId: args.userId },
        },
        metadata: {
          userId: args.userId,
          tier: args.tier,
          billingPeriod,
        },
      });

      console.log(`[Stripe] Checkout session created: ${checkoutSession.id}`);
      return { sessionId: checkoutSession.id, url: checkoutSession.url };
    } catch (error) {
      console.error("[Stripe] Error creating checkout session:", error);
      if (error instanceof Error) {
        // Re-throw with more context
        throw new Error(`Checkout failed: ${error.message}`);
      }
      throw error;
    }
  },
});

// Create a customer portal session for managing subscription
export const createPortalSession = action({
  args: {
    userId: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const stripe = getStripe();

    const existingSub = await ctx.runQuery(internal.stripeHelpers.getSubscriptionByUserId, {
      userId: args.userId,
    });

    if (!existingSub?.stripeCustomerId) {
      throw new Error("No Stripe customer found for this user");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existingSub.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: portalSession.url };
  },
});

// ============================================
// WEBHOOK PROCESSING ACTION
// ============================================

// Determine billing period from price ID
function getBillingPeriodFromPriceId(priceId: string): "monthly" | "annual" {
  if (priceId === PRICE_IDS.starter_annual || priceId === PRICE_IDS.pro_annual) {
    return "annual";
  }
  return "monthly";
}

// Process Stripe webhook (called by HTTP endpoint)
export const processWebhook = action({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return { success: false, error: "Webhook secret not configured" };
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(args.body, args.signature, webhookSecret);
    } catch {
      return { success: false, error: "Invalid signature" };
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier as NewTier | undefined;
        const billingPeriod = session.metadata?.billingPeriod as "monthly" | "annual" | undefined;

        if (userId && tier && session.subscription) {
          const subscriptionData = (await stripe.subscriptions.retrieve(
            session.subscription as string
          )) as unknown as {
            id: string;
            current_period_end: number;
            items: { data: Array<{ price: { id: string } }> };
          };

          // Determine billing period from price if not in metadata
          const actualBillingPeriod =
            billingPeriod ??
            getBillingPeriodFromPriceId(subscriptionData.items?.data?.[0]?.price?.id ?? "");

          await ctx.runMutation(internal.stripeHelpers.handleSubscriptionCreated, {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionData.id,
            tier,
            billingPeriod: actualBillingPeriod,
            currentPeriodEnd: subscriptionData.current_period_end * 1000,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscriptionData = event.data.object;
        const priceId = (
          subscriptionData as { items?: { data?: Array<{ price?: { id?: string } }> } }
        ).items?.data?.[0]?.price?.id;
        const tier = priceId ? getTierFromPriceId(priceId) : null;

        if (tier) {
          const subStatus = (subscriptionData as { status?: string }).status;
          let status: "active" | "cancelled" | "expired" = "active";
          if (subStatus === "canceled") {
            status = "cancelled";
          } else if (subStatus === "past_due" || subStatus === "unpaid") {
            status = "expired";
          }

          const billingPeriod = priceId ? getBillingPeriodFromPriceId(priceId) : "monthly";

          await ctx.runMutation(internal.stripeHelpers.handleSubscriptionUpdated, {
            stripeSubscriptionId: (subscriptionData as { id: string }).id,
            tier,
            billingPeriod,
            status,
            currentPeriodEnd:
              ((subscriptionData as { current_period_end?: number }).current_period_end ?? 0) *
              1000,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscriptionData = event.data.object;

        await ctx.runMutation(internal.stripeHelpers.handleSubscriptionCancelled, {
          stripeSubscriptionId: (subscriptionData as { id: string }).id,
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { success: true };
  },
});

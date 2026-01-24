/**
 * Provider-agnostic payment interfaces
 *
 * These types allow switching between payment providers (Stripe, Paddle, etc.)
 * without changing the application code.
 */

import type { SubscriptionStatus,SubscriptionTier } from "../schema";

/**
 * Result of creating a checkout session
 */
export interface CheckoutSessionResult {
  /** Session ID from the payment provider */
  sessionId: string;
  /** URL to redirect the user to for checkout */
  url: string | null;
}

/**
 * Result of creating a customer portal session
 */
export interface PortalSessionResult {
  /** URL to redirect the user to for the customer portal */
  url: string;
}

/**
 * Arguments for creating a checkout session
 */
export interface CreateCheckoutArgs {
  userId: string;
  tier: Exclude<SubscriptionTier, "free">;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Arguments for creating a portal session
 */
export interface CreatePortalArgs {
  userId: string;
  returnUrl: string;
}

/**
 * Subscription data from payment provider webhook
 */
export interface SubscriptionWebhookData {
  userId: string;
  customerId: string;
  subscriptionId: string;
  tier: Exclude<SubscriptionTier, "free">;
  status: SubscriptionStatus;
  currentPeriodEnd: number;
}

/**
 * Payment provider interface
 * Implement this interface for each payment provider
 */
export interface PaymentProvider {
  /**
   * Create a checkout session for a new subscription
   */
  createCheckoutSession(args: CreateCheckoutArgs): Promise<CheckoutSessionResult>;

  /**
   * Create a customer portal session for managing subscriptions
   */
  createPortalSession(args: CreatePortalArgs): Promise<PortalSessionResult>;
}

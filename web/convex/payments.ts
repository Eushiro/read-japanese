/**
 * Provider-agnostic payment layer
 *
 * This file serves as the abstraction point for payment providers.
 * Currently using Stripe, but can be switched to Paddle, LemonSqueezy, etc.
 *
 * To switch providers:
 * 1. Create a new provider file (e.g., paddle.ts) implementing the same actions
 * 2. Update the re-exports below to use the new provider
 * 3. Update schema.ts to add provider-agnostic fields if needed
 *
 * Current provider: Stripe (stripe.ts)
 */

// Re-export payment types for use in components
export type {
  CheckoutSessionResult,
  PortalSessionResult,
  CreateCheckoutArgs,
  CreatePortalArgs,
} from "./lib/paymentTypes";

// Re-export the current payment provider's actions
// To switch providers, change these imports to point to the new provider
export {
  createCheckoutSession,
  createPortalSession,
  processWebhook,
} from "./stripe";

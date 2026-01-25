/**
 * Shared tier and pricing configuration
 *
 * Tiers are imported from shared/tiers.json to ensure consistency
 * between frontend and backend. To change pricing or features, update that file.
 */

import tiersConfig from "../../../shared/tiers.json";

// Tier IDs - keep tier names in sync with shared/tiers.json
export type TierId = "free" | "plus" | "pro";

// Paid tier IDs - used for checkout/upgrade flows
export type PaidTierId = Exclude<TierId, "free">;

// Feature keys that can be translated
export type TierFeatureKey =
  | "credits"
  | "unlimitedDecks"
  | "progressTracking"
  | "everythingInPlus"
  | "prioritySupport";

// Tier data structure from JSON
export interface TierConfig {
  id: TierId;
  credits: number;
  price: { monthly: number; annual: number };
  features: TierFeatureKey[];
  popular?: boolean;
}

// Export tiers array with proper typing
export const TIERS = tiersConfig.tiers as TierConfig[];

// Export currency config
export const CURRENCY = tiersConfig.currency;
export const CURRENCY_SYMBOL = tiersConfig.currencySymbol;

// Export credit limits as a record for easy lookup
export const TIER_CREDITS = Object.fromEntries(
  tiersConfig.tiers.map((t) => [t.id, t.credits])
) as Record<TierId, number>;

/**
 * Get tier config by ID
 */
export function getTier(id: TierId): TierConfig | undefined {
  return TIERS.find((t) => t.id === id);
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}

/**
 * Get annual savings percentage for a tier
 */
export function getAnnualSavings(tierId: TierId): number {
  const tier = getTier(tierId);
  if (!tier || tier.price.monthly === 0) return 0;
  const monthlyAnnual = tier.price.monthly * 12;
  const savings = ((monthlyAnnual - tier.price.annual) / monthlyAnnual) * 100;
  return Math.round(savings);
}

/**
 * Check if a tier is paid (not free)
 */
export function isPaidTier(tierId: TierId): boolean {
  const tier = getTier(tierId);
  return tier ? tier.price.monthly > 0 : false;
}

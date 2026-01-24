/**
 * Centralized admin email management
 * Single source of truth for admin access control
 */

// Admin emails - users with these emails can enable admin mode
export const ADMIN_EMAILS = ["hiro.ayettey@gmail.com"] as const;

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email as (typeof ADMIN_EMAILS)[number]);
}

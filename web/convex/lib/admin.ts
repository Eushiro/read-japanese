/**
 * Centralized admin email management
 * Single source of truth for admin access control
 *
 * Set ADMIN_EMAILS environment variable in Convex dashboard
 * as a comma-separated list of emails
 */

/**
 * Get admin emails from environment variable
 */
export function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS;
  if (!envEmails) return [];
  return envEmails.split(",").map((email) => email.trim());
}

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email);
}

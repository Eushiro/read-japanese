// Admin utility functions

/**
 * Get admin emails from environment variable
 * Set VITE_ADMIN_EMAILS as a comma-separated list of emails
 */
function getAdminEmails(): string[] {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS;
  if (!envEmails) return [];
  return envEmails.split(",").map((email: string) => email.trim());
}

export const ADMIN_EMAILS = getAdminEmails();

export function isAdmin(email?: string | null): boolean {
  return email ? ADMIN_EMAILS.includes(email) : false;
}

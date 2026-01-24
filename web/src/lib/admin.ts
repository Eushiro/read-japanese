// Admin utility functions

export const ADMIN_EMAILS = ["hiro.ayettey@gmail.com"];

export function isAdmin(email?: string | null): boolean {
  return email ? ADMIN_EMAILS.includes(email) : false;
}

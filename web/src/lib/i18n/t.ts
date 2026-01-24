/**
 * Global translation function
 *
 * Usage:
 *   import { t } from '@/lib/i18n';
 *   t('common.nav.home')           // "Home"
 *   t('dashboard.welcome', { name: 'John' })  // "Welcome back, John!"
 *
 * The namespace is the first part of the key (before the first dot).
 */

import i18n from "./config";

type TranslationParams = Record<string, string | number>;

/**
 * Translate a key with optional interpolation params
 * @param key - Namespaced key like 'common.nav.home' or 'dashboard.welcome'
 * @param params - Optional interpolation values like { name: 'John' }
 */
export function t(key: string, params?: TranslationParams): string {
  // Split namespace from the rest of the key
  // e.g., 'common.nav.home' -> namespace='common', restKey='nav.home'
  const dotIndex = key.indexOf(".");

  if (dotIndex === -1) {
    // No namespace specified, use 'common' as default
    return i18n.t(key, { ns: "common", ...params }) as string;
  }

  const namespace = key.substring(0, dotIndex);
  const restKey = key.substring(dotIndex + 1);

  return i18n.t(restKey, { ns: namespace, ...params }) as string;
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string): boolean {
  const dotIndex = key.indexOf(".");

  if (dotIndex === -1) {
    return i18n.exists(key, { ns: "common" });
  }

  const namespace = key.substring(0, dotIndex);
  const restKey = key.substring(dotIndex + 1);

  return i18n.exists(restKey, { ns: namespace });
}

/**
 * i18n Abstraction Layer
 *
 * This module provides a library-agnostic API for internationalization.
 * Components should ONLY import from this file, never from react-i18next directly.
 *
 * If we need to switch i18n libraries in the future, we only need to update
 * the implementation files, not every component.
 *
 * @example
 * // Simple usage with global t function:
 * import { t } from '@/lib/i18n';
 * <button>{t('common.nav.home')}</button>
 * <span>{t('dashboard.welcome', { name: 'John' })}</span>
 *
 * // For reactive updates when language changes, use the hook:
 * import { useT } from '@/lib/i18n';
 * function MyComponent() {
 *   const t = useT();
 *   return <button>{t('common.nav.home')}</button>;
 * }
 */

// Types
export type { TranslateFunction, TranslationContextValue, UILanguage } from "./types";
export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, UI_LANGUAGES } from "./types";

// Provider (for main.tsx)
export { TranslationProvider } from "./TranslationProvider";

// Global t function - simple, no hook needed
export { hasTranslation, t } from "./t";

// Hook for reactive translations (re-renders on language change)
export { useI18n, useT } from "./useTranslate";

// UI language management
export { useSyncUILanguage, useUILanguage } from "./useUILanguage";

// Language utilities
export {
  detectBrowserLanguage,
  getStoredLanguage,
  getUILanguage,
  initializeLanguage,
  setUILanguage,
} from "./language";

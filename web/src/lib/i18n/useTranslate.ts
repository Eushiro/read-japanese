/**
 * React hook for translations
 * Use this when you need the component to re-render when language changes
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

type TranslationParams = Record<string, string | number>;

/**
 * Hook that returns a translation function
 * Component will re-render when language changes
 *
 * @example
 * function MyComponent() {
 *   const t = useT();
 *   return <button>{t('common.nav.home')}</button>;
 * }
 */
export function useT(): (key: string, params?: TranslationParams) => string {
  const { t: i18nT, i18n } = useTranslation();

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      // Split namespace from the rest of the key
      const dotIndex = key.indexOf(".");

      if (dotIndex === -1) {
        return i18nT(key, { ns: "common", ...params }) as string;
      }

      const namespace = key.substring(0, dotIndex);
      const restKey = key.substring(dotIndex + 1);

      return i18nT(restKey, { ns: namespace, ...params }) as string;
    },
    [i18nT, i18n.language] // Re-create when language changes
  );

  return t;
}

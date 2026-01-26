/**
 * React hook for translations
 * Use this when you need the component to re-render when language changes
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

type TranslationParams = Record<string, string | number | boolean>;

export type TranslateFunction = {
  (key: string, params?: TranslationParams): string;
  <T>(key: string, params: TranslationParams & { returnObjects: true }): T;
};

/**
 * Hook that returns a translation function
 * Component will re-render when language changes
 *
 * @example
 * function MyComponent() {
 *   const t = useT();
 *   return <button>{t('common.nav.home')}</button>;
 *
 *   // For arrays/objects:
 *   const items = t<string[]>('legal.privacy.sections.infoCollect.items', { returnObjects: true });
 * }
 */
export function useT(): TranslateFunction {
  const { t: i18nT } = useTranslation();

  const t = useCallback(
    <T = string>(key: string, params?: TranslationParams): T => {
      // Split namespace from the rest of the key
      const dotIndex = key.indexOf(".");

      if (dotIndex === -1) {
        return i18nT(key, { ns: "common", ...params }) as T;
      }

      const namespace = key.substring(0, dotIndex);
      const restKey = key.substring(dotIndex + 1);

      return i18nT(restKey, { ns: namespace, ...params }) as T;
    },
    [i18nT] // i18nT already updates when language changes
  );

  return t as TranslateFunction;
}

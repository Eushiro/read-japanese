/**
 * Translation Provider - wraps I18nextProvider
 * Components use this wrapper, not I18nextProvider directly
 * If we switch libraries, only this file needs to change
 */

import { I18nextProvider } from "react-i18next";

import i18n from "./config";

interface TranslationProviderProps {
  children: React.ReactNode;
}

/**
 * Provides translation context to the app
 * Wrap your app with this at the top level
 *
 * @example
 * <TranslationProvider>
 *   <App />
 * </TranslationProvider>
 */
export function TranslationProvider({ children }: TranslationProviderProps) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

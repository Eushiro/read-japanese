/**
 * Language state management - abstraction layer
 * Handles language detection, persistence, and switching
 */

import i18n from "./config";
import type { UILanguage } from "./types";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./types";

const STORAGE_KEY = "uiLanguage";

/**
 * Get the current UI language
 */
export function getUILanguage(): UILanguage {
  return i18n.language as UILanguage;
}

/**
 * Set the UI language
 * Persists to localStorage and updates i18n
 */
export async function setUILanguage(lang: UILanguage): Promise<void> {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`[i18n] Unsupported language: ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
    lang = DEFAULT_LANGUAGE;
  }

  localStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

/**
 * Get the stored language preference from localStorage
 */
export function getStoredLanguage(): UILanguage | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as UILanguage)) {
    return stored as UILanguage;
  }
  return null;
}

/**
 * Detect browser language and return a supported language
 */
export function detectBrowserLanguage(): UILanguage {
  const browserLang = navigator.language.split("-")[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang as UILanguage)) {
    return browserLang as UILanguage;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Initialize language from stored preference or browser detection
 */
export async function initializeLanguage(): Promise<UILanguage> {
  const stored = getStoredLanguage();
  if (stored) {
    await i18n.changeLanguage(stored);
    return stored;
  }

  const detected = detectBrowserLanguage();
  await setUILanguage(detected);
  return detected;
}

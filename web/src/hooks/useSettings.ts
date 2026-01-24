import { useMutation,useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

import { api } from "../../convex/_generated/api";

// Storage key for dev user login
const DEV_USER_STORAGE_KEY = "devUserEnabled";
const SETTINGS_CACHE_KEY = "settingsCache";

// Default shared user ID for dev testing
const SHARED_USER_ID = "shared-dev-user";
const DEMO_USER_ID = "demo-user";
const ANONYMOUS_USER_PREFIX = "anon-";

export type AudioHighlightMode = "word" | "sentence";

export interface UserSettings {
  showFurigana: boolean;
  theme: string;
  fontSize: string;
  autoplayAudio: boolean;
  audioHighlightMode: AudioHighlightMode;
}

const DEFAULT_SETTINGS: UserSettings = {
  showFurigana: true,
  theme: "system",
  fontSize: "medium",
  autoplayAudio: false,
  audioHighlightMode: "sentence",
};

// Get cached settings from localStorage to avoid flicker during loading
function getCachedSettings(): UserSettings {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

// Cache settings to localStorage
function cacheSettings(settings: UserSettings) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// Get anonymous user ID (creates one if doesn't exist)
function getAnonymousUserId(): string {
  const storageKey = "anonymousUserId";
  let anonId = localStorage.getItem(storageKey);
  if (!anonId) {
    anonId = ANONYMOUS_USER_PREFIX + crypto.randomUUID();
    localStorage.setItem(storageKey, anonId);
  }
  return anonId;
}

// Get current user ID based on dev mode setting (fallback for non-authenticated)
export function getCurrentUserId(): string {
  // Check if there's an authenticated user ID stored
  const authUserId = localStorage.getItem("authUserId");
  if (authUserId) {
    return authUserId;
  }

  if (import.meta.env.DEV) {
    const devUserEnabled = localStorage.getItem(DEV_USER_STORAGE_KEY) === "true";
    return devUserEnabled ? SHARED_USER_ID : DEMO_USER_ID;
  }

  // Use anonymous ID for non-authenticated users in production
  return getAnonymousUserId();
}

// Set the authenticated user ID (called from useSettings when auth state changes)
function setAuthUserId(userId: string | null) {
  if (userId) {
    localStorage.setItem("authUserId", userId);
  } else {
    localStorage.removeItem("authUserId");
  }
}

// Check if dev user is enabled
export function isDevUserEnabled(): boolean {
  return localStorage.getItem(DEV_USER_STORAGE_KEY) === "true";
}

// Set dev user enabled state
export function setDevUserEnabled(enabled: boolean) {
  localStorage.setItem(DEV_USER_STORAGE_KEY, String(enabled));
  // Reload to apply new user ID
  window.location.reload();
}

export function useSettings() {
  const { user, isAuthenticated } = useAuth();

  // Use Clerk user ID when authenticated, otherwise fall back to anonymous/demo ID
  const userId = isAuthenticated && user ? user.id : getCurrentUserId();

  // Sync auth user ID to localStorage so getCurrentUserId() works outside React
  useEffect(() => {
    setAuthUserId(isAuthenticated && user ? user.id : null);
  }, [isAuthenticated, user]);

  const settings = useQuery(api.settings.get, { userId });
  const updateMutation = useMutation(api.settings.update);

  // Use state for cached settings (initialized from localStorage to prevent flicker)
  const [cachedSettings, setCachedSettings] = useState<UserSettings>(() => getCachedSettings());

  // Update cache when settings change
  useEffect(() => {
    if (settings) {
      const newSettings: UserSettings = {
        showFurigana: settings.showFurigana,
        theme: settings.theme,
        fontSize: settings.fontSize,
        autoplayAudio: settings.autoplayAudio,
        audioHighlightMode: (settings.audioHighlightMode as AudioHighlightMode) || "sentence",
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync cache with backend settings
      setCachedSettings(newSettings);
      cacheSettings(newSettings);
    }
  }, [settings]);

  // Use live settings when available, otherwise cached settings
  const currentSettings = useMemo<UserSettings>(() => {
    if (settings) {
      return {
        showFurigana: settings.showFurigana,
        theme: settings.theme,
        fontSize: settings.fontSize,
        autoplayAudio: settings.autoplayAudio,
        audioHighlightMode: (settings.audioHighlightMode as AudioHighlightMode) || "sentence",
      };
    }
    // Return cached settings while loading to prevent flicker
    return cachedSettings;
  }, [settings, cachedSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      // Optimistically update cache
      const newSettings = { ...cachedSettings, ...updates };
      setCachedSettings(newSettings);
      cacheSettings(newSettings);

      await updateMutation({
        userId,
        ...updates,
      });
    },
    [updateMutation, userId, cachedSettings]
  );

  const setShowFurigana = useCallback(
    (value: boolean) => updateSettings({ showFurigana: value }),
    [updateSettings]
  );

  const setTheme = useCallback(
    (value: string) => updateSettings({ theme: value }),
    [updateSettings]
  );

  const setFontSize = useCallback(
    (value: string) => updateSettings({ fontSize: value }),
    [updateSettings]
  );

  const setAutoplayAudio = useCallback(
    (value: boolean) => updateSettings({ autoplayAudio: value }),
    [updateSettings]
  );

  const setAudioHighlightMode = useCallback(
    (value: AudioHighlightMode) => updateSettings({ audioHighlightMode: value }),
    [updateSettings]
  );

  return {
    settings: currentSettings,
    isLoading: settings === undefined,
    updateSettings,
    setShowFurigana,
    setTheme,
    setFontSize,
    setAutoplayAudio,
    setAudioHighlightMode,
    userId,
  };
}

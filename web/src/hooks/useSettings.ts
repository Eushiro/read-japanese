import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useMemo } from "react";

// TODO: Replace with actual user ID from auth
const MOCK_USER_ID = "demo-user";

export interface UserSettings {
  showFurigana: boolean;
  theme: string;
  fontSize: string;
  autoplayAudio: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  showFurigana: true,
  theme: "system",
  fontSize: "medium",
  autoplayAudio: false,
};

export function useSettings() {
  const settings = useQuery(api.settings.get, { userId: MOCK_USER_ID });
  const updateMutation = useMutation(api.settings.update);

  const currentSettings = useMemo<UserSettings>(() => {
    if (!settings) return DEFAULT_SETTINGS;
    return {
      showFurigana: settings.showFurigana,
      theme: settings.theme,
      fontSize: settings.fontSize,
      autoplayAudio: settings.autoplayAudio,
    };
  }, [settings]);

  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      await updateMutation({
        userId: MOCK_USER_ID,
        ...updates,
      });
    },
    [updateMutation]
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

  return {
    settings: currentSettings,
    isLoading: settings === undefined,
    updateSettings,
    setShowFurigana,
    setTheme,
    setFontSize,
    setAutoplayAudio,
  };
}

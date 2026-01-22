import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";

/**
 * ThemeProvider applies the theme from user settings to the document.
 * Should be rendered near the app root to ensure theme is always applied.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const theme = settings.theme;

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const updateTheme = () => {
        root.classList.toggle("dark", mediaQuery.matches);
      };
      updateTheme();
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  return <>{children}</>;
}

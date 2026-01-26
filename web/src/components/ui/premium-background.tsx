import { useEffect, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";

type ColorScheme = "warm" | "cool" | "purple" | "green";

interface PremiumBackgroundProps {
  colorScheme?: ColorScheme;
  starCount?: number;
  showOrbs?: boolean;
  animateStars?: boolean;
  animateOrbs?: boolean;
}

// Color schemes with hex values for direct use
const COLOR_SCHEMES = {
  warm: { primary: "#ff8400", secondary: "#df91f7" },
  cool: { primary: "#3b82f6", secondary: "#a855f7" },
  purple: { primary: "#a855f7", secondary: "#df91f7" },
  green: { primary: "#86efac", secondary: "#14b8a6" },
};

export function PremiumBackground({
  colorScheme = "warm",
  starCount = 8,
  showOrbs = true,
  animateStars = false,
  animateOrbs = false,
}: PremiumBackgroundProps) {
  const { primary, secondary } = COLOR_SCHEMES[colorScheme];

  // Theme detection for stars (dark mode only)
  const { theme } = useTheme();
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Stars - only in dark mode */}
      {isDark &&
        [...Array(starCount)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 bg-white rounded-full ${animateStars ? "animate-star-fade" : "star-static"}`}
            style={{
              left: `${(i * 13 + 3) % 100}%`,
              top: `${(i * 17 + 7) % 100}%`,
              ...(animateStars && {
                animationDelay: `${(i % 8) * 0.5}s`,
                animationDuration: `${2.5 + (i % 4) * 0.5}s`,
              }),
            }}
          />
        ))}

      {/* Gradient orbs */}
      {showOrbs && (
        <>
          <div
            className={`absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-20 ${animateOrbs ? "animate-orb-float" : ""}`}
            style={{
              background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
              top: "10%",
              left: "20%",
            }}
          />
          <div
            className={`absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-15 ${animateOrbs ? "animate-orb-float-alt" : ""}`}
            style={{
              background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)`,
              bottom: "20%",
              right: "15%",
            }}
          />
        </>
      )}
    </div>
  );
}

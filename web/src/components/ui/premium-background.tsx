import { useEffect, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";
import { useIsMobile } from "@/hooks/useIsMobile";

type ColorScheme = "warm" | "cool" | "purple" | "green";
type Intensity = "normal" | "low" | "minimal";

interface PremiumBackgroundProps {
  colorScheme?: ColorScheme;
  starCount?: number;
  showOrbs?: boolean;
  animateStars?: boolean;
  animateOrbs?: boolean;
  /** Controls orb opacity - use "low" for content pages, "minimal" for focus pages like tests */
  intensity?: Intensity;
}

// Intensity mapping for orb opacity
const INTENSITY_MAP = {
  normal: { primary: "opacity-20", secondary: "opacity-15" },
  low: { primary: "opacity-10", secondary: "opacity-[0.08]" },
  minimal: { primary: "opacity-5", secondary: "opacity-[0.03]" },
};

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
  intensity = "normal",
}: PremiumBackgroundProps) {
  const { primary, secondary } = COLOR_SCHEMES[colorScheme];
  const { primary: primaryOpacity, secondary: secondaryOpacity } = INTENSITY_MAP[intensity];

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

  // On mobile: fewer stars, no animations, smaller orbs
  const isMobile = useIsMobile();
  const effectiveStarCount = isMobile ? Math.min(starCount, 5) : starCount;
  const effectiveAnimateStars = isMobile ? false : animateStars;
  const effectiveAnimateOrbs = isMobile ? false : animateOrbs;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Stars - only in dark mode */}
      {isDark &&
        [...Array(effectiveStarCount)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 bg-white rounded-full ${effectiveAnimateStars ? "animate-star-fade" : "star-static"}`}
            style={{
              left: `${(i * 13 + 3) % 100}%`,
              top: `${(i * 17 + 7) % 100}%`,
              ...(effectiveAnimateStars && {
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
            className={`absolute rounded-full blur-3xl ${primaryOpacity} ${effectiveAnimateOrbs ? "animate-orb-float" : ""} ${isMobile ? "w-[300px] h-[300px]" : "w-[500px] h-[500px]"}`}
            style={{
              background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
              top: "10%",
              left: "20%",
            }}
          />
          <div
            className={`absolute rounded-full blur-3xl ${secondaryOpacity} ${effectiveAnimateOrbs ? "animate-orb-float-alt" : ""} ${isMobile ? "w-[250px] h-[250px]" : "w-[400px] h-[400px]"}`}
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

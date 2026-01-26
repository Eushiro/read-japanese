import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";

type ColorScheme = "default" | "green" | "purple" | "cyan" | "warm" | "cool";

interface PremiumBackgroundProps {
  variant: "hero" | "page" | "subtle";
  colorScheme: ColorScheme;
  showStars: boolean;
  showOrbs: boolean;
  orbCount: 1 | 2 | 3;
}

// Color schemes for different pages (RGB values)
const COLOR_SCHEMES = {
  default: { primary: "255, 132, 0", secondary: "168, 85, 247", tertiary: "254, 237, 122" },
  green: { primary: "134, 239, 172", secondary: "20, 184, 166", tertiary: "167, 243, 208" },
  purple: { primary: "168, 85, 247", secondary: "223, 145, 247", tertiary: "139, 92, 246" },
  cyan: { primary: "6, 182, 212", secondary: "168, 85, 247", tertiary: "34, 211, 238" },
  warm: { primary: "255, 132, 0", secondary: "254, 237, 122", tertiary: "223, 145, 247" },
  cool: { primary: "59, 130, 246", secondary: "168, 85, 247", tertiary: "99, 102, 241" },
};

export function PremiumBackground({
  variant,
  colorScheme,
  showStars,
  showOrbs,
  orbCount,
}: PremiumBackgroundProps) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 100]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -50]);
  const y3 = useTransform(scrollY, [0, 1000], [0, 75]);

  // Theme detection
  const { theme } = useTheme();
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true
  );

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Compute isDark based on theme setting
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  const orbConfig = useMemo(() => {
    const sizes = {
      hero: { primary: 600, secondary: 500, tertiary: 400 },
      page: { primary: 400, secondary: 350, tertiary: 300 },
      subtle: { primary: 300, secondary: 250, tertiary: 200 },
    };

    const baseOpacities = {
      hero: { primary: 0.2, secondary: 0.15, tertiary: 0.1 },
      page: { primary: 0.2, secondary: 0.15, tertiary: 0.1 },
      subtle: { primary: 0.2, secondary: 0.15, tertiary: 0.1 },
    };

    // Light mode: reduce opacities (but keep visible)
    const opacityMultiplier = isDark ? 1 : 0.6;
    const base = baseOpacities[variant];

    return {
      sizes: sizes[variant],
      opacities: {
        primary: base.primary * opacityMultiplier,
        secondary: base.secondary * opacityMultiplier,
        tertiary: base.tertiary * opacityMultiplier,
      },
      colors: COLOR_SCHEMES[colorScheme],
    };
  }, [variant, colorScheme, isDark]);

  // Generate stable star positions
  const stars = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 5) % 100}%`,
      top: `${(i * 23 + 10) % 100}%`,
      delay: (i % 8) * 0.6,
      duration: 3 + (i % 5),
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Animated gradient orbs with parallax */}
      {showOrbs && (
        <>
          {/* Primary orb - top area near header */}
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{
              width: orbConfig.sizes.primary,
              height: orbConfig.sizes.primary,
              background: `radial-gradient(circle, rgba(${orbConfig.colors.primary}, ${orbConfig.opacities.primary * 1.4}) 0%, transparent 70%)`,
              top: "8%",
              left: "30%",
              y: y1,
            }}
            animate={{
              x: [0, 80, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Secondary orb - right area */}
          {orbCount >= 2 && (
            <motion.div
              className="absolute rounded-full blur-[100px]"
              style={{
                width: orbConfig.sizes.secondary,
                height: orbConfig.sizes.secondary,
                background: `radial-gradient(circle, rgba(${orbConfig.colors.secondary}, ${orbConfig.opacities.secondary}) 0%, transparent 70%)`,
                top: "40%",
                right: "10%",
                y: y2,
              }}
              animate={{
                x: [0, -60, 0],
                y: [0, 40, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* Tertiary orb - bottom area */}
          {orbCount >= 3 && (
            <motion.div
              className="absolute rounded-full blur-[80px]"
              style={{
                width: orbConfig.sizes.tertiary,
                height: orbConfig.sizes.tertiary,
                background: `radial-gradient(circle, rgba(${orbConfig.colors.tertiary}, ${orbConfig.opacities.tertiary}) 0%, transparent 70%)`,
                bottom: "15%",
                left: "30%",
                y: y3,
              }}
              animate={{
                x: [0, 50, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </>
      )}

      {/* Floating stars - only in dark mode */}
      {showStars && isDark && (
        <>
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: star.left,
                top: star.top,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.1, 0.4, 0.1],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
                delay: star.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

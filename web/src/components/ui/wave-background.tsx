import { cn } from "@/lib/utils";

type WaveSize = "hero" | "card" | "inline";
type WaveVariant = "warm" | "cool" | "classic";

interface WaveBackgroundProps {
  size?: WaveSize;
  variant?: WaveVariant;
  className?: string;
  /** Animation intensity: 0 = static, 1 = subtle, 2 = normal */
  intensity?: 0 | 1 | 2;
}

const SIZE_CONFIG: Record<WaveSize, { height: string; blur: string }> = {
  hero: { height: "h-64", blur: "blur-3xl" },
  card: { height: "h-32", blur: "blur-2xl" },
  inline: { height: "h-16", blur: "blur-xl" },
};

const VARIANT_COLORS: Record<
  WaveVariant,
  { wave1: string; wave2: string; wave3: string; center: string }
> = {
  warm: {
    wave1: "rgba(254, 237, 122, 0.35)",
    wave2: "rgba(255, 132, 0, 0.4)",
    wave3: "rgba(223, 145, 247, 0.3)",
    center: "rgba(255, 132, 0, 0.15)",
  },
  cool: {
    wave1: "rgba(223, 145, 247, 0.4)",
    wave2: "rgba(168, 85, 247, 0.35)",
    wave3: "rgba(139, 92, 246, 0.3)",
    center: "rgba(223, 145, 247, 0.15)",
  },
  classic: {
    wave1: "rgba(168, 85, 247, 0.4)",
    wave2: "rgba(6, 182, 212, 0.4)",
    wave3: "rgba(236, 72, 153, 0.35)",
    center: "rgba(168, 85, 247, 0.15)",
  },
};

/**
 * Animated wave background with gradient orbs.
 * Default variant uses warm yellow-orange-purple colors.
 *
 * @example
 * // Warm hero section background
 * <WaveBackground size="hero" variant="warm" className="absolute inset-0" />
 *
 * // AI processing state with classic colors
 * <WaveBackground size="card" variant="classic" intensity={2} />
 */
export function WaveBackground({
  size = "card",
  variant = "warm",
  className,
  intensity = 2,
}: WaveBackgroundProps) {
  const config = SIZE_CONFIG[size];
  const colors = VARIANT_COLORS[variant];
  const isAnimated = intensity > 0;
  const animationDuration = intensity === 1 ? "8s" : "4s";

  return (
    <div
      className={cn("relative overflow-hidden pointer-events-none", config.height, className)}
      aria-hidden="true"
    >
      {/* Primary wave */}
      <div
        className={cn("absolute inset-0 opacity-60", config.blur, isAnimated && "animate-wave-1")}
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${colors.wave1} 0%, transparent 70%)`,
          animationDuration,
        }}
      />

      {/* Secondary wave */}
      <div
        className={cn("absolute inset-0 opacity-50", config.blur, isAnimated && "animate-wave-2")}
        style={{
          background: `radial-gradient(ellipse 60% 40% at 30% 60%, ${colors.wave2} 0%, transparent 70%)`,
          animationDuration,
          animationDelay: "-1s",
        }}
      />

      {/* Tertiary wave */}
      <div
        className={cn("absolute inset-0 opacity-50", config.blur, isAnimated && "animate-wave-3")}
        style={{
          background: `radial-gradient(ellipse 70% 45% at 70% 40%, ${colors.wave3} 0%, transparent 70%)`,
          animationDuration,
          animationDelay: "-2s",
        }}
      />

      {/* Center glow */}
      <div
        className={cn("absolute inset-0", config.blur)}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colors.center} 0%, transparent 50%)`,
        }}
      />

      <style>{`
        @keyframes wave1 {
          0%, 100% {
            transform: translateX(0) translateY(0) scale(1);
          }
          25% {
            transform: translateX(5%) translateY(-5%) scale(1.05);
          }
          50% {
            transform: translateX(-3%) translateY(3%) scale(0.98);
          }
          75% {
            transform: translateX(-5%) translateY(-2%) scale(1.02);
          }
        }

        @keyframes wave2 {
          0%, 100% {
            transform: translateX(0) translateY(0) scale(1);
          }
          25% {
            transform: translateX(-4%) translateY(4%) scale(1.03);
          }
          50% {
            transform: translateX(5%) translateY(-3%) scale(0.97);
          }
          75% {
            transform: translateX(3%) translateY(5%) scale(1.04);
          }
        }

        @keyframes wave3 {
          0%, 100% {
            transform: translateX(0) translateY(0) scale(1);
          }
          25% {
            transform: translateX(3%) translateY(3%) scale(0.98);
          }
          50% {
            transform: translateX(-4%) translateY(-4%) scale(1.05);
          }
          75% {
            transform: translateX(-2%) translateY(4%) scale(1.01);
          }
        }

        .animate-wave-1 {
          animation: wave1 ease-in-out infinite;
        }

        .animate-wave-2 {
          animation: wave2 ease-in-out infinite;
        }

        .animate-wave-3 {
          animation: wave3 ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-wave-1,
          .animate-wave-2,
          .animate-wave-3 {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Compact wave animation for inline use (e.g., next to AI processing text).
 * Uses warm colors by default.
 */
export function WaveOrbs({
  className,
  variant = "warm",
}: {
  className?: string;
  variant?: WaveVariant;
}) {
  const colors = VARIANT_COLORS[variant];

  return (
    <div
      className={cn("relative w-12 h-12 flex items-center justify-center", className)}
      aria-hidden="true"
    >
      <div
        className="absolute w-8 h-8 rounded-full blur-md animate-wave-1"
        style={{
          background: `radial-gradient(circle, ${colors.wave1} 0%, transparent 70%)`,
          animationDuration: "3s",
        }}
      />
      <div
        className="absolute w-6 h-6 rounded-full blur-md animate-wave-2"
        style={{
          background: `radial-gradient(circle, ${colors.wave2} 0%, transparent 70%)`,
          animationDuration: "3s",
          animationDelay: "-1s",
        }}
      />
      <div
        className="absolute w-5 h-5 rounded-full blur-md animate-wave-3"
        style={{
          background: `radial-gradient(circle, ${colors.wave3} 0%, transparent 70%)`,
          animationDuration: "3s",
          animationDelay: "-2s",
        }}
      />
    </div>
  );
}

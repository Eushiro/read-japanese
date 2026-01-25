import { cn } from "@/lib/utils";

type AmbientVariant = "default" | "warm" | "cool" | "mixed";

interface AmbientBackgroundProps {
  variant?: AmbientVariant;
  className?: string;
  /** Opacity of the glow effects (0-1) */
  intensity?: number;
}

const VARIANT_CONFIG: Record<
  AmbientVariant,
  { orbs: Array<{ color: string; position: string; size: string }> }
> = {
  default: {
    orbs: [
      { color: "rgba(255, 132, 0, 0.12)", position: "top-0 right-1/4", size: "w-96 h-96" },
      { color: "rgba(223, 145, 247, 0.08)", position: "bottom-0 left-1/4", size: "w-80 h-80" },
    ],
  },
  warm: {
    orbs: [
      { color: "rgba(254, 237, 122, 0.1)", position: "top-1/4 left-1/3", size: "w-80 h-80" },
      { color: "rgba(255, 132, 0, 0.15)", position: "top-0 right-1/4", size: "w-96 h-96" },
      { color: "rgba(223, 145, 247, 0.1)", position: "bottom-1/4 right-1/3", size: "w-72 h-72" },
    ],
  },
  cool: {
    orbs: [
      { color: "rgba(223, 145, 247, 0.12)", position: "top-1/4 right-1/4", size: "w-96 h-96" },
      { color: "rgba(168, 85, 247, 0.08)", position: "bottom-1/3 left-1/4", size: "w-80 h-80" },
    ],
  },
  mixed: {
    orbs: [
      { color: "rgba(254, 237, 122, 0.08)", position: "top-0 left-1/4", size: "w-72 h-72" },
      { color: "rgba(255, 132, 0, 0.12)", position: "center", size: "w-96 h-96" },
      { color: "rgba(223, 145, 247, 0.1)", position: "bottom-0 right-1/4", size: "w-80 h-80" },
    ],
  },
};

/**
 * Ambient glow background with soft, blurred gradient orbs.
 * Creates a subtle lighting effect for hero sections and feature areas.
 *
 * @example
 * // Warm hero background
 * <AmbientBackground variant="warm" className="absolute inset-0" />
 *
 * // Subtle default background
 * <AmbientBackground intensity={0.5} />
 */
export function AmbientBackground({
  variant = "default",
  className,
  intensity = 1,
}: AmbientBackgroundProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
      style={{ opacity: intensity }}
    >
      {config.orbs.map((orb, index) => (
        <div
          key={index}
          className={cn("absolute rounded-full blur-3xl", orb.position, orb.size)}
          style={{ background: orb.color }}
        />
      ))}
    </div>
  );
}

/**
 * Animated ambient glow that subtly pulses.
 * Use sparingly for emphasis areas like CTAs.
 */
export function AnimatedAmbientGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 132, 0, 0.15) 0%, rgba(223, 145, 247, 0.05) 50%, transparent 70%)",
        }}
      />
    </div>
  );
}

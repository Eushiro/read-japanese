import { Loader2 } from "lucide-react";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";

interface RotatingLoaderProps {
  messages: string[];
  isActive: boolean;
  intervalMs?: number;
  /** Size of the loader container */
  size?: "sm" | "md" | "lg";
  /** Whether to show shimmer effect on text */
  shimmer?: boolean;
}

const sizeConfig = {
  sm: { container: "w-16 h-16", icon: "w-6 h-6", text: "text-sm" },
  md: { container: "w-24 h-24", icon: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-32 h-32", icon: "w-12 h-12", text: "text-lg" },
};

export function RotatingLoader({
  messages,
  isActive,
  intervalMs = 2500,
  size = "md",
  shimmer = false,
}: RotatingLoaderProps) {
  const currentMessage = useRotatingMessages(messages, isActive, intervalMs);
  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <div className={`${config.container} rounded-full bg-accent/10 flex items-center justify-center`}>
          <Loader2 className={`${config.icon} text-accent animate-spin`} />
        </div>
      </div>
      <p
        className={`${config.text} text-foreground-muted transition-opacity duration-300`}
        style={shimmer ? {
          background: 'linear-gradient(90deg, var(--foreground) 0%, var(--accent) 50%, var(--foreground) 100%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'shimmer 2s ease-in-out infinite',
        } : undefined}
      >
        {currentMessage}
      </p>
    </div>
  );
}

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { WaveBackground, WaveOrbs } from "./wave-background";

interface AIProcessingOverlayProps {
  /** Array of messages to cycle through */
  messages: string[];
  /** Size of the wave animation */
  size?: "small" | "medium" | "large";
  /** Whether to show a spinner icon */
  showSpinner?: boolean;
  /** Additional class name */
  className?: string;
  /** Message rotation interval in ms */
  rotationInterval?: number;
}

/**
 * AI Processing Overlay - A signature visual for "AI is working" states.
 * Combines the Siri-inspired wave animation with rotating messages.
 *
 * @example
 * <AIProcessingOverlay
 *   messages={[
 *     "Analyzing your pronunciation...",
 *     "Comparing with native speech...",
 *     "Generating feedback..."
 *   ]}
 *   size="medium"
 * />
 */
export function AIProcessingOverlay({
  messages,
  size = "medium",
  showSpinner = true,
  className,
  rotationInterval = 3000,
}: AIProcessingOverlayProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Rotate through messages
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        setIsTransitioning(false);
      }, 200);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [messages.length, rotationInterval]);

  const sizeConfig = {
    small: {
      waveSize: "inline" as const,
      textSize: "text-sm",
      spinnerSize: "w-4 h-4",
      padding: "p-4",
    },
    medium: {
      waveSize: "card" as const,
      textSize: "text-base",
      spinnerSize: "w-5 h-5",
      padding: "p-6",
    },
    large: {
      waveSize: "hero" as const,
      textSize: "text-lg",
      spinnerSize: "w-6 h-6",
      padding: "p-8",
    },
  };

  const config = sizeConfig[size];

  return (
    <div className={cn("relative overflow-hidden rounded-xl", config.padding, className)}>
      {/* Wave background */}
      <WaveBackground size={config.waveSize} intensity={2} className="absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-4">
        {/* Spinner or Wave Orbs */}
        {showSpinner ? (
          <div className="relative">
            <WaveOrbs className="opacity-50" />
            <Loader2
              className={cn(
                config.spinnerSize,
                "absolute inset-0 m-auto animate-spin text-purple-400"
              )}
            />
          </div>
        ) : (
          <WaveOrbs />
        )}

        {/* Message */}
        <p
          className={cn(
            config.textSize,
            "font-medium text-center transition-opacity duration-200",
            "dark:text-purple-100 text-purple-900",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
        >
          {messages[currentMessageIndex]}
        </p>
      </div>
    </div>
  );
}

/**
 * Compact inline AI processing indicator.
 * Use this for smaller loading states within cards or buttons.
 *
 * @example
 * <AIProcessingInline message="Generating..." />
 */
export function AIProcessingInline({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "bg-purple-500/10 dark:bg-purple-500/20",
        className
      )}
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
      <span className="text-sm font-medium text-purple-600 dark:text-purple-300">{message}</span>
    </div>
  );
}

/**
 * Full-page AI processing overlay with dark background.
 * Use for full-screen loading states like placement tests.
 *
 * @example
 * <AIProcessingFullscreen
 *   messages={["Analyzing your responses...", "Calculating your level..."]}
 * />
 */
export function AIProcessingFullscreen({
  messages,
  className,
}: {
  messages: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background/95 dark:bg-black/95 backdrop-blur-sm",
        className
      )}
    >
      <AIProcessingOverlay messages={messages} size="large" />
    </div>
  );
}

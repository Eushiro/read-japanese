import { cn } from "@/lib/utils";

type ContainerWidth = "narrow" | "default" | "wide" | "full";

interface WideContainerProps {
  children: React.ReactNode;
  width?: ContainerWidth;
  className?: string;
  as?: "div" | "section" | "article" | "main";
}

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  narrow: "max-w-2xl", // 672px - focused content like reading
  default: "max-w-5xl", // 1024px - standard pages
  wide: "max-w-6xl", // 1152px - grid-heavy pages
  full: "max-w-7xl", // 1280px - edge-to-edge with padding
} as const;

/**
 * WideContainer provides consistent max-width constraints for page content.
 * Use this to ensure pages use screen space effectively on larger displays.
 *
 * @example
 * // Dashboard with wider layout
 * <WideContainer width="wide">
 *   <DashboardContent />
 * </WideContainer>
 *
 * // Focused reading content
 * <WideContainer width="narrow">
 *   <StoryReader />
 * </WideContainer>
 */
export function WideContainer({
  children,
  width = "default",
  className,
  as: Component = "div",
}: WideContainerProps) {
  return (
    <Component className={cn("container mx-auto px-4 sm:px-6", WIDTH_CLASSES[width], className)}>
      {children}
    </Component>
  );
}

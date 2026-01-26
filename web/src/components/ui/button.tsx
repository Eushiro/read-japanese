import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Default: Glass with accent tint
        default: cn(
          "relative overflow-hidden bg-accent/90 border border-accent/50 text-white",
          "hover:bg-accent hover:border-accent/70",
          "hover:shadow-[0_0_25px_rgba(255,132,0,0.3)]",
          "dark:bg-accent/80 dark:border-accent/40 dark:text-white",
          "dark:hover:bg-accent/90 dark:hover:shadow-[0_0_30px_rgba(255,132,0,0.35)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
        ),
        // Secondary: Glass with neutral tint
        secondary: cn(
          "relative overflow-hidden bg-white/10 border border-white/20 text-foreground",
          "hover:bg-white/15 hover:border-white/30",
          "dark:bg-white/[0.08] dark:border-white/15",
          "dark:hover:bg-white/[0.12] dark:hover:border-white/25",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        ),
        // Destructive: Glass with red tint
        destructive: cn(
          "relative overflow-hidden bg-destructive/90 border border-destructive/50 text-white",
          "hover:bg-destructive hover:border-destructive/70",
          "hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
        ),
        // Outline: Glass border style
        outline: cn(
          "border border-border bg-surface/80 text-foreground",
          "hover:bg-muted/80 hover:border-foreground-muted/30",
          "dark:border-white/10 dark:bg-white/[0.03]",
          "dark:hover:bg-white/[0.06] dark:hover:border-white/20",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
        ),
        // Ghost: Minimal glass on hover
        ghost: cn(
          "text-foreground-muted hover:text-foreground",
          "hover:bg-white/[0.05] dark:hover:bg-white/[0.05]"
        ),
        // Link: Text only
        link: "text-accent underline-offset-4 hover:underline",
        // Glass accent variant with warm glow
        "glass-accent": cn(
          "relative overflow-hidden bg-orange-500/20 border border-orange-500/40",
          "hover:bg-orange-500/30 hover:border-orange-500/60",
          "hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]",
          "text-orange-600 dark:text-white transition-all duration-300"
        ),
        // Glass variant for toggle buttons (inactive state)
        glass: cn(
          "relative overflow-hidden bg-white/10 border border-white/20",
          "hover:bg-white/15 hover:border-white/30",
          "text-foreground-muted hover:text-foreground transition-all duration-300"
        ),
        // Glass active variant for toggle buttons (selected state)
        "glass-active": cn(
          "relative overflow-hidden bg-orange-500/20 border border-orange-500/40",
          "hover:bg-orange-500/30 hover:border-orange-500/60",
          "hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]",
          "text-orange-600 dark:text-white transition-all duration-300"
        ),
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-sm",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

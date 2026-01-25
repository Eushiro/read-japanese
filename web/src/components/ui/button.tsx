import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-sm hover:bg-accent-hover dark:text-black dark:hover:shadow-[0_0_30px_rgba(255,132,0,0.25)]",
        secondary: "bg-secondary text-white shadow-sm hover:bg-secondary-hover",
        destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-surface shadow-sm hover:bg-muted hover:border-foreground-muted/30 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-white/20",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-white/[0.05]",
        link: "text-accent underline-offset-4 hover:underline",
        // Warm variant for dark mode accents - subtle with glow on hover
        warm: cn(
          "bg-white/[0.03] border border-white/10 text-foreground",
          "hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,132,0,0.15)]",
          "transition-all duration-300"
        ),
        // AI gradient button with warm colors
        ai: "btn-ai shadow-sm hover:shadow-[0_0_20px_rgba(255,132,0,0.4)] dark:hover:shadow-[0_0_30px_rgba(255,132,0,0.5)]",
        // Glow variant for emphasis
        glow: "bg-orange-600 text-white shadow-sm hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 dark:hover:shadow-[0_0_25px_rgba(255,132,0,0.4)]",
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

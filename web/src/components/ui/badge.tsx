import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-sm",
        secondary:
          "bg-muted text-foreground",
        destructive:
          "bg-destructive text-white shadow-sm",
        outline:
          "border border-border text-foreground",
        // JLPT Level variants - refined palette
        n5: "bg-jlpt-n5 text-white shadow-sm",
        n4: "bg-jlpt-n4 text-white shadow-sm",
        n3: "bg-jlpt-n3 text-white shadow-sm",
        n2: "bg-jlpt-n2 text-white shadow-sm",
        n1: "bg-jlpt-n1 text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

import { cn } from "@/lib/utils";

interface PageSubheaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PageSubheader({ children, className }: PageSubheaderProps) {
  return (
    <div
      className={cn(
        "sticky top-16 z-30 backdrop-blur-2xl",
        "bg-white/60 dark:bg-black/40",
        className
      )}
    >
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarPosition?: "left" | "right";
  sidebarWidth?: "narrow" | "default" | "wide";
  stickyOffset?: string;
  className?: string;
}

const SIDEBAR_WIDTHS = {
  narrow: "w-48",
  default: "w-64",
  wide: "w-80",
} as const;

/**
 * SidebarLayout provides a consistent sidebar + main content pattern.
 * The sidebar is sticky on desktop and hidden on mobile.
 *
 * @example
 * <SidebarLayout
 *   sidebar={<NavigationMenu />}
 *   sidebarPosition="left"
 *   sidebarWidth="default"
 * >
 *   <MainContent />
 * </SidebarLayout>
 */
export function SidebarLayout({
  children,
  sidebar,
  sidebarPosition = "left",
  sidebarWidth = "default",
  stickyOffset = "top-24",
  className,
}: SidebarLayoutProps) {
  const widthClass = SIDEBAR_WIDTHS[sidebarWidth];

  const sidebarElement = (
    <aside
      className={cn("hidden lg:block shrink-0", widthClass, "sticky self-start", stickyOffset)}
    >
      {sidebar}
    </aside>
  );

  return (
    <div className={cn("flex gap-6", className)}>
      {sidebarPosition === "left" && sidebarElement}
      <main className="flex-1 min-w-0">{children}</main>
      {sidebarPosition === "right" && sidebarElement}
    </div>
  );
}

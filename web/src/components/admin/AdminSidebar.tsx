import { Link, useLocation } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronLeft,
  Clock,
  DollarSign,
  HardDrive,
  Layers,
  LayoutDashboard,
  Settings,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/videos", label: "Videos", icon: Video },
  { to: "/admin/stories", label: "Stories", icon: BookOpen },
  { to: "/admin/decks", label: "Decks", icon: Layers },
  { to: "/admin/jobs", label: "Jobs", icon: Clock },
  { to: "/admin/media", label: "Media", icon: HardDrive },
  { to: "/admin/ai-usage", label: "AI Usage", icon: DollarSign },
  { to: "/admin/config", label: "Config", icon: Settings },
];

export function AdminSidebar() {
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 min-h-screen border-r border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Link to="/admin" className="flex items-center gap-3 text-lg font-semibold text-foreground">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          Admin Panel
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-amber-500/10 text-amber-600"
                  : "text-foreground-muted hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className={cn("w-4 h-4", active && "text-amber-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="p-4 border-t border-border">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}

import { Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/admin";

import { api } from "../../../convex/_generated/api";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Query user profile for admin mode check
  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );
  const profileLoading = userProfile === undefined;

  // Allow access only if user is admin AND has admin mode enabled
  const canAccessAdmin = isAdmin(user?.email) && userProfile?.isAdminMode !== false;

  useEffect(() => {
    // Wait for auth and profile to load
    if (isLoading || profileLoading) return;

    // Redirect if not authenticated or admin mode is off
    if (!isAuthenticated || !canAccessAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, canAccessAdmin, isLoading, profileLoading, navigate]);

  // Show loading while checking auth or profile
  if (isLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  // Don't render admin content if not authorized
  if (!isAuthenticated || !canAccessAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

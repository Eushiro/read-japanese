import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/clerk-react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import type { AuthContextValue, AuthUser } from "@/lib/auth/types";

// Re-export types for convenience
export type { AuthUser as User } from "@/lib/auth/types";

// Re-export abstracted auth components
export { SignInButton, SignUpButton, UserMenu as UserButton } from "@/components/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const { isLoaded: authLoaded } = useClerkAuth();

  // Cache whether auth has ever been loaded to prevent flicker during navigation
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (isLoaded && authLoaded && !hasLoadedOnce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: one-time flag to prevent auth flicker
      setHasLoadedOnce(true);
    }
  }, [isLoaded, authLoaded, hasLoadedOnce]);

  const user: AuthUser | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
        displayName: clerkUser.fullName ?? clerkUser.firstName ?? null,
        photoURL: clerkUser.imageUrl ?? null,
      }
    : null;

  const signIn = () => {
    // Clerk handles sign-in through its components
    // This is a no-op; use SignInButton component instead
  };

  const signOut = async () => {
    await clerkSignOut();
  };

  const deleteAccount = async () => {
    if (clerkUser) {
      await clerkUser.delete();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        // Only show loading on initial load, not during navigation
        isLoading: !hasLoadedOnce && (!isLoaded || !authLoaded),
        isAuthenticated: !!isSignedIn,
        error: null,
        signIn,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import {
  useUser,
  useClerk,
  useAuth as useClerkAuth,
} from "@clerk/clerk-react";
import type { AuthUser, AuthContextValue } from "@/lib/auth/types";

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
  const hasLoadedOnce = useRef(false);
  if (isLoaded && authLoaded) {
    hasLoadedOnce.current = true;
  }

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
        isLoading: !hasLoadedOnce.current && (!isLoaded || !authLoaded),
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

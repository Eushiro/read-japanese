/**
 * Provider-agnostic auth interfaces
 *
 * These types allow switching between auth providers (Clerk, Auth0, Firebase, etc.)
 * without changing the rest of the application code.
 */

/**
 * Normalized user object from any auth provider
 */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Auth provider interface for implementing different auth backends
 */
export interface AuthProvider {
  /**
   * Get the current user, or null if not authenticated
   */
  getUser(): AuthUser | null;

  /**
   * Check if authentication is still loading
   */
  isLoading(): boolean;

  /**
   * Check if the user is authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Sign out the current user
   */
  signOut(): Promise<void>;

  /**
   * Delete the current user's account
   */
  deleteAccount(): Promise<void>;
}

/**
 * Auth context value exposed to the application
 */
export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

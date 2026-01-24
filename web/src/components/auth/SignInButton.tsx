import { SignInButton as ClerkSignInButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";

interface SignInButtonProps {
  children: ReactNode;
  mode?: "modal" | "redirect";
  redirectUrl?: string;
}

/**
 * Abstracted sign-in button that wraps the auth provider's implementation
 * Currently uses Clerk, but can be swapped to other providers
 */
export function SignInButton({ children, mode = "modal", redirectUrl }: SignInButtonProps) {
  return (
    <ClerkSignInButton mode={mode} forceRedirectUrl={redirectUrl}>
      {children}
    </ClerkSignInButton>
  );
}

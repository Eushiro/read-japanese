import { SignUpButton as ClerkSignUpButton } from "@clerk/clerk-react";
import type { ReactNode } from "react";

interface SignUpButtonProps {
  children: ReactNode;
  mode?: "modal" | "redirect";
  redirectUrl?: string;
}

/**
 * Abstracted sign-up button that wraps the auth provider's implementation
 * Currently uses Clerk, but can be swapped to other providers
 */
export function SignUpButton({ children, mode = "modal", redirectUrl }: SignUpButtonProps) {
  return (
    <ClerkSignUpButton mode={mode} forceRedirectUrl={redirectUrl}>
      {children}
    </ClerkSignUpButton>
  );
}

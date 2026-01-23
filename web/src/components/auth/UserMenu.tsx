import { UserButton as ClerkUserButton } from "@clerk/clerk-react";

interface UserMenuProps {
  afterSignOutUrl?: string;
  showName?: boolean;
}

/**
 * Abstracted user menu that wraps the auth provider's implementation
 * Currently uses Clerk's UserButton, but can be swapped to other providers
 */
export function UserMenu({
  afterSignOutUrl = "/",
  showName = false,
}: UserMenuProps) {
  return (
    <ClerkUserButton
      afterSignOutUrl={afterSignOutUrl}
      showName={showName}
      appearance={{
        elements: {
          avatarBox: "w-9 h-9",
        },
      }}
    />
  );
}

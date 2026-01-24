import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { LANGUAGES } from "@/lib/languages";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { user, isAuthenticated } = useAuth();

  const userProfile = useQuery(
    api.users.getByClerkId,
    isAuthenticated && user ? { clerkId: user.id } : "skip"
  );

  const setPrimaryLanguage = useMutation(api.users.setPrimaryLanguage);

  // Don't render if not authenticated or only one language
  if (!isAuthenticated || !userProfile || userProfile.languages.length <= 1) {
    return null;
  }

  const currentLanguage = LANGUAGES.find(
    (l) => l.value === userProfile.primaryLanguage
  );
  const userLanguages = LANGUAGES.filter((l) =>
    userProfile.languages.includes(l.value)
  );

  const handleLanguageChange = async (language: string) => {
    if (language === userProfile.primaryLanguage) return;
    try {
      await setPrimaryLanguage({
        clerkId: user!.id,
        language: language as "japanese" | "english" | "french",
      });
    } catch (error) {
      console.error("Failed to switch language:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors">
          <span className="text-base">{currentLanguage?.flag}</span>
          <ChevronDown className="w-3 h-3 text-foreground-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {userLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.value}
            onClick={() => handleLanguageChange(lang.value)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </span>
            {lang.value === userProfile.primaryLanguage && (
              <Check className="w-4 h-4 text-accent" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

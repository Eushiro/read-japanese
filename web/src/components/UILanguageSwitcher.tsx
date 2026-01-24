/**
 * UI Language Switcher Component
 * Allows users to change the display language of the interface
 * Separate from LanguageSwitcher which is for selecting learning languages
 */

import { Globe } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UI_LANGUAGES, type UILanguage,useUILanguage } from "@/lib/i18n";

interface UILanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function UILanguageSwitcher({ className, showLabel = true }: UILanguageSwitcherProps) {
  const { language, setLanguage, isChanging } = useUILanguage();

  return (
    <div className={className}>
      <Select
        value={language}
        onValueChange={(value) => setLanguage(value as UILanguage)}
        disabled={isChanging}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-foreground-muted" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {UI_LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              <span className="mr-2">{lang.flag}</span>
              {showLabel ? lang.label : lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Compact version for footer or navbar
 */
export function UILanguageSwitcherCompact({ className }: { className?: string }) {
  const { language, setLanguage, isChanging } = useUILanguage();
  const currentLang = UI_LANGUAGES.find((l) => l.value === language);

  return (
    <Select
      value={language}
      onValueChange={(value) => setLanguage(value as UILanguage)}
      disabled={isChanging}
    >
      <SelectTrigger className={`w-auto gap-1.5 ${className}`}>
        <Globe className="w-4 h-4" />
        <span>{currentLang?.flag}</span>
      </SelectTrigger>
      <SelectContent>
        {UI_LANGUAGES.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            <span className="mr-2">{lang.flag}</span>
            {lang.nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { GraduationCap, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ContentLanguage, LANGUAGES } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

interface PlacementTestPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  language: ContentLanguage;
  onSkip: () => void;
}

export function PlacementTestPromptDialog({
  isOpen,
  onClose,
  language,
  onSkip,
}: PlacementTestPromptDialogProps) {
  const navigate = useNavigate();
  const t = useT();

  const languageInfo = LANGUAGES.find((l) => l.value === language);
  const languageName = languageInfo ? t(`common.languages.${language}`) : language;

  // Determine beginner level based on language
  const beginnerLevel = language === "japanese" ? "N5" : "A1";

  const handleTakeTest = () => {
    onClose();
    navigate({ to: "/placement-test", search: { language } });
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-surface max-w-md p-6 sm:p-8 rounded-2xl border-border">
        <DialogHeader className="text-center space-y-4">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Target className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>

          {/* Title */}
          <DialogTitle
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("placement.prompt.title", { language: languageName })}
          </DialogTitle>

          {/* Description */}
          <DialogDescription className="text-foreground-muted">
            {t("placement.prompt.description")}
          </DialogDescription>
        </DialogHeader>

        {/* Skip info */}
        <div className="bg-muted/50 rounded-lg p-3 mt-2 text-center">
          <p className="text-sm text-foreground-muted">
            {t("placement.prompt.skipInfo", { level: beginnerLevel })}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 mt-4">
          <Button onClick={handleTakeTest} className="w-full gap-2" size="lg">
            <GraduationCap className="w-5 h-5" />
            {t("placement.prompt.takeTest")}
          </Button>
          <Button variant="outline" onClick={handleSkip} className="w-full">
            {t("placement.prompt.skip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

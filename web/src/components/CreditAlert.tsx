import { Link } from "@tanstack/react-router";
import { AlertCircle, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCreditAlerts } from "@/hooks/useCreditAlerts";
import { useT } from "@/lib/i18n";

/**
 * Credit usage alert component
 * Shows warnings at 80% and 95% usage on the Dashboard only
 * Alerts are dismissable once per month
 */
export function CreditAlert() {
  const t = useT();
  const { shouldShowAlert80, shouldShowAlert95, dismissAlert } = useCreditAlerts();

  // Show 95% alert (critical) - highest priority
  if (shouldShowAlert95) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("credits.alert.critical.title")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            {t("credits.alert.critical.message")}
            <Link to="/pricing" className="ml-2 font-medium underline">
              {t("credits.alert.upgrade")}
            </Link>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => dismissAlert(95)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Show 80% alert (warning)
  if (shouldShowAlert80) {
    return (
      <Alert variant="warning" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("credits.alert.warning.title")}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            {t("credits.alert.warning.message")}
            <Link to="/pricing" className="ml-2 underline">
              {t("credits.alert.upgrade")}
            </Link>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => dismissAlert(80)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

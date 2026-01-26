import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function NotFoundPage() {
  const t = useT();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-16">
      <div className="container mx-auto px-4 sm:px-6 max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-accent/10 dark:bg-white/5 flex items-center justify-center">
          <FileQuestion className="w-10 h-10 text-accent dark:text-white/60" />
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold text-foreground mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("common.notFound.title")}
        </h1>

        <p className="text-foreground-muted mb-8">{t("common.notFound.message")}</p>

        <Link to="/dashboard">
          <Button variant="default" size="lg">
            {t("common.notFound.backHome")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

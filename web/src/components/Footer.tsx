import { Link } from "@tanstack/react-router";

import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();

  return (
    <footer className="bg-transparent py-10">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>{t("landing.footer.tagline")}</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t("landing.footer.privacy")}
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t("landing.footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

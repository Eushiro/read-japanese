import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

const LAST_UPDATED = new Date(2026, 0, 1); // January 2026

export function TermsPage() {
  const { t, i18n } = useTranslation("legal");

  const formattedDate = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
  }).format(LAST_UPDATED);

  const accountsItems = t("terms.sections.accounts.items", { returnObjects: true }) as string[];
  const billingItems = t("terms.sections.billing.items", { returnObjects: true }) as string[];
  const acceptableUseItems = t("terms.sections.acceptableUse.items", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen py-8 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("backToHome")}
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("terms.title")}
            </h1>
            <p className="text-foreground-muted text-sm">{t("lastUpdated", { date: formattedDate })}</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.acceptance.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.acceptance.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.description.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.description.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.accounts.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("terms.sections.accounts.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {accountsItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.billing.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("terms.sections.billing.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {billingItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.acceptableUse.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("terms.sections.acceptableUse.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {acceptableUseItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.aiContent.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.aiContent.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("terms.sections.ip.title")}</h2>
            <p className="text-foreground-muted">{t("terms.sections.ip.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.userContent.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.userContent.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.disclaimer.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.disclaimer.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.liability.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.liability.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.changes.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.changes.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("terms.sections.termination.title")}
            </h2>
            <p className="text-foreground-muted">{t("terms.sections.termination.content")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

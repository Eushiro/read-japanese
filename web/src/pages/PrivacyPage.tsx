import { Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

type DataSharingItem = { name: string; desc: string };

const LAST_UPDATED = new Date(2026, 0, 1); // January 2026

export function PrivacyPage() {
  const { t, i18n } = useTranslation("legal");

  const formattedDate = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
  }).format(LAST_UPDATED);

  const infoCollectItems = t("privacy.sections.infoCollect.items", { returnObjects: true }) as string[];
  const howWeUseItems = t("privacy.sections.howWeUse.items", { returnObjects: true }) as string[];
  const aiProcessingItems = t("privacy.sections.aiProcessing.items", { returnObjects: true }) as string[];
  const dataSharingItems = t("privacy.sections.dataSharing.items", {
    returnObjects: true,
  }) as DataSharingItem[];
  const yourRightsItems = t("privacy.sections.yourRights.items", { returnObjects: true }) as string[];

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
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("privacy.title")}
            </h1>
            <p className="text-foreground-muted text-sm">{t("lastUpdated", { date: formattedDate })}</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.infoCollect.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("privacy.sections.infoCollect.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {infoCollectItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.howWeUse.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("privacy.sections.howWeUse.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {howWeUseItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.aiProcessing.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("privacy.sections.aiProcessing.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {aiProcessingItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="text-foreground-muted mt-4">{t("privacy.sections.aiProcessing.footer")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.dataSharing.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("privacy.sections.dataSharing.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {dataSharingItems.map((item, i) => (
                <li key={i}>
                  <strong>{item.name}</strong> - {item.desc}
                </li>
              ))}
            </ul>
            <p className="text-foreground-muted mt-4">{t("privacy.sections.dataSharing.footer")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.dataRetention.title")}
            </h2>
            <p className="text-foreground-muted">{t("privacy.sections.dataRetention.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.security.title")}
            </h2>
            <p className="text-foreground-muted">{t("privacy.sections.security.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.yourRights.title")}
            </h2>
            <p className="text-foreground-muted mb-4">{t("privacy.sections.yourRights.intro")}</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {yourRightsItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.cookies.title")}
            </h2>
            <p className="text-foreground-muted">{t("privacy.sections.cookies.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("privacy.sections.changes.title")}
            </h2>
            <p className="text-foreground-muted">{t("privacy.sections.changes.content")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

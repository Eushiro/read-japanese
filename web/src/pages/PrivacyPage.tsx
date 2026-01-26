import { Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/lib/i18n";

type DataSharingItem = { name: string; desc: string };

const LAST_UPDATED = new Date(2026, 0, 1); // January 2026

export function PrivacyPage() {
  const t = useT();
  const i18n = useI18n();

  const formattedDate = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
  }).format(LAST_UPDATED);

  const infoCollectItems = t<string[]>("legal.privacy.sections.infoCollect.items", {
    returnObjects: true,
  });
  const howWeUseItems = t<string[]>("legal.privacy.sections.howWeUse.items", {
    returnObjects: true,
  });
  const aiProcessingItems = t<string[]>("legal.privacy.sections.aiProcessing.items", {
    returnObjects: true,
  });
  const dataSharingItems = t<DataSharingItem[]>("legal.privacy.sections.dataSharing.items", {
    returnObjects: true,
  });
  const yourRightsItems = t<string[]>("legal.privacy.sections.yourRights.items", {
    returnObjects: true,
  });

  return (
    <div className="min-h-screen py-8 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("legal.backToHome")}
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
              {t("legal.privacy.title")}
            </h1>
            <p className="text-foreground-muted text-sm">
              {t("legal.lastUpdated", { date: formattedDate })}
            </p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.infoCollect.title")}
            </h2>
            <p className="text-foreground-muted mb-4">
              {t("legal.privacy.sections.infoCollect.intro")}
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {infoCollectItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.howWeUse.title")}
            </h2>
            <p className="text-foreground-muted mb-4">
              {t("legal.privacy.sections.howWeUse.intro")}
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {howWeUseItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.aiProcessing.title")}
            </h2>
            <p className="text-foreground-muted mb-4">
              {t("legal.privacy.sections.aiProcessing.intro")}
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {aiProcessingItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="text-foreground-muted mt-4">
              {t("legal.privacy.sections.aiProcessing.footer")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.dataSharing.title")}
            </h2>
            <p className="text-foreground-muted mb-4">
              {t("legal.privacy.sections.dataSharing.intro")}
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {dataSharingItems.map((item, i) => (
                <li key={i}>
                  <strong>{item.name}</strong> - {item.desc}
                </li>
              ))}
            </ul>
            <p className="text-foreground-muted mt-4">
              {t("legal.privacy.sections.dataSharing.footer")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.dataRetention.title")}
            </h2>
            <p className="text-foreground-muted">
              {t("legal.privacy.sections.dataRetention.content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.security.title")}
            </h2>
            <p className="text-foreground-muted">{t("legal.privacy.sections.security.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.yourRights.title")}
            </h2>
            <p className="text-foreground-muted mb-4">
              {t("legal.privacy.sections.yourRights.intro")}
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              {yourRightsItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.cookies.title")}
            </h2>
            <p className="text-foreground-muted">{t("legal.privacy.sections.cookies.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t("legal.privacy.sections.changes.title")}
            </h2>
            <p className="text-foreground-muted">{t("legal.privacy.sections.changes.content")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

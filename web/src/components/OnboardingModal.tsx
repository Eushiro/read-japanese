import { useAction, useMutation } from "convex/react";
import {
  BookmarkCheck,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Globe,
  GraduationCap,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import { useT } from "@/lib/i18n";
import { detectTargetLanguage, EXAMS_BY_LANGUAGE, type Language, LANGUAGES } from "@/lib/languages";

import { api } from "../../convex/_generated/api";

interface OnboardingModalProps {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  onComplete: () => void;
}

export function OnboardingModal({ userId, userEmail, userName, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTime = useRef(Date.now());
  const t = useT();

  const upsertUser = useMutation(api.users.upsert);
  const ensureStripeCustomer = useAction(api.stripe.ensureStripeCustomer);
  const { trackEvent, events } = useAnalytics();
  const hasTrackedOnboardingRef = useRef(false);

  // Track onboarding started
  useEffect(() => {
    if (hasTrackedOnboardingRef.current) return;
    hasTrackedOnboardingRef.current = true;
    trackEvent(events.ONBOARDING_STARTED, {
      user_id: userId,
    });
  }, [trackEvent, events, userId]);

  // Pre-select detected language on mount
  useEffect(() => {
    const detected = detectTargetLanguage();
    setSelectedLanguages([detected]);
  }, []);

  const handleLanguageToggle = (lang: Language) => {
    const isRemoving = selectedLanguages.includes(lang);
    setSelectedLanguages((prev) => (isRemoving ? prev.filter((l) => l !== lang) : [...prev, lang]));
    if (!isRemoving) {
      trackEvent(events.ONBOARDING_LANGUAGE_SELECTED, { language: lang });
    }
  };

  const handleExamToggle = (exam: string) => {
    const isRemoving = selectedExams.includes(exam);
    setSelectedExams((prev) => (isRemoving ? prev.filter((e) => e !== exam) : [...prev, exam]));
    if (!isRemoving) {
      trackEvent(events.ONBOARDING_EXAM_SELECTED, { exam });
    }
  };

  const handleComplete = async () => {
    if (selectedLanguages.length === 0) return;

    setIsSubmitting(true);
    try {
      await upsertUser({
        clerkId: userId,
        email: userEmail ?? undefined,
        name: userName ?? undefined,
        languages: selectedLanguages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- selectedExams values come from EXAMS_BY_LANGUAGE
        targetExams: selectedExams as any,
        primaryLanguage: selectedLanguages[0],
      });

      // Pre-create Stripe customer in background for faster checkout later
      // Don't await - let it run in background so onboarding completes immediately
      ensureStripeCustomer({
        userId,
        email: userEmail ?? undefined,
      }).catch((err) => console.error("Failed to pre-create Stripe customer:", err));

      trackEvent(events.ONBOARDING_COMPLETED, {
        selected_languages: selectedLanguages,
        selected_exams: selectedExams,
        duration_seconds: Math.round((Date.now() - startTime.current) / 1000),
      });

      onComplete();
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in-up">
        {/* Progress indicator */}
        <div className="flex gap-1 p-4 bg-muted/30">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-blue-500/20" />
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-purple-500/25 rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/25 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-green-500/20 rounded-full blur-3xl" />
            <div className="relative p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h2
                className="text-2xl font-bold text-foreground mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("onboarding.welcome.title")}
              </h2>
              <p className="text-foreground mb-8">{t("onboarding.welcome.subtitle")}</p>
              <Button onClick={() => setStep(1)} className="w-full gap-2" size="lg">
                {t("onboarding.welcome.getStarted")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: How It Works - The Learning Loop */}
        {step === 1 && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-blue-500/20" />
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-purple-500/25 rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/25 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-green-500/20 rounded-full blur-3xl" />
            <div className="relative p-8">
              <h2
                className="text-xl font-bold text-foreground mb-2 text-center"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("onboarding.howItWorks.title")}
              </h2>
              <p className="text-foreground mb-6 text-center">
                {t("onboarding.howItWorks.subtitle")}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 rounded-xl border border-blue-500/20 p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {t("onboarding.howItWorks.steps.read.title")}
                  </div>
                  <div className="text-xs text-foreground/80">
                    {t("onboarding.howItWorks.steps.read.description")}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 rounded-xl border border-amber-500/20 p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
                    <BookmarkCheck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {t("onboarding.howItWorks.steps.save.title")}
                  </div>
                  <div className="text-xs text-foreground/80">
                    {t("onboarding.howItWorks.steps.save.description")}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/15 to-purple-500/5 rounded-xl border border-purple-500/20 p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {t("onboarding.howItWorks.steps.review.title")}
                  </div>
                  <div className="text-xs text-foreground/80">
                    {t("onboarding.howItWorks.steps.review.description")}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/15 to-green-500/5 rounded-xl border border-green-500/20 p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                    <PenLine className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {t("onboarding.howItWorks.steps.practice.title")}
                  </div>
                  <div className="text-xs text-foreground/80">
                    {t("onboarding.howItWorks.steps.practice.description")}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  {t("onboarding.actions.back")}
                </Button>
                <Button onClick={() => setStep(2)} className="flex-1 gap-2">
                  {t("onboarding.actions.continue")}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Language Selection */}
        {step === 2 && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-green-500/10" />
            <div className="absolute top-0 right-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-24 h-24 bg-green-500/10 rounded-full blur-3xl" />
            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-accent" />
                <h2
                  className="text-xl font-bold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("onboarding.languageSelection.title")}
                </h2>
              </div>
              <p className="text-foreground mb-6">{t("onboarding.languageSelection.subtitle")}</p>

              <div className="space-y-3 mb-8">
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguages.includes(lang.value);
                  return (
                    <button
                      key={lang.value}
                      onClick={() => handleLanguageToggle(lang.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-foreground-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{lang.flag}</span>
                          <div>
                            <div className="font-medium text-foreground">{lang.label}</div>
                            <div className="text-sm text-foreground-muted">{lang.nativeName}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  {t("onboarding.actions.back")}
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={selectedLanguages.length === 0}
                  className="flex-1 gap-2"
                >
                  {t("onboarding.actions.continue")}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Exam Selection */}
        {step === 3 && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10" />
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-orange-500/10 rounded-full blur-3xl" />
            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="w-5 h-5 text-accent" />
                <h2
                  className="text-xl font-bold text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("onboarding.examSelection.title")}
                </h2>
              </div>
              <p className="text-foreground mb-6">{t("onboarding.examSelection.subtitle")}</p>

              <div className="space-y-6 mb-8 max-h-96 overflow-y-auto">
                {selectedLanguages.map((lang) => {
                  const langInfo = LANGUAGES.find((l) => l.value === lang);
                  const exams = EXAMS_BY_LANGUAGE[lang] || [];

                  return (
                    <div key={lang}>
                      <div className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
                        <span>{langInfo?.flag}</span>
                        {langInfo?.label}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {exams.map((exam) => {
                          const isSelected = selectedExams.includes(exam.value);
                          return (
                            <button
                              key={exam.value}
                              onClick={() => handleExamToggle(exam.value)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? "border-accent bg-accent/5"
                                  : "border-border hover:border-foreground-muted"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-foreground text-sm">
                                    {exam.label}
                                  </div>
                                  <div className="text-xs text-foreground-muted">
                                    {exam.description}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-accent" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  {t("onboarding.actions.back")}
                </Button>
                <Button onClick={handleComplete} disabled={isSubmitting} className="flex-1 gap-2">
                  {isSubmitting
                    ? t("onboarding.actions.saving")
                    : t("onboarding.actions.startLearning")}
                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>

              {selectedExams.length === 0 && (
                <button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="w-full mt-3 text-sm text-foreground-muted hover:text-foreground transition-colors"
                >
                  {t("onboarding.examSelection.skipForNow")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

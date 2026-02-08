import { useNavigate } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import {
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Compass,
  Globe,
  GraduationCap,
  Plane,
  Sparkles,
  Target,
  Tv,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnalytics } from "@/contexts/AnalyticsContext";
import {
  type ContentLanguage,
  detectTargetLanguage,
  EXAMS_BY_LANGUAGE,
  LANGUAGES,
} from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";
import type { LearningGoal } from "../../convex/schema";

// Interest options
const INTEREST_OPTIONS = [
  "food",
  "sports",
  "technology",
  "nature",
  "relationships",
  "business",
  "popCulture",
  "history",
  "music",
  "art",
  "gaming",
  "science",
] as const;

// Goal icons mapping
const GOAL_ICONS = {
  exam: GraduationCap,
  travel: Plane,
  professional: Briefcase,
  media: Tv,
  casual: Compass,
};

interface OnboardingModalProps {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  onComplete: (learningGoal: LearningGoal) => void;
}

export function OnboardingModal({ userId, userEmail, userName, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<ContentLanguage | null>(null);
  const [_selectedLevel, _setSelectedLevel] = useState<
    "complete_beginner" | "some_basics" | "intermediate" | "advanced"
  >("complete_beginner");
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTime = useRef(Date.now());
  const t = useT();
  const navigate = useNavigate();

  const upsertUser = useMutation(api.users.upsert);
  const ensureStripeCustomer = useAction(api.stripe.ensureStripeCustomer);
  const { trackEvent, events } = useAnalytics();
  const hasTrackedOnboardingRef = useRef(false);

  // Calculate total steps based on goal selection
  // If exam goal, show exam selection. Otherwise skip it.
  // All paths end with adaptive learning intro step.
  const getTotalSteps = () => {
    if (selectedGoal === "exam") {
      return 8; // Welcome, HowItWorks, Language, LevelAssessment, Goal, Interests, Exam, AdaptiveIntro
    }
    return 7; // Welcome, HowItWorks, Language, LevelAssessment, Goal, Interests, AdaptiveIntro
  };

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
    setSelectedLanguage(detected);
  }, []);

  const handleLanguageSelect = (lang: ContentLanguage) => {
    setSelectedLanguage(lang);
    trackEvent(events.ONBOARDING_LANGUAGE_SELECTED, { language: lang });
    // Clear exams when language changes since exams are language-specific
    setSelectedExams([]);
  };

  const handleGoalSelect = (goal: LearningGoal) => {
    setSelectedGoal(goal);
    trackEvent(events.ONBOARDING_GOAL_SELECTED, { goal });
    // Clear exams if switching away from exam goal
    if (goal !== "exam") {
      setSelectedExams([]);
    }
  };

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleExamToggle = (exam: string) => {
    const isRemoving = selectedExams.includes(exam);
    setSelectedExams((prev) => (isRemoving ? prev.filter((e) => e !== exam) : [...prev, exam]));
    if (!isRemoving) {
      trackEvent(events.ONBOARDING_EXAM_SELECTED, { exam });
    }
  };

  const handleComplete = async () => {
    if (!selectedLanguage || !selectedGoal) return;

    setIsSubmitting(true);
    try {
      await upsertUser({
        clerkId: userId,
        email: userEmail ?? undefined,
        name: userName ?? undefined,
        languages: [selectedLanguage],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- selectedExams values come from EXAMS_BY_LANGUAGE
        targetExams: selectedExams as any,
        learningGoal: selectedGoal,
        interests: selectedInterests,
      });

      // Pre-create Stripe customer in background for faster checkout later
      // Don't await - let it run in background so onboarding completes immediately
      ensureStripeCustomer({
        userId,
        email: userEmail ?? undefined,
      }).catch((err) => console.error("Failed to pre-create Stripe customer:", err));

      trackEvent(events.ONBOARDING_COMPLETED, {
        selected_languages: [selectedLanguage],
        selected_goal: selectedGoal,
        selected_interests: selectedInterests,
        selected_exams: selectedExams,
        duration_seconds: Math.round((Date.now() - startTime.current) / 1000),
      });

      onComplete(selectedGoal);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle step navigation with conditional exam step
  const handleNextStep = () => {
    if (step === 5) {
      // After interests step
      if (selectedGoal === "exam") {
        setStep(6); // Go to exam selection
      } else {
        setStep(6); // Go to adaptive intro (non-exam path)
      }
    } else if (step === 6 && selectedGoal === "exam") {
      setStep(7); // After exam selection, go to adaptive intro
    } else {
      setStep(step + 1);
    }
  };

  // Handle starting adaptive practice (replaces placement test)
  const handleStartPractice = async () => {
    await handleComplete(); // Save user data first
    navigate({ to: "/adaptive-practice" });
  };

  // Handle skipping to dashboard
  const handleSkipToDashboard = async () => {
    await handleComplete();
    // onComplete callback will navigate to dashboard
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="bg-surface max-w-lg p-0 rounded-2xl border-0 overflow-hidden outline-none"
        showCloseButton={false}
      >
        {/* Progress indicator */}
        <div className="flex gap-1 p-4 bg-muted/30">
          {Array.from({ length: getTotalSteps() }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <ScrollArea className="max-h-[calc(90vh-60px)]">
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
                      <Compass className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {t("onboarding.howItWorks.steps.discover.title")}
                    </div>
                    <div className="text-xs text-foreground/80">
                      {t("onboarding.howItWorks.steps.discover.description")}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 rounded-xl border border-amber-500/20 p-4 text-center">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
                      <BookOpen className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {t("onboarding.howItWorks.steps.learn.title")}
                    </div>
                    <div className="text-xs text-foreground/80">
                      {t("onboarding.howItWorks.steps.learn.description")}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/15 to-purple-500/5 rounded-xl border border-purple-500/20 p-4 text-center">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {t("onboarding.howItWorks.steps.practice.title")}
                    </div>
                    <div className="text-xs text-foreground/80">
                      {t("onboarding.howItWorks.steps.practice.description")}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/15 to-green-500/5 rounded-xl border border-green-500/20 p-4 text-center">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                      <Target className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {t("onboarding.howItWorks.steps.master.title")}
                    </div>
                    <div className="text-xs text-foreground/80">
                      {t("onboarding.howItWorks.steps.master.description")}
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

                <RadioGroup
                  value={selectedLanguage ?? undefined}
                  onValueChange={(value) => handleLanguageSelect(value as ContentLanguage)}
                  className="space-y-3 mb-8"
                >
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguage === lang.value;
                    return (
                      <label
                        key={lang.value}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-foreground-muted"
                        }`}
                      >
                        <RadioGroupItem value={lang.value} id={lang.value} />
                        <div>
                          <div className="font-medium text-foreground">
                            {t(`common.languages.${lang.value}`)}
                          </div>
                          <div className="text-sm text-foreground-muted">{lang.nativeName}</div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    {t("onboarding.actions.back")}
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!selectedLanguage}
                    className="flex-1 gap-2"
                  >
                    {t("onboarding.actions.continue")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Goal Selection */}
          {step === 3 && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-orange-500/10" />
              <div className="absolute top-0 left-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="relative p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Compass className="w-5 h-5 text-accent" />
                  <h2
                    className="text-xl font-bold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("onboarding.goalSelection.title")}
                  </h2>
                </div>
                <p className="text-foreground mb-6">{t("onboarding.goalSelection.subtitle")}</p>

                <div className="space-y-3 mb-8">
                  {(["exam", "travel", "professional", "media", "casual"] as const).map((goal) => {
                    const isSelected = selectedGoal === goal;
                    const Icon = GOAL_ICONS[goal];
                    return (
                      <button
                        key={goal}
                        onClick={() => handleGoalSelect(goal)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-foreground-muted"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-accent/20" : "bg-muted"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${isSelected ? "text-accent" : "text-foreground-muted"}`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {t(`onboarding.goalSelection.goals.${goal}.label`)}
                          </div>
                          <div className="text-sm text-foreground-muted">
                            {t(`onboarding.goalSelection.goals.${goal}.description`)}
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-accent" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    {t("onboarding.actions.back")}
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    disabled={!selectedGoal}
                    className="flex-1 gap-2"
                  >
                    {t("onboarding.actions.continue")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Interest Selection */}
          {step === 4 && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-blue-500/10" />
              <div className="absolute top-0 right-1/4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="relative p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h2
                    className="text-xl font-bold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t("onboarding.interestSelection.title")}
                  </h2>
                </div>
                <p className="text-foreground mb-6">{t("onboarding.interestSelection.subtitle")}</p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {INTEREST_OPTIONS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => handleInterestToggle(interest)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border hover:border-foreground-muted text-foreground-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {t(`onboarding.interestSelection.interests.${interest}`)}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-accent" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedInterests.length < 3 && (
                  <p className="text-sm text-foreground-muted text-center mb-4">
                    {t("onboarding.interestSelection.minSelection")}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                    {t("onboarding.actions.back")}
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={selectedInterests.length < 3}
                    className="flex-1 gap-2"
                  >
                    {t("onboarding.actions.continue")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Exam Selection (only for exam goal) */}
          {step === 5 && selectedLanguage && selectedGoal === "exam" && (
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

                <div className="space-y-6 mb-8">
                  {(() => {
                    const langInfo = LANGUAGES.find((l) => l.value === selectedLanguage);
                    const exams = EXAMS_BY_LANGUAGE[selectedLanguage] || [];

                    return (
                      <div>
                        <div className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
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
                                      {t(`common.levels.${exam.descriptionKey}`)}
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
                  })()}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(4)} className="flex-1">
                    {t("onboarding.actions.back")}
                  </Button>
                  <Button onClick={handleNextStep} className="flex-1 gap-2">
                    {t("onboarding.actions.continue")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {selectedExams.length === 0 && (
                  <button
                    onClick={handleNextStep}
                    className="w-full mt-3 text-sm text-foreground-muted hover:text-foreground transition-colors"
                  >
                    {t("onboarding.examSelection.skipForNow")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Adaptive Learning Intro Step (final step for all paths) */}
          {((step === 5 && selectedGoal !== "exam") || (step === 6 && selectedGoal === "exam")) && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-teal-500/10" />
              <div className="absolute top-0 right-1/4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/4 w-24 h-24 bg-teal-500/10 rounded-full blur-3xl" />
              <div className="relative p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-green-400" />
                </div>
                <h2
                  className="text-2xl font-bold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {t("onboarding.adaptiveIntro.title")}
                </h2>
                <p className="text-foreground mb-6">{t("onboarding.adaptiveIntro.subtitle")}</p>

                <div className="space-y-3 mb-6 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-foreground">
                      {t("onboarding.adaptiveIntro.benefit1")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-foreground">
                      {t("onboarding.adaptiveIntro.benefit2")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-foreground">
                      {t("onboarding.adaptiveIntro.benefit3")}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleStartPractice}
                  disabled={isSubmitting}
                  className="w-full gap-2 mb-3"
                  size="lg"
                >
                  {isSubmitting
                    ? t("onboarding.actions.saving")
                    : t("onboarding.adaptiveIntro.startPractice")}
                  {!isSubmitting && <ChevronRight className="w-4 h-4" />}
                </Button>

                <button
                  onClick={handleSkipToDashboard}
                  disabled={isSubmitting}
                  className="w-full text-sm text-foreground-muted hover:text-foreground transition-colors"
                >
                  {t("onboarding.adaptiveIntro.skipForNow")}
                </button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

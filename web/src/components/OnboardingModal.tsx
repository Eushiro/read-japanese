import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Globe, GraduationCap, Sparkles, BookOpen, BookmarkCheck, Brain, PenLine } from "lucide-react";

// Language options
const LANGUAGES = [
  { value: "japanese", label: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  { value: "english", label: "English", flag: "🇬🇧", nativeName: "English" },
  { value: "french", label: "French", flag: "🇫🇷", nativeName: "Français" },
] as const;

const EXAMS_BY_LANGUAGE = {
  japanese: [
    { value: "jlpt_n5", label: "JLPT N5", description: "Beginner" },
    { value: "jlpt_n4", label: "JLPT N4", description: "Elementary" },
    { value: "jlpt_n3", label: "JLPT N3", description: "Intermediate" },
    { value: "jlpt_n2", label: "JLPT N2", description: "Upper Intermediate" },
    { value: "jlpt_n1", label: "JLPT N1", description: "Advanced" },
  ],
  english: [
    { value: "toefl", label: "TOEFL", description: "Academic English" },
    { value: "sat", label: "SAT", description: "College Admission" },
    { value: "gre", label: "GRE", description: "Graduate School" },
  ],
  french: [
    { value: "delf_a1", label: "DELF A1", description: "Beginner" },
    { value: "delf_a2", label: "DELF A2", description: "Elementary" },
    { value: "delf_b1", label: "DELF B1", description: "Intermediate" },
    { value: "delf_b2", label: "DELF B2", description: "Upper Intermediate" },
    { value: "dalf_c1", label: "DALF C1", description: "Advanced" },
    { value: "dalf_c2", label: "DALF C2", description: "Mastery" },
    { value: "tcf", label: "TCF", description: "General Proficiency" },
  ],
} as const;

type Language = typeof LANGUAGES[number]["value"];

interface OnboardingModalProps {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  onComplete: () => void;
}

// Detect user's likely target language based on browser
function detectTargetLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();

  // If browser is in English, they probably want to learn something else
  // Default to Japanese as it's our primary focus
  if (browserLang.startsWith("en")) {
    return "japanese";
  }

  // If browser is in French, suggest Japanese or English
  if (browserLang.startsWith("fr")) {
    return "japanese";
  }

  // If browser is in Japanese, suggest English
  if (browserLang.startsWith("ja")) {
    return "english";
  }

  // Default to Japanese
  return "japanese";
}

export function OnboardingModal({ userId, userEmail, userName, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const upsertUser = useMutation(api.users.upsert);

  // Pre-select detected language on mount
  useEffect(() => {
    const detected = detectTargetLanguage();
    setSelectedLanguages([detected]);
  }, []);

  const handleLanguageToggle = (lang: Language) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleExamToggle = (exam: string) => {
    setSelectedExams((prev) =>
      prev.includes(exam) ? prev.filter((e) => e !== exam) : [...prev, exam]
    );
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
        targetExams: selectedExams as any[],
        primaryLanguage: selectedLanguages[0],
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
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Welcome to SanLang
            </h2>
            <p className="text-foreground-muted mb-8">
              Let's set up your personalized exam prep
            </p>
            <Button onClick={() => setStep(1)} className="w-full gap-2">
              Get Started
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 1: How It Works - The Learning Loop */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-foreground mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
              How SanLang Works
            </h2>
            <p className="text-foreground-muted mb-6 text-center">
              Master vocabulary through our proven learning loop
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-sm font-medium text-foreground">1. Read</div>
                <div className="text-xs text-foreground-muted">Stories at your level</div>
              </div>

              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                  <BookmarkCheck className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-sm font-medium text-foreground">2. Save</div>
                <div className="text-xs text-foreground-muted">Words you want to learn</div>
              </div>

              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-sm font-medium text-foreground">3. Review</div>
                <div className="text-xs text-foreground-muted">AI-powered flashcards</div>
              </div>

              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                  <PenLine className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-sm font-medium text-foreground">4. Practice</div>
                <div className="text-xs text-foreground-muted">Write sentences, get feedback</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1 gap-2">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Language Selection */}
        {step === 2 && (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Which languages are you studying?
              </h2>
            </div>
            <p className="text-foreground-muted mb-6">
              Select all that apply
            </p>

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
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedLanguages.length === 0}
                className="flex-1 gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Exam Selection */}
        {step === 3 && (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                Any exams coming up?
              </h2>
            </div>
            <p className="text-foreground-muted mb-6">
              We'll tailor content to your target exams (optional)
            </p>

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
                                <div className="font-medium text-foreground text-sm">{exam.label}</div>
                                <div className="text-xs text-foreground-muted">{exam.description}</div>
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
                Back
              </Button>
              <Button onClick={handleComplete} disabled={isSubmitting} className="flex-1 gap-2">
                {isSubmitting ? "Saving..." : "Start Learning"}
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>

            {selectedExams.length === 0 && (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="w-full mt-3 text-sm text-foreground-muted hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

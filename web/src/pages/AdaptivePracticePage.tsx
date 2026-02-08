import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code,
  Flame,
  RotateCcw,
  SkipForward,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DifficultyLevel,
  PracticeContent,
  PracticeQuestion,
  QuestionResult,
} from "@/components/practice";
import {
  getDiff,
  QuestionDictation,
  QuestionListening,
  QuestionMCQ,
  QuestionReading,
  QuestionShadowRecord,
  QuestionTranslation,
} from "@/components/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumBackground } from "@/components/ui/premium-background";
import { SkeletonLoadingCard } from "@/components/ui/skeleton-loading-card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/contexts/UserDataContext";
import { useAIAction } from "@/hooks/useAIAction";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";
import { isAdmin } from "@/lib/admin";
import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT, useUILanguage } from "@/lib/i18n";
import { abilityToProgress, difficultyToExamLabel, getLevelVariant } from "@/lib/levels";
import { getPracticeSessionKey } from "@/lib/practiceSession";

import { api } from "../../convex/_generated/api";

interface ModelPracticeResult {
  model: string;
  questions: PracticeQuestion[];
  latencyMs: number;
  error?: string;
  status: "pending" | "success" | "failed";
  systemPrompt?: string;
  prompt?: string;
}

interface PracticeSet {
  practiceId: string;
  isDiagnostic: boolean;
  content?: PracticeContent;
  questions: PracticeQuestion[];
  targetSkills: string[];
  difficulty: number;
  generatedAt: number;
  modelUsed?: string;
  systemPrompt?: string;
  prompt?: string;
  profileSnapshot: {
    abilityEstimate: number;
    abilityConfidence: number;
    skillScores: Record<string, number>;
  };
}

interface AnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  responseTimeMs?: number;
  skipped?: boolean;
  scorePercent?: number;
  feedback?: string;
}

type PracticePhase = "loading" | "content" | "questions" | "results";

// Audio/mic question types that need a skip option
const AUDIO_MIC_TYPES = ["listening_mcq", "dictation", "shadow_record"];

// Diagnostic mode dynamic generation constants
const DIAG_MIN_QUESTIONS = 4; // Show "Finish" button after this many answered
const DIAG_MAX_QUESTIONS = 10; // Auto-finish at this many answered
const DIAG_GENERATION_BUFFER = 2; // Trigger generation when remaining < this

// ============================================
// MODEL TEST MODE HELPERS
// ============================================

const MODEL_SHORT_NAMES: Record<string, string> = {
  "gemini-3-flash-preview": "Gemini Flash",
  "anthropic/claude-haiku-4.5": "Claude Haiku",
  "x-ai/grok-4.1-fast": "Grok 4.1 Fast",
  "openai/gpt-oss-120b": "GPT-OSS 120B",
  "openai/gpt-oss-20b": "GPT-OSS 20B",
  "openai/gpt-5-mini": "GPT-5 Mini",
  "anthropic/claude-sonnet-4.5": "Claude Sonnet",
};

function getModelShortName(model: string): string {
  return MODEL_SHORT_NAMES[model] ?? model;
}

// ============================================
// SMART QUESTION ORDERING
// ============================================

type Difficulty = DifficultyLevel;
const DIFFICULTY_ORDER: Difficulty[] = [
  "level_1",
  "level_2",
  "level_3",
  "level_4",
  "level_5",
  "level_6",
];

function pickNextQuestion(
  availableQuestions: PracticeQuestion[],
  answeredHistory: AnswerRecord[]
): PracticeQuestion | null {
  if (availableQuestions.length === 0) return null;

  const answeredIds = new Set(answeredHistory.map((a) => a.questionId));
  const remaining = availableQuestions.filter((q) => {
    if (answeredIds.has(q.questionId)) return false;
    // Skip audio questions that have no audio URL
    if (AUDIO_MIC_TYPES.includes(q.type) && !q.audioUrl) return false;
    return true;
  });
  if (remaining.length === 0) return null;

  const totalAnswered = answeredHistory.filter((a) => !a.skipped).length;

  // Determine target difficulty based on performance
  let targetDifficulty: Difficulty = "level_2";
  if (totalAnswered >= 2) {
    const recentAnswers = answeredHistory.filter((a) => !a.skipped).slice(-3);
    const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
    const recentTotal = recentAnswers.length;

    if (recentTotal >= 2 && recentCorrect >= recentTotal) {
      // All recent correct → scale up
      const lastDiff = getLastDifficulty(availableQuestions, answeredHistory);
      targetDifficulty = scaleDifficultyUp(lastDiff);
    } else if (recentTotal >= 2 && recentCorrect <= 0) {
      // All recent wrong → scale down
      const lastDiff = getLastDifficulty(availableQuestions, answeredHistory);
      targetDifficulty = scaleDifficultyDown(lastDiff);
    } else {
      // Mixed → stay at current
      targetDifficulty = getLastDifficulty(availableQuestions, answeredHistory);
    }
  }

  // Get last answered skill and type to avoid repeats
  const lastSkill =
    answeredHistory.length > 0
      ? availableQuestions.find(
          (q) => q.questionId === answeredHistory[answeredHistory.length - 1]?.questionId
        )?.targetSkill
      : null;
  const lastType =
    answeredHistory.length > 0
      ? availableQuestions.find(
          (q) => q.questionId === answeredHistory[answeredHistory.length - 1]?.questionId
        )?.type
      : null;

  // Track tested skills
  const testedSkills = new Set(
    answeredHistory
      .map((a) => availableQuestions.find((q) => q.questionId === a.questionId)?.targetSkill)
      .filter(Boolean)
  );

  // Score each remaining question
  let bestScore = -Infinity;
  let bestQuestion = remaining[0];

  for (const q of remaining) {
    let score = 0;

    // Difficulty match (+3 for exact, +1 for adjacent)
    if (q.difficulty === targetDifficulty) score += 3;
    else if (isAdjacentDifficulty(q.difficulty, targetDifficulty)) score += 1;

    // Avoid repeating skill back-to-back (-2)
    if (q.targetSkill === lastSkill) score -= 2;

    // Avoid repeating type back-to-back (-2)
    if (q.type === lastType) score -= 2;

    // Prefer untested skills (+2)
    if (!testedSkills.has(q.targetSkill)) score += 2;

    // Slight penalty for audio/mic types (prefer non-audio)
    if (AUDIO_MIC_TYPES.includes(q.type)) score -= 1;

    if (score > bestScore) {
      bestScore = score;
      bestQuestion = q;
    }
  }

  return bestQuestion;
}

function getLastDifficulty(questions: PracticeQuestion[], history: AnswerRecord[]): Difficulty {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].skipped) continue;
    const q = questions.find((q) => q.questionId === history[i].questionId);
    if (q?.difficulty) return q.difficulty;
  }
  return "level_2";
}

function scaleDifficultyUp(current: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  return DIFFICULTY_ORDER[Math.min(idx + 1, DIFFICULTY_ORDER.length - 1)];
}

function scaleDifficultyDown(current: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  return DIFFICULTY_ORDER[Math.max(idx - 1, 0)];
}

function isAdjacentDifficulty(a?: string, b?: string): boolean {
  const ia = DIFFICULTY_ORDER.indexOf((a ?? "level_3") as Difficulty);
  const ib = DIFFICULTY_ORDER.indexOf((b ?? "level_3") as Difficulty);
  return Math.abs(ia - ib) === 1;
}

/**
 * Compute target difficulty for incremental question generation
 * based on recent answer performance.
 */
function computeTargetDifficulty(
  questions: PracticeQuestion[],
  answeredHistory: AnswerRecord[]
): Difficulty {
  const nonSkipped = answeredHistory.filter((a) => !a.skipped);
  if (nonSkipped.length < 2) return "level_2";

  const recent = nonSkipped.slice(-3);
  const recentCorrect = recent.filter((a) => a.isCorrect).length;
  const lastDiff = getLastDifficulty(questions, answeredHistory);

  if (recent.length >= 2 && recentCorrect >= recent.length) {
    return scaleDifficultyUp(lastDiff);
  } else if (recent.length >= 2 && recentCorrect <= 0) {
    return scaleDifficultyDown(lastDiff);
  }
  return lastDiff;
}

// ============================================
// ADMIN RAW JSON PANEL
// ============================================

/* eslint-disable i18next/no-literal-string -- Admin-only UI */
function AdminRawJsonPanel({
  showRawJson,
  setShowRawJson,
  jsonTab,
  setJsonTab,
  inputData,
  outputData,
}: {
  showRawJson: boolean;
  setShowRawJson: (v: boolean) => void;
  jsonTab: "input" | "output";
  setJsonTab: (v: "input" | "output") => void;
  inputData: unknown;
  outputData: unknown;
}) {
  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowRawJson(!showRawJson)}
        className="text-foreground-muted"
      >
        <Code className="w-4 h-4 mr-1" />
        {showRawJson ? "Hide" : "Show"} Raw JSON
      </Button>
      {showRawJson && (
        <div className="mt-2">
          <div className="flex gap-1 mb-2">
            {(["input", "output"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setJsonTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-t-md transition-colors ${
                  jsonTab === tab
                    ? "bg-muted border border-b-0 border-border text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {tab === "input" ? "Input" : "Output"}
              </button>
            ))}
          </div>
          <pre className="p-3 rounded-lg bg-muted/50 border border-border text-xs overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(jsonTab === "input" ? inputData : outputData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
/* eslint-enable i18next/no-literal-string */

// ============================================
// MAIN COMPONENT
// ============================================

export function AdaptivePracticePage() {
  const navigate = useNavigate();
  const t = useT();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { userProfile } = useUserData();
  const { language: uiLanguage } = useUILanguage();
  const language = (userProfile?.languages?.[0] as ContentLanguage) || "japanese";

  // Practice state
  const [phase, setPhase] = useState<PracticePhase>("loading");
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionQueue, setQuestionQueue] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [contentReadTime, setContentReadTime] = useState<number>(0);

  // Refs for session abandonment flush (beforeunload / unmount)
  const answersRef = useRef<AnswerRecord[]>([]);
  const practiceSetRef = useRef<PracticeSet | null>(null);
  const phaseRef = useRef<PracticePhase>("loading");
  answersRef.current = answers;
  practiceSetRef.current = practiceSet;
  phaseRef.current = phase;

  // Diagnostic dynamic generation state
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string>("");
  const generationAbortedRef = useRef(false);
  const generationPromiseRef = useRef<Promise<PracticeQuestion[]> | null>(null);

  // Model test mode state (admin only)
  const isModelTestMode =
    isAdmin(user?.email) && typeof window !== "undefined"
      ? localStorage.getItem("modelTestMode") === "true"
      : false;
  const testModeModels = useQuery(
    api.adaptivePracticeQueries.getTestModeModels,
    isModelTestMode ? {} : "skip"
  );
  const [modelResults, setModelResults] = useState<ModelPracticeResult[]>([]);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [testQuestionIndex, setTestQuestionIndex] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonTab, setJsonTab] = useState<"input" | "output">("input");

  // Results phase queries (must be at top level, not inside conditional)
  const updatedProfile = useQuery(
    api.learnerModel.getProfile,
    phase === "results" && user ? { userId: user.id, language } : "skip"
  );
  const streakData = useQuery(
    api.users.getStreak,
    phase === "results" && user ? { clerkId: user.id } : "skip"
  );

  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Loading messages
  const loadingPhrases = useMemo(
    () => [
      t("adaptivePractice.loading.analyzingSkills"),
      t("adaptivePractice.loading.selectingContent"),
      t("adaptivePractice.loading.generatingQuestions"),
      t("adaptivePractice.loading.personalizingDifficulty"),
      t("adaptivePractice.loading.preparingPractice"),
      t("adaptivePractice.loading.finetuning"),
      t("adaptivePractice.loading.puttingTouches"),
      t("adaptivePractice.loading.verifyingCorrectness"),
    ],
    [t]
  );
  const loadingPhrase = useRotatingMessages(loadingPhrases, phase === "loading", 3000);

  // Phrases for the "generating more questions" pill
  const loadingMorePhrases = useMemo(
    () => [
      t("adaptivePractice.loading.loadingMore1"),
      t("adaptivePractice.loading.loadingMore2"),
      t("adaptivePractice.loading.loadingMore3"),
      t("adaptivePractice.loading.loadingMore4"),
    ],
    [t]
  );

  // Pick a random phrase each time generation starts
  useEffect(() => {
    if (isGeneratingMore) {
      const phrase = loadingMorePhrases[Math.floor(Math.random() * loadingMorePhrases.length)];
      setGeneratingMessage(phrase);
    }
  }, [isGeneratingMore, loadingMorePhrases]);

  // Get language display name
  const languageName = t(`common.languages.${language}`);

  // Convex actions/mutations
  const getNextPractice = useAction(api.adaptivePractice.getNextPractice);
  const generateForModel = useAction(api.adaptivePractice.generateForModel);
  const submitPractice = useMutation(api.adaptivePracticeQueries.submitPractice);
  const recordAnswer = useMutation(api.adaptivePracticeQueries.recordAnswer);
  const gradeFreeAnswer = useAction(api.adaptivePractice.gradeFreeAnswer);
  const generateIncremental = useAction(api.adaptivePractice.generateIncrementalQuestions);
  const evaluateShadowing = useAIAction(api.ai.evaluateShadowing);

  // Flush unsubmitted answers on tab close.
  // On unmount (React Router navigation), we DON'T flush because the session
  // is saved to sessionStorage and can be resumed. We only flush on
  // beforeunload (actual tab close) to avoid losing data.
  useEffect(() => {
    const flush = () => {
      const ps = practiceSetRef.current;
      const ans = answersRef.current;
      if (!ps || !user || phaseRef.current !== "questions" || ans.length === 0) return;
      const nonSkipped = ans.filter((a) => !a.skipped);
      const total = nonSkipped.reduce((s, a) => s + a.earnedPoints, 0);
      const max = nonSkipped.reduce((s, a) => {
        const q = ps.questions.find((q) => q.questionId === a.questionId);
        return s + (q?.points ?? 0);
      }, 0);
      submitPractice({
        userId: user.id,
        practiceId: ps.practiceId,
        contentId: ps.content?.contentId,
        contentType: ps.content?.contentType,
        language,
        isDiagnostic: ps.isDiagnostic,
        answers: nonSkipped.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          earnedPoints: a.earnedPoints,
          responseTimeMs: a.responseTimeMs,
        })),
        totalScore: total,
        maxScore: max,
        dwellMs: 0,
        targetSkills: ps.targetSkills,
      });
    };

    const handleBeforeUnload = () => flush();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Don't flush on unmount — session is persisted in sessionStorage
    };
  }, [user, language, submitPractice]);

  const totalQuestions = useMemo(() => {
    if (!practiceSet) return 0;
    if (!practiceSet.isDiagnostic) return practiceSet.questions.length;
    // Diagnostic: show answered + a small lookahead window
    const answeredIds = new Set(answers.map((a) => a.questionId));
    const remaining = practiceSet.questions.filter((q) => !answeredIds.has(q.questionId)).length;
    const lookahead = Math.min(remaining, 3);
    return answers.length + lookahead;
  }, [practiceSet, answers]);

  // Session persistence: save snapshot to sessionStorage
  // Computes totalScore/maxScore from the answers array to avoid stale closure values.
  const saveSessionToStorage = useCallback(
    (updatedAnswers: AnswerRecord[]) => {
      if (!practiceSet) return;
      try {
        const nonSkipped = updatedAnswers.filter((a) => !a.skipped);
        const computedTotal = nonSkipped.reduce((s, a) => s + a.earnedPoints, 0);
        const computedMax = nonSkipped.reduce((s, a) => {
          const q = practiceSet.questions.find((q) => q.questionId === a.questionId);
          return s + (q?.points ?? 0);
        }, 0);
        const snapshot = {
          practiceSet,
          answers: updatedAnswers,
          questionQueue,
          phase,
          totalScore: computedTotal,
          maxScore: computedMax,
          contentReadTime,
        };
        sessionStorage.setItem(getPracticeSessionKey(language), JSON.stringify(snapshot));
      } catch {
        // sessionStorage may be full or disabled — ignore
      }
    },
    [practiceSet, questionQueue, phase, contentReadTime, language]
  );

  const clearSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(getPracticeSessionKey(language));
    } catch {
      // ignore
    }
  }, [language]);

  // Session persistence: restore on mount
  const [restoredSession, setRestoredSession] = useState(false);
  useEffect(() => {
    if (restoredSession || phase !== "loading") return;
    try {
      const saved = sessionStorage.getItem(getPracticeSessionKey(language));
      if (!saved) return;
      const snapshot = JSON.parse(saved) as {
        practiceSet: PracticeSet;
        answers: AnswerRecord[];
        questionQueue: string[];
        phase: PracticePhase;
        totalScore: number;
        maxScore: number;
        contentReadTime: number;
      };
      if (snapshot.phase !== "questions" || snapshot.answers.length === 0) return;
      setPracticeSet(snapshot.practiceSet);
      setAnswers(snapshot.answers);
      setQuestionQueue(snapshot.questionQueue);
      setTotalScore(snapshot.totalScore);
      setMaxScore(snapshot.maxScore);
      setContentReadTime(snapshot.contentReadTime);
      setPhase("questions");
      setRestoredSession(true);
      // pickNext will fire via the useEffect that watches phase/practiceSet
    } catch {
      // invalid JSON or missing data — ignore and fetch fresh
    }
  }, [language, phase, restoredSession]);

  // Reset queue when a new practice session starts
  useEffect(() => {
    if (!practiceSet?.practiceId) return;
    // Don't reset queue if we just restored from sessionStorage
    if (restoredSession) return;
    setQuestionQueue([]);
  }, [practiceSet?.practiceId, restoredSession]);

  // Track the order questions are shown in (queue)
  useEffect(() => {
    const id = currentQuestion?.questionId;
    if (!id) return;
    setQuestionQueue((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [currentQuestion?.questionId]);

  // Ensure answered questions are also in the queue (safety)
  useEffect(() => {
    if (answers.length === 0) return;
    const lastAnswerId = answers[answers.length - 1]?.questionId;
    if (!lastAnswerId) return;
    setQuestionQueue((prev) => (prev.includes(lastAnswerId) ? prev : [...prev, lastAnswerId]));
  }, [answers]);

  // Pick next question using smart ordering
  const pickNext = useCallback(() => {
    if (!practiceSet) return;
    const next = pickNextQuestion(practiceSet.questions, answers);
    setCurrentQuestion(next);
    setQuestionStartTime(Date.now());
  }, [practiceSet, answers]);

  // Trigger background generation of 2 more questions (diagnostic mode only)
  const triggerBackgroundGeneration = useCallback(
    (currentAnswers: AnswerRecord[]): Promise<PracticeQuestion[]> => {
      if (!practiceSet || !practiceSet.isDiagnostic) return Promise.resolve([]);
      if (generationAbortedRef.current) return Promise.resolve([]);
      if (generationPromiseRef.current) return generationPromiseRef.current;

      const targetDifficulty = computeTargetDifficulty(practiceSet.questions, currentAnswers);

      // Build recent performance from last 5 answers
      const recentAnswers = currentAnswers.filter((a) => !a.skipped).slice(-5);
      const recentPerformance = recentAnswers.map((a) => {
        const q = practiceSet.questions.find((q) => q.questionId === a.questionId);
        return {
          skill: q?.targetSkill ?? "vocabulary",
          type: q?.type ?? "mcq_vocabulary",
          difficulty: q?.difficulty ?? "level_3",
          isCorrect: a.isCorrect,
        };
      });

      // Guardrails: avoid only recent repeats (not the entire pool)
      const recentSkills = recentAnswers
        .map((a) => practiceSet.questions.find((q) => q.questionId === a.questionId)?.targetSkill)
        .filter(Boolean) as string[];
      const recentTypes = recentAnswers
        .map((a) => practiceSet.questions.find((q) => q.questionId === a.questionId)?.type)
        .filter(Boolean) as string[];
      const excludeSkills = [...new Set(recentSkills)];
      const excludeTypes = [...new Set(recentTypes)];

      setIsGeneratingMore(true);

      const promise = generateIncremental({
        practiceId: practiceSet.practiceId,
        language,
        abilityEstimate: practiceSet.profileSnapshot.abilityEstimate,
        targetDifficulty,
        recentPerformance,
        excludeSkills,
        excludeTypes,
        uiLanguage,
      })
        .then((result) => {
          if (generationAbortedRef.current) return [];
          if (result.questions && result.questions.length > 0) {
            setPracticeSet((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                questions: [...prev.questions, ...result.questions],
              };
            });
          }
          return result.questions ?? [];
        })
        .catch((err) => {
          console.error("Failed to generate incremental questions:", err);
          return [];
        })
        .finally(() => {
          setIsGeneratingMore(false);
          generationPromiseRef.current = null;
        });
      generationPromiseRef.current = promise;
      return promise;
    },
    [practiceSet, generateIncremental, language, uiLanguage]
  );

  // Fire per-model streaming calls for test mode
  const fireModelTests = useCallback(
    (models: Array<{ model: string; provider: string }>) => {
      const initialResults: ModelPracticeResult[] = models.map((cfg) => ({
        model: cfg.model,
        questions: [],
        latencyMs: 0,
        status: "pending" as const,
      }));
      setModelResults(initialResults);
      setActiveModelIndex(0);
      setTestQuestionIndex(0);
      setPhase("questions");

      for (const cfg of models) {
        generateForModel({
          language,
          abilityEstimate: 0,
          modelId: cfg.model,
          modelProvider: cfg.provider as "google" | "openrouter",
        })
          .then((result) => {
            const hasError = !result.questions || result.questions.length === 0;
            setModelResults((prev) =>
              prev.map((r) =>
                r.model === cfg.model
                  ? {
                      ...r,
                      questions: result.questions ?? [],
                      latencyMs: result.latencyMs,
                      error: result.error,
                      status: hasError ? ("failed" as const) : ("success" as const),
                      systemPrompt: result.systemPrompt,
                      prompt: result.prompt,
                    }
                  : r
              )
            );
          })
          .catch((error) => {
            setModelResults((prev) =>
              prev.map((r) =>
                r.model === cfg.model
                  ? {
                      ...r,
                      error: error instanceof Error ? error.message : "Unknown error",
                      status: "failed" as const,
                    }
                  : r
              )
            );
          });
      }
    },
    [generateForModel, language]
  );

  // Regenerate questions for a single model (the currently active one)
  const regenerateSingleModel = useCallback(() => {
    if (!testModeModels) return;
    const activeResult = modelResults[activeModelIndex];
    if (!activeResult) return;
    const cfg = testModeModels.find((m) => m.model === activeResult.model);
    if (!cfg) return;

    // Reset only the active model to pending
    setModelResults((prev) =>
      prev.map((r) =>
        r.model === cfg.model
          ? {
              ...r,
              questions: [],
              latencyMs: 0,
              error: undefined,
              status: "pending" as const,
              systemPrompt: undefined,
              prompt: undefined,
            }
          : r
      )
    );
    setTestQuestionIndex(0);

    generateForModel({
      language,
      abilityEstimate: 0,
      modelId: cfg.model,
      modelProvider: cfg.provider as "google" | "openrouter",
    })
      .then((result) => {
        const hasError = !result.questions || result.questions.length === 0;
        setModelResults((prev) =>
          prev.map((r) =>
            r.model === cfg.model
              ? {
                  ...r,
                  questions: result.questions ?? [],
                  latencyMs: result.latencyMs,
                  error: result.error,
                  status: hasError ? ("failed" as const) : ("success" as const),
                  systemPrompt: result.systemPrompt,
                  prompt: result.prompt,
                }
              : r
          )
        );
      })
      .catch((error) => {
        setModelResults((prev) =>
          prev.map((r) =>
            r.model === cfg.model
              ? {
                  ...r,
                  error: error instanceof Error ? error.message : "Unknown error",
                  status: "failed" as const,
                }
              : r
          )
        );
      });
  }, [testModeModels, modelResults, activeModelIndex, generateForModel, language]);

  // Fetch practice set with TanStack Query (deduplicates under StrictMode)
  const {
    data: fetchedPractice,
    error: fetchError,
    refetch: refetchPractice,
  } = useTanstackQuery({
    queryKey: ["nextPractice", user?.id, language, uiLanguage],
    queryFn: () =>
      getNextPractice({
        userId: user!.id,
        language,
        uiLanguage,
      }),
    enabled: !!user && isAuthenticated && !isModelTestMode && !restoredSession,
    staleTime: Infinity,
    retry: false,
  });

  // Sync fetched practice to local state (only when loading)
  useEffect(() => {
    if (!fetchedPractice || phase !== "loading") return;
    const startTime = Date.now();
    setPracticeSet(fetchedPractice);
    if (fetchedPractice.isDiagnostic) {
      setContentReadTime(startTime);
      setPhase("questions");
    } else {
      setPhase("content");
      setContentReadTime(startTime);
    }
  }, [fetchedPractice, phase]);

  // Log fetch errors
  useEffect(() => {
    if (fetchError) {
      console.error("Failed to fetch practice:", fetchError);
    }
  }, [fetchError]);

  // Fire model tests on mount (separate from normal practice fetch)
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    if (isModelTestMode && testModeModels) {
      fireModelTests(testModeModels);
    }
  }, [user, isAuthenticated, isModelTestMode, testModeModels, fireModelTests]);

  // Auto-select first completed model in test mode
  useEffect(() => {
    if (!isModelTestMode || modelResults.length === 0) return;
    const currentActive = modelResults[activeModelIndex];
    // If currently selected model is still pending, auto-switch to first success
    if (currentActive?.status === "pending") {
      const firstSuccessIdx = modelResults.findIndex((r) => r.status === "success");
      if (firstSuccessIdx !== -1) {
        setActiveModelIndex(firstSuccessIdx);
        setTestQuestionIndex(0);
      }
    }
  }, [isModelTestMode, modelResults, activeModelIndex]);

  // Pick first question when entering questions phase
  useEffect(() => {
    if (phase === "questions" && practiceSet && !currentQuestion && answers.length === 0) {
      pickNext();
    }
  }, [phase, practiceSet, currentQuestion, answers.length, pickNext]);

  // Start questions phase
  const handleStartQuestions = useCallback(() => {
    setPhase("questions");
    pickNext();
  }, [pickNext]);

  // Play audio
  const handlePlayAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play();
  }, []);

  // Record answer to backend (fire-and-forget)
  const recordAnswerToBackend = useCallback(
    (question: PracticeQuestion, answer: AnswerRecord) => {
      if (!practiceSet || !user) return;
      // For MCQ questions, track which option was selected for distractor analysis
      const isMCQ = [
        "mcq_vocabulary",
        "mcq_grammar",
        "mcq_comprehension",
        "listening_mcq",
      ].includes(question.type);
      recordAnswer({
        userId: user.id,
        language,
        practiceId: practiceSet.practiceId,
        contentType: practiceSet.content?.contentType,
        isDiagnostic: practiceSet.isDiagnostic,
        questionId: question.questionId,
        questionText: question.question,
        questionType: question.type,
        targetSkill: question.targetSkill,
        difficulty: question.difficulty,
        difficultyNumeric: question.difficultyNumeric,
        userAnswer: answer.userAnswer,
        selectedOption: isMCQ ? answer.userAnswer : undefined,
        isCorrect: answer.isCorrect,
        earnedPoints: answer.earnedPoints,
        maxPoints: question.points,
        responseTimeMs: answer.responseTimeMs,
        skipped: answer.skipped,
        passageText: question.passageText,
      }).catch((err) => console.error("Failed to record answer:", err));
    },
    [practiceSet, user, language, recordAnswer]
  );

  // Finish session
  const finishSession = useCallback(
    async (finalAnswers: AnswerRecord[]) => {
      if (!practiceSet || !user) return;

      // Abort any in-flight background generation
      generationAbortedRef.current = true;
      // Synchronously mark phase so the beforeunload/unmount flush won't double-submit
      phaseRef.current = "results";

      const dwellMs = contentReadTime > 0 ? Math.max(0, Date.now() - contentReadTime) : 0;
      const nonSkippedAnswers = finalAnswers.filter((a) => !a.skipped);
      const finalTotalScore = nonSkippedAnswers.reduce((sum, a) => sum + a.earnedPoints, 0);
      const finalMaxScore = nonSkippedAnswers.reduce((sum, a) => {
        const q = practiceSet.questions.find((q) => q.questionId === a.questionId);
        return sum + (q?.points ?? 0);
      }, 0);

      setTotalScore(finalTotalScore);
      setMaxScore(finalMaxScore);

      await submitPractice({
        userId: user.id,
        practiceId: practiceSet.practiceId,
        contentId: practiceSet.content?.contentId,
        contentType: practiceSet.content?.contentType,
        language,
        isDiagnostic: practiceSet.isDiagnostic,
        answers: nonSkippedAnswers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          earnedPoints: a.earnedPoints,
          responseTimeMs: a.responseTimeMs,
        })),
        totalScore: finalTotalScore,
        maxScore: finalMaxScore,
        dwellMs,
        targetSkills: practiceSet.targetSkills,
      });
      clearSessionStorage();
      setPhase("results");
    },
    [practiceSet, user, language, contentReadTime, submitPractice, clearSessionStorage]
  );

  // Skip audio/mic question
  const handleSkipQuestion = useCallback(async () => {
    if (!currentQuestion || !practiceSet) return;

    const answer: AnswerRecord = {
      questionId: currentQuestion.questionId,
      userAnswer: "[skipped]",
      isCorrect: false,
      earnedPoints: 0,
      skipped: true,
    };

    setAnswers((prev) => [...prev, answer]);
    // Don't add to score for skipped questions
    recordAnswerToBackend(currentQuestion, answer);
    saveSessionToStorage([...answers, answer]);

    const updatedAnswers = [...answers, answer];
    const remaining = practiceSet.questions.filter(
      (q) => !updatedAnswers.some((a) => a.questionId === q.questionId)
    );

    // Diagnostic mode: trigger background generation if pool is low
    if (practiceSet.isDiagnostic && remaining.length < DIAG_GENERATION_BUFFER) {
      triggerBackgroundGeneration(updatedAnswers);
    }

    if (practiceSet.isDiagnostic && remaining.length === 0) {
      const answeredCount = updatedAnswers.filter((a) => !a.skipped).length;
      if (answeredCount < DIAG_MAX_QUESTIONS) {
        const newQuestions = await triggerBackgroundGeneration(updatedAnswers);
        if (newQuestions.length > 0) {
          const mergedQuestions = [...practiceSet.questions, ...newQuestions];
          const next = pickNextQuestion(mergedQuestions, updatedAnswers);
          if (next) {
            setShowFeedback(false);
            setSelectedAnswer("");
            setCurrentQuestion(next);
            setQuestionStartTime(Date.now());
            return;
          }
        }
      }
    }

    if (remaining.length === 0) {
      finishSession(updatedAnswers);
    } else {
      const next = pickNextQuestion(practiceSet.questions, updatedAnswers);
      setShowFeedback(false);
      setSelectedAnswer("");
      setCurrentQuestion(next);
      setQuestionStartTime(Date.now());
    }
  }, [
    currentQuestion,
    practiceSet,
    answers,
    recordAnswerToBackend,
    saveSessionToStorage,
    finishSession,
    triggerBackgroundGeneration,
  ]);

  // Navigate to a previously answered question by queue index
  const handleGoToQuestion = useCallback(
    (queueIndex: number) => {
      if (!practiceSet) return;
      const questionId = questionQueue[queueIndex];
      if (!questionId) return;
      const question = practiceSet.questions.find((q) => q.questionId === questionId);
      if (!question) return;
      const answer = answers.find((a) => a.questionId === questionId);
      if (!answer) return; // Only navigate to answered questions
      setCurrentQuestion(question);
      setSelectedAnswer(answer.userAnswer);
      setShowFeedback(true);
    },
    [practiceSet, questionQueue, answers]
  );

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    if (!practiceSet || !currentQuestion) return;

    // Guard: don't re-submit if already answered (e.g. revisiting)
    if (answers.some((a) => a.questionId === currentQuestion.questionId)) return;

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const responseTimeMs = Date.now() - questionStartTime;

    try {
      let isCorrect = false;
      let earnedPoints = 0;

      let scorePercent: number | undefined;

      let feedback: string | undefined;

      if (currentQuestion.type === "free_input" || currentQuestion.type === "translation") {
        const grading = await gradeFreeAnswer({
          question: currentQuestion.question,
          userAnswer: selectedAnswer,
          language,
          correctAnswer: currentQuestion.correctAnswer,
          acceptableAnswers: currentQuestion.acceptableAnswers,
          expectedConcepts: currentQuestion.acceptableAnswers,
        });
        scorePercent = grading.score;
        feedback = grading.feedback;
        isCorrect = grading.score >= 80;
        earnedPoints = Math.round((grading.score / 100) * currentQuestion.points);
      } else if (currentQuestion.type === "dictation") {
        const diff = getDiff(selectedAnswer.trim(), currentQuestion.correctAnswer);
        const matchCount = diff.filter((d) => d.status === "match").length;
        scorePercent = diff.length > 0 ? Math.round((matchCount / diff.length) * 100) : 0;
        isCorrect = scorePercent >= 80;
        earnedPoints = Math.round((scorePercent / 100) * currentQuestion.points);
      } else {
        isCorrect =
          selectedAnswer === currentQuestion.correctAnswer ||
          (currentQuestion.acceptableAnswers?.includes(selectedAnswer) ?? false);
        earnedPoints = isCorrect ? currentQuestion.points : 0;
      }

      const answer: AnswerRecord = {
        questionId: currentQuestion.questionId,
        userAnswer: selectedAnswer,
        isCorrect,
        earnedPoints,
        responseTimeMs,
        scorePercent,
        feedback,
      };

      setAnswers((prev) => [...prev, answer]);
      setTotalScore((prev) => prev + earnedPoints);
      setMaxScore((prev) => prev + currentQuestion.points);
      setShowFeedback(true);

      // Fire-and-forget: record answer + update learner model
      recordAnswerToBackend(currentQuestion, answer);

      // Persist session to sessionStorage
      saveSessionToStorage([...answers, answer]);

      // Diagnostic mode: trigger background generation if pool is running low
      if (practiceSet.isDiagnostic) {
        const updatedAnswers = [...answers, answer];
        const answeredCount = updatedAnswers.filter((a) => !a.skipped).length;
        const answeredIds = new Set(updatedAnswers.map((a) => a.questionId));
        const remainingInPool = practiceSet.questions.filter(
          (q) => !answeredIds.has(q.questionId)
        ).length;
        if (answeredCount < DIAG_MAX_QUESTIONS && remainingInPool < DIAG_GENERATION_BUFFER) {
          triggerBackgroundGeneration(updatedAnswers);
        }
      }
    } catch (error) {
      console.error("Failed to grade answer:", error);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    practiceSet,
    currentQuestion,
    selectedAnswer,
    questionStartTime,
    gradeFreeAnswer,
    language,
    recordAnswerToBackend,
    saveSessionToStorage,
    answers,
    triggerBackgroundGeneration,
  ]);

  // Submit audio for shadow_record evaluation
  const handleSubmitAudio = useCallback(
    async (audioBase64: string): Promise<{ score: number; feedback: string }> => {
      if (!practiceSet || !currentQuestion) return { score: 0, feedback: "" };

      const responseTimeMs = Date.now() - questionStartTime;

      try {
        const result = await evaluateShadowing({
          targetText: currentQuestion.question,
          targetLanguage: language as "japanese" | "english" | "french",
          userAudioBase64: audioBase64,
          feedbackLanguage: "en",
        });

        const isCorrect = result.accuracyScore >= 80;
        const earnedPoints = Math.round((result.accuracyScore / 100) * currentQuestion.points);

        const answer: AnswerRecord = {
          questionId: currentQuestion.questionId,
          userAnswer: `[audio:${result.accuracyScore}%]`,
          isCorrect,
          earnedPoints,
          responseTimeMs,
          scorePercent: result.accuracyScore,
        };

        setAnswers((prev) => [...prev, answer]);
        setTotalScore((prev) => prev + earnedPoints);
        setMaxScore((prev) => prev + currentQuestion.points);
        setShowFeedback(true);

        recordAnswerToBackend(currentQuestion, answer);

        return { score: result.accuracyScore, feedback: result.feedbackText };
      } catch (error) {
        console.error("Failed to evaluate shadowing:", error);
        return { score: 0, feedback: t("adaptivePractice.feedback.evaluationFailed") };
      }
    },
    [
      practiceSet,
      currentQuestion,
      questionStartTime,
      evaluateShadowing,
      language,
      recordAnswerToBackend,
      t,
    ]
  );

  const answerToResult = useCallback((answer?: AnswerRecord): QuestionResult => {
    if (!answer || answer.skipped) return null;
    if (answer.scorePercent !== undefined) {
      if (answer.scorePercent >= 80) return "correct";
      if (answer.scorePercent >= 50) return "partial";
      return "incorrect";
    }
    return answer.isCorrect ? "correct" : "incorrect";
  }, []);

  // Build previous results array for progress squares (question queue order)
  const buildPreviousResults = useCallback((): QuestionResult[] => {
    if (!practiceSet) return [];
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));
    const results = questionQueue.map((id) => answerToResult(answerMap.get(id)));
    if (results.length < totalQuestions) {
      results.push(...Array(totalQuestions - results.length).fill(null));
    }
    return results;
  }, [practiceSet, answers, questionQueue, totalQuestions, answerToResult]);

  // Next question or finish
  const handleNextQuestion = useCallback(async () => {
    if (!practiceSet) return;

    const updatedAnswers = answers;
    const answeredCount = updatedAnswers.filter((a) => !a.skipped).length;
    const remaining = practiceSet.questions.filter(
      (q) => !updatedAnswers.some((a) => a.questionId === q.questionId)
    );

    if (practiceSet.isDiagnostic) {
      // Diagnostic mode: dynamic session end logic
      if (answeredCount >= DIAG_MAX_QUESTIONS) {
        generationAbortedRef.current = true;
        setShowFeedback(false);
        setSelectedAnswer("");
        await finishSession(updatedAnswers);
        return;
      }
      if (remaining.length === 0) {
        const newQuestions = await triggerBackgroundGeneration(updatedAnswers);
        if (newQuestions.length > 0) {
          const mergedQuestions = [...practiceSet.questions, ...newQuestions];
          const next = pickNextQuestion(mergedQuestions, updatedAnswers);
          if (next) {
            setShowFeedback(false);
            setSelectedAnswer("");
            setCurrentQuestion(next);
            setQuestionStartTime(Date.now());
            return;
          }
        }
        generationAbortedRef.current = true;
        setShowFeedback(false);
        setSelectedAnswer("");
        await finishSession(updatedAnswers);
        return;
      }
      const next = pickNextQuestion(practiceSet.questions, updatedAnswers);
      setShowFeedback(false);
      setSelectedAnswer("");
      setCurrentQuestion(next);
      setQuestionStartTime(Date.now());
      return;
    }

    // Normal mode: unchanged
    if (remaining.length === 0) {
      setShowFeedback(false);
      setSelectedAnswer("");
      await finishSession(updatedAnswers);
    } else {
      const next = pickNextQuestion(practiceSet.questions, updatedAnswers);
      setShowFeedback(false);
      setSelectedAnswer("");
      setCurrentQuestion(next);
      setQuestionStartTime(Date.now());
    }
  }, [practiceSet, answers, finishSession, triggerBackgroundGeneration]);

  // Restart practice
  const handleRestart = useCallback(() => {
    clearSessionStorage();
    setRestoredSession(false);
    setPracticeSet(null);
    setPhase("loading");
    setCurrentQuestion(null);
    setAnswers([]);
    setQuestionQueue([]);
    setSelectedAnswer("");
    setShowFeedback(false);
    setTotalScore(0);
    setMaxScore(0);
    setShowRawJson(false);
    setModelResults([]);
    setIsGeneratingMore(false);
    generationAbortedRef.current = false;

    if (!user) return;

    if (isModelTestMode && testModeModels) {
      fireModelTests(testModeModels);
      return;
    }

    refetchPractice();
  }, [user, isModelTestMode, testModeModels, fireModelTests, refetchPractice, clearSessionStorage]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <SkeletonLoadingCard loadingPhrase={t("common.status.loading")} />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">{t("common.auth.signInRequired")}</h1>
            <p className="text-foreground-muted mb-6">{t("adaptivePractice.signInPrompt")}</p>
            <Button onClick={() => navigate({ to: "/" })}>{t("common.actions.signIn")}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading phase
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col relative">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">{t("adaptivePractice.title")}</h1>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pb-48">
          <div className="text-2xl sm:text-3xl font-bold text-center px-4">
            <AnimatePresence mode="wait">
              <motion.span
                key={loadingPhrase}
                className="inline-block bg-gradient-to-r from-yellow-300 via-orange-400 to-purple-400 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              >
                {loadingPhrase}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // Content phase - show the content to read (normal mode only)
  if (phase === "content" && practiceSet?.content) {
    const content = practiceSet.content;
    const fontFamily = language === "japanese" ? "var(--font-japanese)" : "inherit";

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">{t("adaptivePractice.title")}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{languageName}</Badge>
              <Badge variant="secondary">
                {content.contentType === "dialogue"
                  ? t("adaptivePractice.contentType.dialogue")
                  : t("adaptivePractice.contentType.microStory")}
              </Badge>
            </div>
          </div>

          {/* Target skills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {practiceSet.targetSkills.map((skill) => (
              <Badge key={skill} className="bg-accent/10 text-accent border-accent/20">
                <Target className="w-3 h-3 mr-1" />
                {t(`common.skillTypes.${skill}`)}
              </Badge>
            ))}
          </div>

          {/* Content Card */}
          <div className="bg-surface rounded-xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily }}>
                {content.title}
              </h2>
              {content.audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlayAudio(content.audioUrl!)}
                  disabled={isPlayingAudio}
                >
                  <Volume2 className={`w-4 h-4 ${isPlayingAudio ? "text-accent" : ""}`} />
                </Button>
              )}
            </div>

            <div
              className="text-lg leading-relaxed mb-4 whitespace-pre-wrap"
              style={{ fontFamily }}
            >
              {content.content}
            </div>

            <div className="text-sm text-foreground-muted border-t border-border pt-4">
              {content.translation}
            </div>

            {/* Vocabulary list */}
            {content.vocabulary.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-medium mb-2">{t("adaptivePractice.vocabulary")}</h3>
                <div className="flex flex-wrap gap-2">
                  {content.vocabulary.map((v, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-muted border border-border"
                    >
                      <span style={{ fontFamily }}>{v.word}</span>
                      {v.reading && (
                        <span className="text-foreground-muted ml-1">({v.reading})</span>
                      )}
                      <span className="text-foreground-muted ml-1">- {v.meaning}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Start Questions Button */}
          <Button className="w-full" size="lg" onClick={handleStartQuestions}>
            <BookOpen className="w-4 h-4 mr-2" />
            {t("adaptivePractice.startQuestions", { count: practiceSet.questions.length })}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Model Test Mode: comparison view
  /* eslint-disable i18next/no-literal-string -- Admin-only UI */
  if (isModelTestMode && phase === "questions" && modelResults.length > 0) {
    const activeResult = modelResults[activeModelIndex];
    const activeQuestions = activeResult?.questions ?? [];
    const activeQuestion = activeQuestions[testQuestionIndex];
    const completedCount = modelResults.filter((r) => r.status !== "pending").length;

    const dummyContent: PracticeContent = {
      contentId: "test-mode",
      contentType: "dialogue",
      title: "",
      content: "",
      translation: "",
      vocabulary: [],
    };

    const renderTestQuestion = (q: PracticeQuestion) => {
      const testProps = {
        question: q,
        content: dummyContent,
        language,
        totalQuestions: activeQuestions.length,
        currentIndex: testQuestionIndex,
        previousResults: [] as QuestionResult[],
        showFeedback: true, // Always show answer
        isSubmitting: false,
        currentAnswer: { isCorrect: true, earnedPoints: q.points }, // Simulate correct for green state
        selectedAnswer: q.correctAnswer, // Pre-select correct answer
        onSelectAnswer: () => {},
        onSubmit: () => {},
        onNext: () => {},
        isLastQuestion: false,
      };

      switch (q.type) {
        case "mcq_vocabulary":
        case "mcq_grammar":
        case "fill_blank":
          return <QuestionMCQ key={q.questionId} {...testProps} />;
        case "mcq_comprehension":
          return <QuestionReading key={q.questionId} {...testProps} />;
        case "listening_mcq":
          return <QuestionListening key={q.questionId} {...testProps} />;
        case "translation":
        case "free_input":
          return <QuestionTranslation key={q.questionId} {...testProps} />;
        case "dictation":
          return <QuestionDictation key={q.questionId} {...testProps} />;
        case "shadow_record":
          return (
            <QuestionShadowRecord
              key={q.questionId}
              {...testProps}
              onSubmitAudio={async () => ({ score: 0, feedback: "" })}
            />
          );
        default:
          return <QuestionMCQ key={q.questionId} {...testProps} />;
      }
    };

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">Model Test Mode</h1>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
              {completedCount}/{modelResults.length} models
            </Badge>
          </div>

          {/* Model Tabs */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-3 -mx-4 px-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {modelResults.map((result, idx) => {
                const isPending = result.status === "pending";
                const isFailed = result.status === "failed";
                const isActive = idx === activeModelIndex;
                return (
                  <button
                    key={result.model}
                    onClick={() => {
                      if (!isFailed && !isPending) {
                        setActiveModelIndex(idx);
                        setTestQuestionIndex(0);
                      }
                    }}
                    disabled={isFailed || isPending}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      isPending
                        ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-400 cursor-wait"
                        : isFailed
                          ? "border-red-500/30 bg-red-500/5 text-red-400 opacity-60 cursor-not-allowed"
                          : isActive
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-surface text-foreground-muted hover:border-foreground-muted"
                    }`}
                  >
                    <div>{getModelShortName(result.model)}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {isPending ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : isFailed ? (
                        "Failed"
                      ) : (
                        `${result.questions.length}q · ${result.latencyMs}ms`
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Model: Pending state */}
          {activeResult?.status === "pending" && (
            <div className="p-8 text-center text-foreground-muted">
              <div className="animate-pulse text-lg mb-2">Waiting for models...</div>
              <div className="text-sm">
                {completedCount}/{modelResults.length} completed
              </div>
            </div>
          )}

          {/* Active Model: Success state */}
          {activeResult?.status === "success" && activeQuestions.length > 0 && (
            <>
              {/* Question Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestQuestionIndex((i) => Math.max(0, i - 1))}
                  disabled={testQuestionIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>
                <span className="text-sm text-foreground-muted font-medium">
                  {testQuestionIndex + 1} / {activeQuestions.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTestQuestionIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                  }
                  disabled={testQuestionIndex === activeQuestions.length - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={regenerateSingleModel}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleRestart}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Regenerate All
                </Button>
              </div>
              <AdminRawJsonPanel
                showRawJson={showRawJson}
                setShowRawJson={setShowRawJson}
                jsonTab={jsonTab}
                setJsonTab={setJsonTab}
                inputData={{
                  systemPrompt: activeResult?.systemPrompt,
                  prompt: activeResult?.prompt,
                  model: activeResult?.model,
                }}
                outputData={activeQuestion ?? activeResult}
              />

              {/* Render the question */}
              {activeQuestion && renderTestQuestion(activeQuestion)}
            </>
          )}

          {/* Error state for active model */}
          {activeResult?.status === "failed" && activeResult?.error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <strong>{getModelShortName(activeResult.model)}</strong> failed: {activeResult.error}
            </div>
          )}
        </div>
      </div>
    );
  }
  /* eslint-enable i18next/no-literal-string */

  // Questions phase
  if (phase === "questions" && practiceSet && currentQuestion) {
    const answeredNonSkipped = answers.filter((a) => !a.skipped).length;
    const isDiag = practiceSet.isDiagnostic;
    const canFinishDiag = isDiag && answeredNonSkipped >= DIAG_MIN_QUESTIONS;
    const currentAnswer = answers.find((a) => a.questionId === currentQuestion.questionId) ?? null;
    const queueIndex = questionQueue.indexOf(currentQuestion.questionId);
    const currentIndex = queueIndex !== -1 ? queueIndex : questionQueue.length;
    // In diagnostic mode, don't treat as last question while more are being generated
    const isLastQuestion = isDiag
      ? answeredNonSkipped >= DIAG_MAX_QUESTIONS - 1 && !isGeneratingMore
      : currentIndex >= totalQuestions - 1;
    const previousResultsArray = buildPreviousResults();
    const isAudioMicQuestion = AUDIO_MIC_TYPES.includes(currentQuestion.type);

    // Shared props for all question components
    const sharedProps = {
      question: currentQuestion,
      content: practiceSet.content ?? {
        contentId: "diagnostic",
        contentType: "dialogue" as const,
        title: "",
        content: "",
        translation: "",
        vocabulary: [],
      },
      language,
      totalQuestions,
      currentIndex,
      previousResults: previousResultsArray,
      showFeedback,
      isSubmitting,
      currentAnswer: currentAnswer
        ? {
            isCorrect: currentAnswer.isCorrect,
            earnedPoints: currentAnswer.earnedPoints,
            feedback: currentAnswer.feedback,
            userAnswer: currentAnswer.userAnswer,
          }
        : null,
      selectedAnswer,
      onSelectAnswer: setSelectedAnswer,
      onSubmit: handleSubmitAnswer,
      onNext: handleNextQuestion,
      onGoToQuestion: handleGoToQuestion,
      isLastQuestion,
      isGeneratingMore,
      generatingMessage,
    };

    const renderQuestion = () => {
      switch (currentQuestion.type) {
        case "mcq_vocabulary":
        case "mcq_grammar":
        case "fill_blank":
          return <QuestionMCQ key={currentQuestion.questionId} {...sharedProps} />;
        case "mcq_comprehension":
          return <QuestionReading key={currentQuestion.questionId} {...sharedProps} />;
        case "listening_mcq":
          return <QuestionListening key={currentQuestion.questionId} {...sharedProps} />;
        case "translation":
        case "free_input":
          return <QuestionTranslation key={currentQuestion.questionId} {...sharedProps} />;
        case "dictation":
          return <QuestionDictation key={currentQuestion.questionId} {...sharedProps} />;
        case "shadow_record":
          return (
            <QuestionShadowRecord
              key={currentQuestion.questionId}
              {...sharedProps}
              onSubmitAudio={handleSubmitAudio}
            />
          );
        default:
          return <QuestionMCQ key={currentQuestion.questionId} {...sharedProps} />;
      }
    };

    return (
      <div>
        {isAdmin(user?.email) && (
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center gap-2 mb-1">
              {practiceSet.modelUsed && (
                <Badge variant="outline" className="text-xs">
                  {getModelShortName(practiceSet.modelUsed)}
                </Badge>
              )}
            </div>
            <AdminRawJsonPanel
              showRawJson={showRawJson}
              setShowRawJson={setShowRawJson}
              jsonTab={jsonTab}
              setJsonTab={setJsonTab}
              inputData={{
                profileSnapshot: practiceSet.profileSnapshot,
                targetSkills: practiceSet.targetSkills,
                difficulty: practiceSet.difficulty,
                content: practiceSet.content,
                modelUsed: practiceSet.modelUsed,
                isDiagnostic: practiceSet.isDiagnostic,
                generatedAt: practiceSet.generatedAt,
                systemPrompt: practiceSet.systemPrompt,
                prompt: practiceSet.prompt,
              }}
              outputData={currentQuestion}
            />
          </div>
        )}
        {renderQuestion()}
        {/* Skip button for audio/mic questions */}
        {isAudioMicQuestion && !showFeedback && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipQuestion}
              className="text-foreground-muted hover:text-foreground"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              {t("adaptivePractice.skipAudioQuestion")}
            </Button>
          </div>
        )}
        {/* Diagnostic mode: early finish button after minimum questions */}
        {canFinishDiag && showFeedback && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                generationAbortedRef.current = true;
                finishSession(answers);
              }}
              className="bg-surface/80 backdrop-blur-sm"
            >
              {t("adaptivePractice.finishSession")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Results phase
  if (phase === "results" && practiceSet) {
    const nonSkippedAnswers = answers.filter((a) => !a.skipped);
    const percentScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const correctCount = nonSkippedAnswers.filter((a) => a.isCorrect).length;
    const skippedCount = answers.filter((a) => a.skipped).length;

    // Level-up detection
    const previousAbility = practiceSet.profileSnapshot.abilityEstimate;
    const previousLevel = abilityToProgress(previousAbility, language);
    const currentAbility = updatedProfile?.abilityEstimate ?? previousAbility;
    const currentLevel = abilityToProgress(currentAbility, language);
    const didLevelUp =
      currentLevel.currentLevel !== previousLevel.currentLevel && currentAbility > previousAbility;

    // Difficulty trajectory - map each answered question to its level label
    const difficultyTrajectory = answers
      .filter((a) => !a.skipped)
      .map((a) => {
        const q = practiceSet.questions.find((q) => q.questionId === a.questionId);
        if (!q?.difficulty) return null;
        return difficultyToExamLabel(q.difficulty, language);
      })
      .filter((label): label is string => label !== null);

    // Count questions per level
    const levelCounts = new Map<string, number>();
    for (const label of difficultyTrajectory) {
      levelCounts.set(label, (levelCounts.get(label) ?? 0) + 1);
    }

    const currentStreak = streakData?.currentStreak ?? 0;

    return (
      <div className="min-h-screen bg-background">
        <PremiumBackground colorScheme="cool" intensity="minimal" />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">{t("adaptivePractice.results.title")}</h1>
          </div>

          {/* Results Card */}
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            {/* Level-up celebration */}
            {didLevelUp ? (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mb-6"
              >
                <p className="text-sm font-medium text-accent mb-3">
                  {t("adaptivePractice.results.levelUp")}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Badge
                    variant={getLevelVariant(previousLevel.currentLevel)}
                    className="text-lg px-3 py-1 opacity-50 line-through"
                  >
                    {previousLevel.currentLevel}
                  </Badge>
                  <span className="text-foreground-muted">&rarr;</span>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.3 }}
                  >
                    <Badge
                      variant={getLevelVariant(currentLevel.currentLevel)}
                      className="text-xl px-4 py-1.5"
                    >
                      {currentLevel.currentLevel}
                    </Badge>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6"
                >
                  <Trophy className="w-10 h-10 text-accent" />
                </motion.div>

                {/* Current level */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-sm text-foreground-muted">
                    {t("adaptivePractice.results.yourLevel")}
                  </span>
                  <Badge
                    variant={getLevelVariant(currentLevel.currentLevel)}
                    className="text-base px-3 py-0.5"
                  >
                    {currentLevel.currentLevel}
                  </Badge>
                </div>
              </>
            )}

            <h2 className="text-2xl font-bold mb-2">
              {percentScore >= 80
                ? t("adaptivePractice.results.excellent")
                : percentScore >= 60
                  ? t("adaptivePractice.results.goodJob")
                  : t("adaptivePractice.results.keepPracticing")}
            </h2>

            {practiceSet.isDiagnostic && (
              <p className="text-sm text-foreground-muted mb-4">
                {t("adaptivePractice.results.diagnosticNote")}
              </p>
            )}

            <div className="text-5xl font-bold text-accent my-6">{percentScore}%</div>

            {/* Stats */}
            <div className="flex justify-center gap-8 text-sm text-foreground-muted mb-4">
              <div>
                <span className="font-medium text-foreground">{correctCount}</span> /{" "}
                {nonSkippedAnswers.length} {t("adaptivePractice.results.correct")}
              </div>
              <div>
                <span className="font-medium text-foreground">{totalScore}</span> / {maxScore}{" "}
                {t("adaptivePractice.points")}
              </div>
              {skippedCount > 0 && (
                <div>
                  <span className="font-medium text-foreground">{skippedCount}</span>{" "}
                  {t("adaptivePractice.results.skipped")}
                </div>
              )}
            </div>

            {/* Streak */}
            {currentStreak > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-1.5 text-sm text-orange-400 mb-4"
              >
                <Flame className="w-4 h-4" />
                <span className="font-medium">
                  {t("adaptivePractice.results.streakLabel", { count: currentStreak })}
                </span>
              </motion.div>
            )}

            {/* Difficulty trajectory */}
            {difficultyTrajectory.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-4"
              >
                <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                  {difficultyTrajectory.map((label, i) => (
                    <Badge
                      key={i}
                      variant={getLevelVariant(label)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-foreground-muted">
                  {Array.from(levelCounts.entries())
                    .map(([level, count]) =>
                      t("adaptivePractice.results.questionsAtLevel", { count, level })
                    )
                    .join(" · ")}
                </p>
              </motion.div>
            )}

            {/* Skills practiced */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {practiceSet.targetSkills.map((skill) => (
                <Badge key={skill} className="bg-accent/10 text-accent border-accent/20">
                  {t(`common.skillTypes.${skill}`)}
                </Badge>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <Button onClick={handleRestart}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("adaptivePractice.results.practiceAgain")}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                {t("adaptivePractice.results.backToLearn")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

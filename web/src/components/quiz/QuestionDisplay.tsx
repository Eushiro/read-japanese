import { CheckCircle2, XCircle } from "lucide-react";

import type { ContentLanguage } from "@/lib/contentLanguages";
import { useT } from "@/lib/i18n";

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "essay"
  | "translation"
  | "inference"
  | "prediction"
  | "grammar"
  | "opinion";

export interface QuestionDisplayProps {
  // Question content
  question: string;
  questionTranslation?: string;
  type: QuestionType;
  options?: string[];
  points?: number;

  // Answer state
  selectedAnswer: string;
  onSelectAnswer: (answer: string) => void;

  // Feedback state
  isAnswered: boolean;
  showFeedback?: boolean;
  correctAnswer?: string;
  isCorrect?: boolean;
  aiFeedback?: string;
  aiScore?: number;

  // Interaction state
  isDisabled?: boolean;

  // Optional metadata badges
  metadata?: {
    type?: string;
    level?: string;
    badge?: string;
  };

  // Language for font styling
  language?: ContentLanguage;
}

// Get display label for question type
function getTypeLabel(type: QuestionType, t: ReturnType<typeof useT>): string {
  return t(`comprehension.questionTypes.${type}`) || type;
}

// Get color for question type badge
function getTypeColor(type: QuestionType): string {
  switch (type) {
    case "multiple_choice":
      return "bg-blue-500/10 text-blue-600";
    case "short_answer":
    case "translation":
      return "bg-amber-500/10 text-amber-600";
    case "essay":
    case "opinion":
      return "bg-purple-500/10 text-purple-600";
    case "inference":
    case "prediction":
      return "bg-teal-500/10 text-teal-600";
    case "grammar":
      return "bg-pink-500/10 text-pink-600";
    default:
      return "bg-muted text-foreground-muted";
  }
}

export function QuestionDisplay({
  question,
  questionTranslation,
  type,
  options,
  points,
  selectedAnswer,
  onSelectAnswer,
  isAnswered,
  showFeedback = false,
  correctAnswer,
  aiFeedback,
  aiScore,
  isDisabled = false,
  metadata,
  language = "japanese",
}: QuestionDisplayProps) {
  const t = useT();
  const fontFamily = language === "japanese" ? "var(--font-japanese)" : "inherit";
  const isMultipleChoice = type === "multiple_choice" && options && options.length > 0;
  const showCorrectness = showFeedback && isAnswered;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Glass background */}
      <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border rounded-2xl" />
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

      {/* Content */}
      <div className="relative p-6 sm:p-8">
        {/* Metadata badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(type)}`}>
            {metadata?.type || getTypeLabel(type, t)}
          </span>
          {points !== undefined && (
            <span className="text-xs text-foreground-muted">
              {t("comprehension.questionDisplay.points", { count: points })}
            </span>
          )}
          {metadata?.level && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground-muted">
              {metadata.level}
            </span>
          )}
          {metadata?.badge && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground-muted">
              {metadata.badge}
            </span>
          )}
        </div>

        {/* Question text */}
        <h2 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily }}>
          {question}
        </h2>
        {questionTranslation && <p className="text-foreground-muted mb-6">{questionTranslation}</p>}

        {/* Answer input */}
        {isMultipleChoice ? (
          <MultipleChoiceOptions
            options={options}
            selectedAnswer={selectedAnswer}
            onSelect={onSelectAnswer}
            correctAnswer={correctAnswer}
            showCorrectness={showCorrectness}
            isDisabled={isDisabled || isAnswered}
            fontFamily={fontFamily}
          />
        ) : (
          <TextAnswerInput
            type={type}
            value={selectedAnswer}
            onChange={onSelectAnswer}
            isDisabled={isDisabled || isAnswered}
            t={t}
          />
        )}

        {/* Feedback section */}
        {isAnswered && showFeedback && (
          <FeedbackDisplay
            correctAnswer={!isMultipleChoice ? correctAnswer : undefined}
            aiFeedback={aiFeedback}
            aiScore={aiScore}
            type={type}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// Multiple choice options component
interface MultipleChoiceOptionsProps {
  options: string[];
  selectedAnswer: string;
  onSelect: (option: string) => void;
  correctAnswer?: string;
  showCorrectness: boolean;
  isDisabled: boolean;
  fontFamily: string;
}

function MultipleChoiceOptions({
  options,
  selectedAnswer,
  onSelect,
  correctAnswer,
  showCorrectness,
  isDisabled,
  fontFamily,
}: MultipleChoiceOptionsProps) {
  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const isSelected = selectedAnswer === option;
        const isCorrectOption = option === correctAnswer;

        // Determine ring styling based on state
        let ringClass = "";
        if (showCorrectness) {
          if (isCorrectOption) {
            ringClass = "ring-2 ring-green-500";
          } else if (isSelected && !isCorrectOption) {
            ringClass = "ring-2 ring-red-500";
          }
        } else if (isSelected) {
          ringClass = "ring-2 ring-accent";
        }

        // Determine glass background state
        let glassBgClass = "bg-white/[0.03] border-white/10";
        let glassHoverClass = "group-hover:bg-white/[0.06] group-hover:border-white/15";

        if (showCorrectness && isCorrectOption) {
          glassBgClass = "bg-green-500/10 border-green-500/30";
          glassHoverClass = "";
        } else if (showCorrectness && isSelected && !isCorrectOption) {
          glassBgClass = "bg-red-500/10 border-red-500/30";
          glassHoverClass = "";
        }

        return (
          <button
            key={index}
            onClick={() => !isDisabled && onSelect(option)}
            disabled={isDisabled}
            className={`group relative w-full p-4 rounded-xl text-left transition-all overflow-hidden ${ringClass} ${
              isDisabled ? "cursor-not-allowed opacity-60" : ""
            }`}
            style={{ fontFamily }}
          >
            {/* Glass background */}
            <div
              className={`absolute inset-0 backdrop-blur-sm border transition-colors rounded-xl ${glassBgClass} ${glassHoverClass}`}
            />

            {/* Content */}
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {!showCorrectness && (
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? "border-accent" : "border-foreground/30"
                    }`}
                  >
                    {isSelected && <div className="w-3 h-3 rounded-full bg-accent" />}
                  </div>
                )}
                <span className="text-foreground">{option}</span>
              </div>
              {showCorrectness && isCorrectOption && (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              )}
              {showCorrectness && isSelected && !isCorrectOption && (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Text input component for short answer / essay
interface TextAnswerInputProps {
  type: QuestionType;
  value: string;
  onChange: (value: string) => void;
  isDisabled: boolean;
  t: ReturnType<typeof useT>;
}

function TextAnswerInput({ type, value, onChange, isDisabled, t }: TextAnswerInputProps) {
  const rows = type === "essay" || type === "opinion" ? 6 : 3;
  const placeholder =
    type === "essay" || type === "opinion"
      ? t("comprehension.questionDisplay.placeholders.essay")
      : type === "translation"
        ? t("comprehension.questionDisplay.placeholders.translation")
        : t("comprehension.questionDisplay.placeholders.default");

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isDisabled}
      placeholder={placeholder}
      rows={rows}
      className="w-full p-4 rounded-xl border border-border bg-background text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

// Feedback display component
interface FeedbackDisplayProps {
  correctAnswer?: string;
  aiFeedback?: string;
  aiScore?: number;
  type: QuestionType;
  t: ReturnType<typeof useT>;
}

function FeedbackDisplay({ correctAnswer, aiFeedback, aiScore, type, t }: FeedbackDisplayProps) {
  const isTextType = type !== "multiple_choice";

  // For multiple choice, answers are already highlighted - no extra feedback needed
  // unless there's AI feedback to show
  if (!isTextType && !aiFeedback) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {/* AI Score for text answers */}
      {isTextType && aiScore !== undefined && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {t("comprehension.questionDisplay.feedback.score")}
            </span>
            <span
              className={`text-sm font-bold ${
                aiScore >= 80 ? "text-green-600" : aiScore >= 60 ? "text-amber-600" : "text-red-600"
              }`}
            >
              {aiScore}%
            </span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                aiScore >= 80 ? "bg-green-500" : aiScore >= 60 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${aiScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Expected/Possible answer for text types */}
      {isTextType && correctAnswer && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm font-medium text-foreground mb-1">
            {type === "short_answer" || type === "translation" || type === "grammar"
              ? t("comprehension.questionDisplay.feedback.expectedAnswer")
              : t("comprehension.questionDisplay.feedback.possibleAnswer")}
          </p>
          <p className="text-sm text-foreground-muted">{correctAnswer}</p>
        </div>
      )}

      {/* AI Feedback */}
      {aiFeedback && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm font-medium text-foreground mb-1">
            {t("comprehension.questionDisplay.feedback.feedback")}
          </p>
          <p className="text-sm text-foreground-muted">{aiFeedback}</p>
        </div>
      )}
    </div>
  );
}

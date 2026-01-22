import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useStory } from "@/hooks/useStory";
import { Button } from "@/components/ui/button";
import {
  QuestionDisplay,
  QuestionNavigation,
  QuestionProgress,
  type QuestionType,
} from "@/components/quiz";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface Question {
  questionId: string;
  type: QuestionType;
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  userAnswer?: string;
  isCorrect?: boolean;
  aiScore?: number;
  aiFeedback?: string;
  relatedChapter?: number;
  points: number;
  earnedPoints?: number;
}

export function ComprehensionPage() {
  const { storyId } = useParams({ from: "/comprehension/$storyId" });
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? "anonymous";

  const { story, isLoading: storyLoading, error: storyError } = useStory(storyId);

  // Check for existing comprehension quiz
  const existingComprehension = useQuery(
    api.storyComprehension.getForStory,
    isAuthenticated ? { userId, storyId } : "skip"
  );

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [localQuestions, setLocalQuestions] = useState<Question[]>([]);

  // Actions and mutations
  const generateQuestions = useAction(api.ai.generateComprehensionQuestions);
  const gradeAnswer = useAction(api.ai.gradeComprehensionAnswer);
  const submitAnswer = useMutation(api.storyComprehension.submitAnswer);
  const completeQuiz = useMutation(api.storyComprehension.complete);

  // Initialize local questions from existing comprehension
  useEffect(() => {
    if (existingComprehension?.questions) {
      setLocalQuestions(existingComprehension.questions as Question[]);
      // If quiz is already completed, show results
      if (existingComprehension.completedAt) {
        setShowResults(true);
      }
    }
  }, [existingComprehension]);

  // Sync selectedAnswer with current question's saved answer when navigating
  useEffect(() => {
    const currentQuestion = localQuestions[currentQuestionIndex];
    if (currentQuestion?.userAnswer) {
      setSelectedAnswer(currentQuestion.userAnswer);
    } else {
      setSelectedAnswer("");
    }
  }, [currentQuestionIndex, localQuestions]);

  // Auto-generate questions when page loads if no existing quiz
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  useEffect(() => {
    // Only auto-start once
    if (hasAutoStarted) return;
    // Wait for all data to load
    if (storyLoading || existingComprehension === undefined) return;
    // Don't generate if already have questions
    if (localQuestions.length > 0) return;
    // Don't generate if no story or not authenticated
    if (!story || !isAuthenticated) return;
    // Don't generate if there's an existing quiz
    if (existingComprehension !== null) return;

    // Mark as started and trigger generation
    setHasAutoStarted(true);
  }, [storyLoading, existingComprehension, story, isAuthenticated, localQuestions.length, hasAutoStarted]);

  // Separate effect to actually generate when hasAutoStarted becomes true
  useEffect(() => {
    if (hasAutoStarted && !isGenerating && localQuestions.length === 0 && story && isAuthenticated) {
      const doGenerate = async () => {
        setIsGenerating(true);
        try {
          const storyContent = getStoryContent();
          const result = await generateQuestions({
            storyId,
            storyTitle: story.metadata.title,
            storyContent,
            language: getLanguage(),
            userId,
          });
          setLocalQuestions(result.questions as Question[]);
        } catch (error) {
          console.error("Failed to generate questions:", error);
        } finally {
          setIsGenerating(false);
        }
      };
      doGenerate();
    }
  }, [hasAutoStarted]);

  // Get the full story content for AI
  const getStoryContent = () => {
    if (!story) return "";
    const chapters = story.chapters || [];
    return chapters
      .map((chapter) => {
        const segments = chapter.segments || chapter.content || [];
        return segments.map((s) => {
          // Try tokens first, then text field
          if (s.tokens && s.tokens.length > 0) {
            return s.tokens.map((t) => t.surface).join("");
          }
          return s.text || "";
        }).join(" ");
      })
      .join("\n\n");
  };

  // Derive language from story level
  const getLanguage = (): "japanese" | "english" | "french" => {
    if (!story) return "japanese";
    const level = story.metadata.level;
    // JLPT levels (N5-N1) are Japanese
    if (level.startsWith("N")) return "japanese";
    // CEFR levels - check story ID or default based on context
    // For now, default to English for CEFR (can be enhanced later)
    if (story.id.includes("french") || story.id.includes("fr_")) return "french";
    if (story.id.includes("english") || story.id.includes("en_")) return "english";
    // Default: if CEFR level, assume English
    return "english";
  };

  // Generate questions
  const handleGenerateQuestions = async () => {
    if (!story || !isAuthenticated) return;

    setIsGenerating(true);
    try {
      const storyContent = getStoryContent();
      const result = await generateQuestions({
        storyId,
        storyTitle: story.metadata.title,
        storyContent,
        language: getLanguage(),
        userId,
        questionCount: 3,
      });

      setLocalQuestions(result.questions as Question[]);
    } catch (error) {
      console.error("Failed to generate questions:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !existingComprehension) return;

    const question = localQuestions[currentQuestionIndex];
    setIsSubmitting(true);

    try {
      // Submit the answer
      const result = await submitAnswer({
        comprehensionId: existingComprehension._id,
        questionIndex: currentQuestionIndex,
        answer: selectedAnswer,
      });

      // Update local state
      const updatedQuestions = [...localQuestions];
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        userAnswer: selectedAnswer,
        isCorrect: result.isCorrect,
        earnedPoints: result.earnedPoints,
      };
      setLocalQuestions(updatedQuestions);

      // For short answer and essay, grade with AI
      if (question.type !== "multiple_choice") {
        setIsGrading(true);
        try {
          const gradeResult = await gradeAnswer({
            comprehensionId: existingComprehension._id,
            questionIndex: currentQuestionIndex,
            userAnswer: selectedAnswer,
            question: question.question,
            questionType: question.type as "short_answer" | "essay",
            expectedAnswer: question.correctAnswer,
            rubric: question.rubric,
            storyContext: getStoryContent().slice(0, 2000), // Limit context size
            language: getLanguage(),
          });

          // Update local state with grading
          updatedQuestions[currentQuestionIndex] = {
            ...updatedQuestions[currentQuestionIndex],
            aiScore: gradeResult.aiScore,
            aiFeedback: gradeResult.aiFeedback,
            isCorrect: gradeResult.isCorrect,
            earnedPoints: Math.round((gradeResult.aiScore / 100) * question.points),
          };
          setLocalQuestions(updatedQuestions);
        } catch (error) {
          console.error("Failed to grade answer:", error);
        } finally {
          setIsGrading(false);
        }
      }

      // Don't auto-progress - let user see feedback first
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (storyLoading || existingComprehension === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (storyError || !story) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-foreground-muted">
            <p className="text-lg font-medium text-destructive">
              {storyError?.message || "Story not found"}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/library" })}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No questions yet - show generate button
  if (!existingComprehension && localQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
          <div className="container mx-auto px-4 sm:px-6 py-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/read/$storyId", params: { storyId } })}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground">{story.metadata.title}</h1>
                <p className="text-sm text-foreground-muted">Comprehension Quiz</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 py-12 max-w-2xl">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Test Your Understanding
            </h2>
            <p className="text-foreground-muted mb-8 max-w-md mx-auto">
              Generate AI-powered comprehension questions based on the story you just read.
              Questions will test your understanding at different levels.
            </p>
            <Button
              onClick={handleGenerateQuestions}
              disabled={isGenerating || !isAuthenticated}
              className="gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Questions
                </>
              )}
            </Button>
            {!isAuthenticated && (
              <p className="text-sm text-foreground-muted mt-4">
                Please sign in to generate questions.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Show results
  if (showResults) {
    const totalEarned = localQuestions.reduce((sum, q) => sum + (q.earnedPoints ?? 0), 0);
    const totalPossible = localQuestions.reduce((sum, q) => sum + q.points, 0);
    const percentScore = Math.round((totalEarned / totalPossible) * 100);

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
          <div className="container mx-auto px-4 sm:px-6 py-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/read/$storyId", params: { storyId } })}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground">{story.metadata.title}</h1>
                <p className="text-sm text-foreground-muted">Quiz Results</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
          {/* Score Summary */}
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm mb-8 text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
              percentScore >= 70 ? "bg-green-500/10" : percentScore >= 50 ? "bg-amber-500/10" : "bg-red-500/10"
            }`}>
              <span className={`text-3xl font-bold ${
                percentScore >= 70 ? "text-green-500" : percentScore >= 50 ? "text-amber-500" : "text-red-500"
              }`}>
                {percentScore}%
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {percentScore >= 70 ? "Great job!" : percentScore >= 50 ? "Good effort!" : "Keep practicing!"}
            </h2>
            <p className="text-foreground-muted">
              You scored {totalEarned} out of {totalPossible} points
            </p>
          </div>

          {/* Question Review */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Review Answers</h3>
            {localQuestions.map((question, index) => (
              <div key={question.questionId} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    question.isCorrect ? "bg-green-500/10" : "bg-red-500/10"
                  }`}>
                    {question.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">{question.question}</p>
                    {question.questionTranslation && (
                      <p className="text-sm text-foreground-muted mb-2">{question.questionTranslation}</p>
                    )}
                    <p className="text-sm">
                      <span className="text-foreground-muted">Your answer: </span>
                      <span className="text-foreground">{question.userAnswer}</span>
                    </p>
                    {question.type === "multiple_choice" && !question.isCorrect && (
                      <p className="text-sm text-green-600 mt-1">
                        Correct answer: {question.correctAnswer}
                      </p>
                    )}
                    {question.aiFeedback && (
                      <p className="text-sm text-foreground-muted mt-2 p-2 bg-muted/50 rounded">
                        {question.aiFeedback}
                      </p>
                    )}
                    <p className="text-xs text-foreground-muted mt-2">
                      {question.earnedPoints ?? 0}/{question.points} points
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/read/$storyId", params: { storyId } })}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Back to Story
            </Button>
            <Button onClick={() => navigate({ to: "/library" })}>
              Browse More Stories
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Guard: wait for questions to load
  if (localQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
          <p className="text-foreground-muted">Loading questions...</p>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const currentQuestion = localQuestions[currentQuestionIndex];
  const hasAnswered = currentQuestion?.userAnswer !== undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-3 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/read/$storyId", params: { storyId } })}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground">{story.metadata.title}</h1>
                <p className="text-sm text-foreground-muted">
                  Question {currentQuestionIndex + 1} of {localQuestions.length}
                </p>
              </div>
            </div>
            {/* Progress indicator - clickable to jump to question */}
            <QuestionProgress
              questions={localQuestions}
              currentIndex={currentQuestionIndex}
              onNavigate={setCurrentQuestionIndex}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
        <QuestionDisplay
          question={currentQuestion.question}
          questionTranslation={currentQuestion.questionTranslation}
          type={currentQuestion.type}
          options={currentQuestion.options}
          points={currentQuestion.points}
          selectedAnswer={selectedAnswer}
          onSelectAnswer={setSelectedAnswer}
          isAnswered={hasAnswered}
          showFeedback={hasAnswered}
          correctAnswer={currentQuestion.correctAnswer}
          isCorrect={currentQuestion.isCorrect}
          aiFeedback={currentQuestion.aiFeedback}
          aiScore={currentQuestion.aiScore}
          language="japanese"
        />

        <QuestionNavigation
          currentIndex={currentQuestionIndex}
          totalQuestions={localQuestions.length}
          isAnswered={hasAnswered}
          onPrevious={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
          onNext={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
          onSubmit={handleSubmitAnswer}
          onFinish={async () => {
            if (existingComprehension) {
              await completeQuiz({ comprehensionId: existingComprehension._id });
              setShowResults(true);
            }
          }}
          isSubmitting={isSubmitting}
          isGrading={isGrading}
          canSubmit={!!selectedAnswer}
        />
      </main>
    </div>
  );
}

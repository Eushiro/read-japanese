import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { Link,useParams } from "@tanstack/react-router";
import { useMutation,useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo,useState } from "react";

import { getStory } from "@/api/stories";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

import { api } from "../../../convex/_generated/api";

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "translation", label: "Translation" },
  { value: "short_answer", label: "Short Answer" },
  { value: "inference", label: "Inference" },
  { value: "prediction", label: "Prediction" },
  { value: "grammar", label: "Grammar" },
  { value: "opinion", label: "Opinion" },
];

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Level 1 (N5/A1)",
  2: "Level 2 (N4/A2)",
  3: "Level 3 (N3/B1)",
  4: "Level 4 (N2/B2)",
  5: "Level 5 (N1/C1)",
  6: "Level 6 (C2)",
};

interface Question {
  questionId: string;
  type: string;
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  relatedChapter?: number;
  points: number;
}

export function StoryQuestionsPage() {
  const params = useParams({ from: "/admin/stories/$storyId" });
  const storyId = params.storyId;
  const { user } = useAuth();

  const [selectedDifficulty, setSelectedDifficulty] = useState(1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Fetch story from backend
  const { data: story, isLoading: storyLoading } = useTanstackQuery({
    queryKey: ["story", storyId],
    queryFn: () => getStory(storyId),
    enabled: !!storyId,
  });

  // Fetch all questions for this story
  const allQuestions = useQuery(api.storyQuestions.getAllForStory, { storyId });

  // Get questions for selected difficulty
  const questionsForDifficulty = useMemo(() => {
    if (!allQuestions) return null;
    return allQuestions.find((q) => q.difficulty === selectedDifficulty);
  }, [allQuestions, selectedDifficulty]);

  // Mutations
  const updateQuestion = useMutation(api.storyQuestions.updateQuestion);
  const deleteQuestion = useMutation(api.storyQuestions.deleteQuestion);
  const deleteAllQuestions = useMutation(api.storyQuestions.remove);

  // Get available difficulties
  const availableDifficulties = useMemo(() => {
    if (!allQuestions) return [];
    return allQuestions.map((q) => q.difficulty).sort((a, b) => a - b);
  }, [allQuestions]);

  const handleSaveQuestion = async (questionIndex: number, updates: Partial<Question>) => {
    setSaveStatus("saving");
    try {
      await updateQuestion({
        storyId,
        difficulty: selectedDifficulty,
        questionIndex,
        ...updates,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save question:", err);
      setSaveStatus("error");
    }
  };

  const handleDeleteQuestion = async (questionIndex: number) => {
    if (!confirm("Delete this question?")) return;

    try {
      await deleteQuestion({
        storyId,
        difficulty: selectedDifficulty,
        questionIndex,
      });
    } catch (err) {
      console.error("Failed to delete question:", err);
    }
  };

  const handleDeleteAllQuestions = async () => {
    if (!user?.email) return;
    if (!confirm(`Delete all questions for difficulty ${selectedDifficulty}?`)) return;

    try {
      await deleteAllQuestions({
        storyId,
        difficulty: selectedDifficulty,
        adminEmail: user.email,
      });
    } catch (err) {
      console.error("Failed to delete questions:", err);
    }
  };

  if (storyLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Story not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/stories">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stories
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{story.metadata.title}</h1>
          {story.metadata.titleJapanese && (
            <p className="text-lg text-foreground-muted">{story.metadata.titleJapanese}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{story.metadata.level}</Badge>
            <Badge variant="secondary">{story.metadata.genre}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-sm text-foreground-muted">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-destructive flex items-center gap-1">
              <X className="w-4 h-4" /> Error
            </span>
          )}
        </div>
      </div>

      {/* Difficulty Tabs */}
      <div className="flex items-center gap-4">
        <Label>Difficulty:</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((d) => {
            const hasQuestions = availableDifficulties.includes(d);
            return (
              <Button
                key={d}
                variant={selectedDifficulty === d ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDifficulty(d)}
                className={hasQuestions ? "" : "opacity-50"}
              >
                {d}
                {hasQuestions && <span className="ml-1 text-xs">✓</span>}
              </Button>
            );
          })}
        </div>
        {questionsForDifficulty && (
          <Button variant="destructive" size="sm" onClick={handleDeleteAllQuestions}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
        )}
      </div>

      {/* Questions */}
      {!questionsForDifficulty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-foreground-muted">
              No questions at {DIFFICULTY_LABELS[selectedDifficulty]}
            </p>
            <p className="text-sm text-foreground-muted mt-2">
              Questions are generated when a user takes a comprehension quiz at this difficulty.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-foreground-muted">
            {questionsForDifficulty.questions.length} questions at{" "}
            {DIFFICULTY_LABELS[selectedDifficulty]}
          </div>

          {questionsForDifficulty.questions.map((q, index) => (
            <QuestionEditor
              key={q.questionId}
              question={q}
              index={index}
              isExpanded={editingIndex === index}
              onToggle={() => setEditingIndex(editingIndex === index ? null : index)}
              onSave={(updates) => handleSaveQuestion(index, updates)}
              onDelete={() => handleDeleteQuestion(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (updates: Partial<Question>) => Promise<void>;
  onDelete: () => void;
}

function QuestionEditor({
  question,
  index,
  isExpanded,
  onToggle,
  onSave,
  onDelete,
}: QuestionEditorProps) {
  const [editedQuestion, setEditedQuestion] = useState(question.question);
  const [editedTranslation, setEditedTranslation] = useState(question.questionTranslation || "");
  const [editedOptions, setEditedOptions] = useState(question.options?.join("\n") || "");
  const [editedCorrectAnswer, setEditedCorrectAnswer] = useState(question.correctAnswer || "");
  const [editedRubric, setEditedRubric] = useState(question.rubric || "");
  const [editedPoints, setEditedPoints] = useState(question.points);

  const handleSave = async () => {
    await onSave({
      question: editedQuestion,
      questionTranslation: editedTranslation || undefined,
      options:
        question.type === "multiple_choice" ? editedOptions.split("\n").filter(Boolean) : undefined,
      correctAnswer: editedCorrectAnswer || undefined,
      rubric: editedRubric || undefined,
      points: editedPoints,
    });
  };

  const typeInfo = QUESTION_TYPES.find((t) => t.value === question.type);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-foreground-muted">#{index + 1}</span>
                <div>
                  <CardTitle className="text-base">
                    {question.question.slice(0, 100)}
                    {question.question.length > 100 ? "..." : ""}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {typeInfo?.label || question.type}
                    </Badge>
                    <span className="text-xs text-foreground-muted">{question.points} pts</span>
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-foreground-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-foreground-muted" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                value={editedQuestion}
                onChange={(e) => setEditedQuestion(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Translation (optional)</Label>
              <Textarea
                value={editedTranslation}
                onChange={(e) => setEditedTranslation(e.target.value)}
                rows={2}
                placeholder="English translation of the question"
              />
            </div>

            {question.type === "multiple_choice" && (
              <>
                <div className="space-y-2">
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={editedOptions}
                    onChange={(e) => setEditedOptions(e.target.value)}
                    rows={4}
                    placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Input
                    value={editedCorrectAnswer}
                    onChange={(e) => setEditedCorrectAnswer(e.target.value)}
                    placeholder="Must match one of the options exactly"
                  />
                </div>
              </>
            )}

            {question.type !== "multiple_choice" && (
              <div className="space-y-2">
                <Label>Grading Rubric</Label>
                <Textarea
                  value={editedRubric}
                  onChange={(e) => setEditedRubric(e.target.value)}
                  rows={3}
                  placeholder="Guidelines for AI grading"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Points</Label>
              <Input
                type="number"
                value={editedPoints}
                onChange={(e) => setEditedPoints(parseInt(e.target.value) || 0)}
                min={1}
                max={100}
                className="w-24"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

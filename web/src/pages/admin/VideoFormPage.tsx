import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES } from "@/lib/contentLanguages";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ContentLanguage, ProficiencyLevel } from "../../../convex/schema";

interface Question {
  questionId: string;
  question: string;
  type:
    | "multiple_choice"
    | "translation"
    | "short_answer"
    | "inference"
    | "listening"
    | "grammar"
    | "opinion";
  questionTranslation?: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  timestamp?: number;
  points: number;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

const LEVELS = {
  japanese: ["N5", "N4", "N3", "N2", "N1"],
  english: ["A1", "A2", "B1", "B2", "C1", "C2"],
  french: ["A1", "A2", "B1", "B2", "C1", "C2"],
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Level 1 (N5/A1)",
  2: "Level 2 (N4/A2)",
  3: "Level 3 (N3/B1)",
  4: "Level 4 (N2/B2)",
  5: "Level 5 (N1/C1)",
  6: "Level 6 (C2)",
};

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "listening", label: "Listening" },
  { value: "translation", label: "Translation" },
  { value: "short_answer", label: "Short Answer" },
  { value: "inference", label: "Inference" },
  { value: "grammar", label: "Grammar" },
  { value: "opinion", label: "Opinion" },
];

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseTranscript(text: string): TranscriptSegment[] {
  const lines = text.trim().split("\n");
  const segments: TranscriptSegment[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+:[\d:]+)\s+(.+)$/);
    if (match) {
      const timeStr = match[1];
      const text = match[2].trim();

      const parts = timeStr.split(":").map(Number);
      let seconds = 0;
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      segments.push({
        text,
        start: seconds,
        duration: 3,
      });
    }
  }

  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].duration = segments[i + 1].start - segments[i].start;
  }

  return segments;
}

export function VideoFormPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Router types don't properly infer nested route params
  const params = useParams({ from: "/admin/videos/$id" as any }) as { id: string };
  const navigate = useNavigate();
  const isNew = params.id === "new";

  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("japanese");
  const [level, setLevel] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Difficulty-based questions
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);
  const [questionsByDifficulty, setQuestionsByDifficulty] = useState<Record<number, Question[]>>(
    {}
  );
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  // Determine if params.id is a YouTube video ID (11 chars) or Convex document ID
  const isYouTubeId = !isNew && params.id && params.id.length === 11;

  // Fetch existing video by Convex ID if it looks like one
  const existingVideoByConvexId = useQuery(
    api.youtubeContent.get,
    !isNew && params.id && !isYouTubeId ? { id: params.id as Id<"youtubeContent"> } : "skip"
  );

  // Fetch existing video by YouTube video ID if it looks like one
  const existingVideoByYouTubeId = useQuery(
    api.youtubeContent.getByVideoId,
    !isNew && params.id && isYouTubeId ? { videoId: params.id } : "skip"
  );

  // Use whichever query returned a result
  const existingVideo = existingVideoByConvexId ?? existingVideoByYouTubeId;

  // Fetch video questions by difficulty
  const allVideoQuestions = useQuery(
    api.videoQuestions.getAllForVideo,
    videoId ? { videoId } : "skip"
  );

  // Mutations
  const seedVideo = useMutation(api.youtubeContent.seed);
  const updateTranscript = useMutation(api.youtubeContent.updateTranscript);
  const createVideoQuestions = useMutation(api.videoQuestions.create);

  // Load existing video data
  useEffect(() => {
    if (existingVideo) {
      setVideoId(existingVideo.videoId);
      setYoutubeUrl(`https://youtube.com/watch?v=${existingVideo.videoId}`);
      setTitle(existingVideo.title);
      setDescription(existingVideo.description ?? "");
      setLanguage(existingVideo.language);
      setLevel(existingVideo.level ?? "");
      setTranscript(existingVideo.transcript ?? []);

      if (existingVideo.transcript) {
        const text = existingVideo.transcript
          .map((seg) => {
            const mins = Math.floor(seg.start / 60);
            const secs = Math.floor(seg.start % 60);
            return `${mins}:${secs.toString().padStart(2, "0")} ${seg.text}`;
          })
          .join("\n");
        setTranscriptText(text);
      }
    }
  }, [existingVideo]);

  // Load questions from videoQuestions table
  useEffect(() => {
    if (allVideoQuestions) {
      const byDifficulty: Record<number, Question[]> = {};
      for (const record of allVideoQuestions) {
        byDifficulty[record.difficulty] = record.questions.map((q) => ({
          ...q,
          type: q.type as Question["type"],
        }));
      }
      setQuestionsByDifficulty(byDifficulty);
    }
  }, [allVideoQuestions]);

  // Extract video ID from URL
  useEffect(() => {
    if (isNew && youtubeUrl) {
      const id = extractVideoId(youtubeUrl);
      if (id) setVideoId(id);
    }
  }, [youtubeUrl, isNew]);

  const fetchVideoInfo = async () => {
    if (!videoId) return;

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (response.ok) {
        const data = await response.json();
        setTitle(data.title);
      }
    } catch (error) {
      console.error("Failed to fetch video info:", error);
    }
  };

  const handleTranscriptChange = (text: string) => {
    setTranscriptText(text);
    const parsed = parseTranscript(text);
    setTranscript(parsed);
  };

  // Get questions for current difficulty
  const currentQuestions = questionsByDifficulty[selectedDifficulty] ?? [];

  const addQuestion = () => {
    const newQuestion: Question = {
      questionId: nanoid(),
      question: "",
      type: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 10,
    };
    setQuestionsByDifficulty({
      ...questionsByDifficulty,
      [selectedDifficulty]: [...currentQuestions, newQuestion],
    });
    setExpandedQuestion(currentQuestions.length);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...currentQuestions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestionsByDifficulty({
      ...questionsByDifficulty,
      [selectedDifficulty]: newQuestions,
    });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = currentQuestions.filter((_, i) => i !== index);
    setQuestionsByDifficulty({
      ...questionsByDifficulty,
      [selectedDifficulty]: newQuestions,
    });
  };

  const handleSave = async () => {
    if (!videoId || !title || !language) {
      alert("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");
    try {
      // Save/update video metadata
      const id = await seedVideo({
        videoId,
        title,
        description: description || undefined,
        language,
        level: (level || undefined) as ProficiencyLevel | undefined,
      });

      // Update transcript if provided
      if (transcript.length > 0) {
        await updateTranscript({ id, transcript });
      }

      // Save questions for each difficulty level
      for (const [diffStr, questions] of Object.entries(questionsByDifficulty)) {
        const difficulty = parseInt(diffStr);
        if (questions.length > 0) {
          await createVideoQuestions({
            videoId,
            difficulty,
            language,
            questions: questions.map((q) => ({
              questionId: q.questionId,
              type: q.type,
              question: q.question,
              questionTranslation: q.questionTranslation,
              options: q.options,
              correctAnswer: q.correctAnswer,
              rubric: q.rubric,
              timestamp: q.timestamp,
              points: q.points,
            })),
          });
        }
      }

      setSaveStatus("saved");
      setTimeout(() => {
        navigate({ to: "/admin/videos" });
      }, 500);
    } catch (error) {
      console.error("Failed to save video:", error);
      setSaveStatus("error");
      alert("Failed to save video");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/videos">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isNew ? "Add Video" : "Edit Video"}
            </h1>
            <p className="text-foreground-muted">
              {isNew
                ? "Add a new YouTube video with transcript"
                : "Edit video details and questions"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Video Info */}
      <Card>
        <CardHeader>
          <CardTitle>Video Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNew && (
            <div className="space-y-2">
              <Label>YouTube URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://youtube.com/watch?v=... or video ID"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <Button variant="outline" onClick={fetchVideoInfo} disabled={!videoId}>
                  Fetch Info
                </Button>
              </div>
              {videoId && <p className="text-xs text-foreground-muted">Video ID: {videoId}</p>}
            </div>
          )}

          {!isNew && (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <span>Video ID: {videoId}</span>
              <a
                href={`https://youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Open on YouTube <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              placeholder="Video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the video content"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Language *</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as ContentLanguage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS[language].map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Transcript Format</AlertTitle>
            <AlertDescription>
              Paste the transcript from YouTube. Each line should have a timestamp followed by text:
              <code className="block mt-2 bg-muted p-2 rounded text-xs">
                0:05 First line of text{"\n"}
                0:13 Second line continues{"\n"}
                1:30 And so on with timestamps
              </code>
            </AlertDescription>
          </Alert>

          <Textarea
            placeholder="Paste transcript here..."
            value={transcriptText}
            onChange={(e) => handleTranscriptChange(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />

          {transcript.length > 0 && (
            <p className="text-sm text-foreground-muted">Parsed {transcript.length} segments</p>
          )}
        </CardContent>
      </Card>

      {/* Questions by Difficulty */}
      <Card>
        <CardHeader>
          <CardTitle>Comprehension Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Difficulty Selector */}
          <div className="flex items-center gap-4">
            <Label>Difficulty:</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const hasQuestions = (questionsByDifficulty[d]?.length ?? 0) > 0;
                const isSelected = selectedDifficulty === d;
                return (
                  <Button
                    key={d}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedDifficulty(d);
                      setExpandedQuestion(null);
                    }}
                    className={hasQuestions ? "" : "opacity-50"}
                  >
                    {d}
                    {hasQuestions && (
                      <span className="ml-1 text-xs">({questionsByDifficulty[d].length})</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <p className="text-sm text-foreground-muted">
            {DIFFICULTY_LABELS[selectedDifficulty]} - {currentQuestions.length} questions
          </p>

          {/* Questions List */}
          <div className="space-y-3">
            {currentQuestions.length === 0 ? (
              <p className="text-center py-8 text-foreground-muted">
                No questions at this difficulty level
              </p>
            ) : (
              currentQuestions.map((q, index) => (
                <Collapsible
                  key={q.questionId}
                  open={expandedQuestion === index}
                  onOpenChange={(open) => setExpandedQuestion(open ? index : null)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground-muted">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium truncate max-w-md">
                              {q.question || "(No question text)"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {q.type}
                              </Badge>
                              <span className="text-xs text-foreground-muted">{q.points} pts</span>
                            </div>
                          </div>
                        </div>
                        {expandedQuestion === index ? (
                          <ChevronUp className="w-4 h-4 text-foreground-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-foreground-muted" />
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-4 pt-0 space-y-4 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Question Type</Label>
                            <Select
                              value={q.type}
                              onValueChange={(v) =>
                                updateQuestion(index, {
                                  type: v as Question["type"],
                                  ...(v === "multiple_choice" && !q.options
                                    ? { options: ["", "", "", ""] }
                                    : {}),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {QUESTION_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Points</Label>
                            <Input
                              type="number"
                              value={q.points}
                              onChange={(e) =>
                                updateQuestion(index, { points: parseInt(e.target.value) || 10 })
                              }
                              min={1}
                              max={100}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Question</Label>
                          <Textarea
                            value={q.question}
                            onChange={(e) => updateQuestion(index, { question: e.target.value })}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Translation (optional)</Label>
                          <Input
                            placeholder="English translation"
                            value={q.questionTranslation ?? ""}
                            onChange={(e) =>
                              updateQuestion(index, { questionTranslation: e.target.value })
                            }
                          />
                        </div>

                        {q.type === "multiple_choice" && (
                          <div className="space-y-2">
                            <Label>Options</Label>
                            {(q.options ?? ["", "", "", ""]).map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${q.questionId}`}
                                  checked={q.correctAnswer === opt && opt !== ""}
                                  onChange={() => updateQuestion(index, { correctAnswer: opt })}
                                  className="w-4 h-4"
                                />
                                <Input
                                  placeholder={`Option ${optIndex + 1}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOptions = [...(q.options ?? [])];
                                    newOptions[optIndex] = e.target.value;
                                    updateQuestion(index, { options: newOptions });
                                  }}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                            <p className="text-xs text-foreground-muted">
                              Select the correct answer
                            </p>
                          </div>
                        )}

                        {q.type !== "multiple_choice" && (
                          <div className="space-y-2">
                            <Label>Rubric / Expected Answer</Label>
                            <Textarea
                              placeholder="Grading rubric or sample answer..."
                              value={q.rubric ?? q.correctAnswer ?? ""}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  rubric: e.target.value,
                                  correctAnswer: e.target.value,
                                })
                              }
                              rows={3}
                            />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Question
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
          </div>

          <Button variant="outline" onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-2" />
            Add Question to {DIFFICULTY_LABELS[selectedDifficulty]}
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || !videoId || !title}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Video
            </>
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/videos">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, CheckCircle2, FileText, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../convex/_generated/api";

type Language = "japanese" | "english" | "french";

const LEVELS_BY_LANGUAGE: Record<Language, string[]> = {
  japanese: ["N5", "N4", "N3", "N2", "N1"],
  english: ["A1", "A2", "B1", "B2", "C1", "C2"],
  french: ["A1", "A2", "B1", "B2", "C1", "C2"],
};

interface ParsedWord {
  word: string;
  reading?: string;
  definitions: string[];
}

function parseCSV(content: string): ParsedWord[] {
  const lines = content.trim().split("\n");
  const results: ParsedWord[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Support both comma and tab-separated
    const parts = trimmed.includes("\t")
      ? trimmed.split("\t")
      : trimmed.split(",").map((p) => p.trim());

    if (parts.length >= 1) {
      const word = parts[0].trim();
      if (!word) continue;

      // Format: word, reading (optional), definitions (rest)
      const reading = parts.length >= 2 && parts[1]?.trim() ? parts[1].trim() : undefined;
      const definitions =
        parts.length >= 3
          ? parts
              .slice(2)
              .filter((d) => d.trim())
              .map((d) => d.trim())
          : ["(no definition)"];

      results.push({ word, reading, definitions });
    }
  }

  return results;
}

export function DecksPage() {
  const decks = useQuery(api.premadeDecks.listAllDecks, {});
  const setPublished = useMutation(api.premadeDecks.setDeckPublished);
  const createDeck = useMutation(api.premadeDecks.createDeck);
  const importVocabulary = useMutation(api.premadeDecks.importVocabulary);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [deckId, setDeckId] = useState("");
  const [language, setLanguage] = useState<Language>("japanese");
  const [level, setLevel] = useState("N5");
  const [description, setDescription] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [copyExisting, setCopyExisting] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    copiedContent: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = decks === undefined;

  const handleTogglePublished = async (deckId: string, isPublished: boolean) => {
    await setPublished({ deckId, isPublished });
  };

  // Auto-generate deckId from name
  const handleNameChange = (name: string) => {
    setDeckName(name);
    // Convert to snake_case
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    setDeckId(slug);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const content = await file.text();
    setCsvContent(content);
  };

  const handleCreateDeck = async () => {
    if (!deckName.trim() || !deckId.trim()) {
      setError("Name and ID are required");
      return;
    }

    setIsCreating(true);
    setError("");
    setResult(null);

    try {
      // 1. Create the deck
      await createDeck({
        deckId,
        name: deckName,
        description: description || `${deckName} vocabulary deck`,
        language,
        level,
      });

      // 2. Import vocabulary if CSV provided
      if (csvContent.trim()) {
        const parsed = parseCSV(csvContent);

        if (parsed.length === 0) {
          setError("No valid words found in CSV");
          setIsCreating(false);
          return;
        }

        const importResult = await importVocabulary({
          deckId,
          items: parsed,
          linkExistingContent: copyExisting,
        });

        setResult({
          imported: importResult.imported,
          skipped: importResult.skipped,
          copiedContent: importResult.linkedContent,
        });
      }

      // Reset form and close dialog
      setDeckName("");
      setDeckId("");
      setDescription("");
      setCsvContent("");
      setCsvFile(null);
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deck");
    } finally {
      setIsCreating(false);
    }
  };

  const resetDialog = () => {
    setDeckName("");
    setDeckId("");
    setDescription("");
    setCsvContent("");
    setCsvFile(null);
    setError("");
    setResult(null);
    setLanguage("japanese");
    setLevel("N5");
  };

  const parsedWords = csvContent.trim() ? parseCSV(csvContent) : [];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flashcard Decks</h1>
          <p className="text-foreground-muted">
            Manage vocabulary decks and content generation pipeline
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Deck
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Deck</DialogTitle>
              <DialogDescription>
                Create a vocabulary deck and optionally import words from CSV.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Deck Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deckName">Deck Name</Label>
                  <Input
                    id="deckName"
                    placeholder="JLPT N5 Vocabulary"
                    value={deckName}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deckId">Deck ID (slug)</Label>
                  <Input
                    id="deckId"
                    placeholder="jlpt_n5"
                    value={deckId}
                    onChange={(e) => setDeckId(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={language}
                    onValueChange={(v) => {
                      setLanguage(v as Language);
                      setLevel(LEVELS_BY_LANGUAGE[v as Language][0]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="japanese">Japanese</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS_BY_LANGUAGE[language].map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Essential vocabulary for JLPT N5"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* CSV Import */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-base font-medium">Import Vocabulary (Optional)</Label>
                <p className="text-sm text-foreground-muted mb-3">
                  CSV format: word, reading, definition1, definition2...
                </p>

                <div className="space-y-3">
                  {/* File upload */}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload CSV
                    </Button>
                    {csvFile && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{csvFile.name}</span>
                        <button
                          onClick={() => {
                            setCsvFile(null);
                            setCsvContent("");
                          }}
                          className="text-foreground-muted hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Or paste directly */}
                  <Textarea
                    placeholder="Or paste CSV content here...&#10;食べる,たべる,to eat&#10;飲む,のむ,to drink"
                    value={csvContent}
                    onChange={(e) => {
                      setCsvContent(e.target.value);
                      setCsvFile(null);
                    }}
                    rows={5}
                    className="font-mono text-sm"
                  />

                  {/* Preview */}
                  {parsedWords.length > 0 && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">
                        Preview: {parsedWords.length} words
                      </p>
                      <div className="text-xs text-foreground-muted space-y-1 max-h-24 overflow-y-auto">
                        {parsedWords.slice(0, 5).map((w, i) => (
                          <div key={i}>
                            <span className="font-medium">{w.word}</span>
                            {w.reading && (
                              <span className="text-foreground-muted"> ({w.reading})</span>
                            )}
                            <span className="text-foreground-muted">
                              {" "}
                              - {w.definitions.join(", ")}
                            </span>
                          </div>
                        ))}
                        {parsedWords.length > 5 && (
                          <div className="text-foreground-muted">
                            ...and {parsedWords.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Copy existing content option */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={copyExisting}
                      onCheckedChange={setCopyExisting}
                      id="copyExisting"
                    />
                    <Label htmlFor="copyExisting" className="text-sm">
                      Copy generated content from other decks (saves AI costs)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Result */}
              {result && (
                <Alert>
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertDescription>
                    Imported {result.imported} words
                    {result.skipped > 0 && `, skipped ${result.skipped} duplicates`}
                    {result.copiedContent > 0 && `, copied content for ${result.copiedContent}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateDeck}
                disabled={isCreating || !deckName.trim() || !deckId.trim()}
              >
                {isCreating ? "Creating..." : "Create Deck"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deck</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Words</TableHead>
                <TableHead>Sentences</TableHead>
                <TableHead>Audio</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!decks || decks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-foreground-muted">
                    No decks found
                  </TableCell>
                </TableRow>
              ) : (
                decks.map((deck) => {
                  const sentencesPct =
                    deck.totalWords > 0
                      ? Math.round((deck.wordsWithSentences / deck.totalWords) * 100)
                      : 0;
                  const audioPct =
                    deck.totalWords > 0
                      ? Math.round((deck.wordsWithAudio / deck.totalWords) * 100)
                      : 0;
                  const imagesPct =
                    deck.totalWords > 0
                      ? Math.round((deck.wordsWithImages / deck.totalWords) * 100)
                      : 0;

                  return (
                    <TableRow key={deck.deckId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{deck.name}</p>
                          <p className="text-xs text-foreground-muted">{deck.deckId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {deck.language}
                        </Badge>
                      </TableCell>
                      <TableCell>{deck.level}</TableCell>
                      <TableCell>{deck.totalWords}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-24">
                          <Progress value={sentencesPct} className="h-2" />
                          <span className="text-xs text-foreground-muted w-8">{sentencesPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-24">
                          <Progress value={audioPct} className="h-2" />
                          <span className="text-xs text-foreground-muted w-8">{audioPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-24">
                          <Progress value={imagesPct} className="h-2" />
                          <span className="text-xs text-foreground-muted w-8">{imagesPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={deck.isPublished}
                          onCheckedChange={(checked) => handleTogglePublished(deck.deckId, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/admin/decks/$deckId" params={{ deckId: deck.deckId }}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

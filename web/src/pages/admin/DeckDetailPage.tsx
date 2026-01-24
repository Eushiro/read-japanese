import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export function DeckDetailPage() {
  const params = useParams({ from: "/admin/decks/$deckId" as any });
  const deckId = params.deckId;

  const [batchSize, setBatchSize] = useState("50");
  const [localServerStatus, setLocalServerStatus] = useState<"checking" | "online" | "offline">("checking");

  // Queries
  const deck = useQuery(api.premadeDecks.getDeck, { deckId });
  const stats = useQuery(api.premadeDecks.getDeckGenerationStats, { deckId });
  const setPublished = useMutation(api.premadeDecks.setDeckPublished);

  // Check local server status
  useState(() => {
    const checkServer = async () => {
      try {
        const response = await fetch("http://localhost:8001/health", { method: "GET" });
        setLocalServerStatus(response.ok ? "online" : "offline");
      } catch {
        setLocalServerStatus("offline");
      }
    };
    checkServer();
  });

  const isLoading = deck === undefined || stats === undefined;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Deck not found</AlertTitle>
          <AlertDescription>The deck "{deckId}" does not exist.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const sentencesPct = deck.totalWords > 0
    ? Math.round((deck.wordsWithSentences / deck.totalWords) * 100)
    : 0;
  const audioPct = deck.totalWords > 0
    ? Math.round((deck.wordsWithAudio / deck.totalWords) * 100)
    : 0;
  const imagesPct = deck.totalWords > 0
    ? Math.round((deck.wordsWithImages / deck.totalWords) * 100)
    : 0;

  const triggerGeneration = async (type: "sentences" | "audio" | "images") => {
    if (localServerStatus !== "online") {
      alert("Local server is not running. Start it first.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8001/generate/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          count: parseInt(batchSize),
        }),
      });

      if (response.ok) {
        alert(`Started generating ${type} for ${batchSize} words`);
      } else {
        alert(`Failed to start generation: ${response.statusText}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/decks">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{deck.name}</h1>
          <p className="text-foreground-muted">{deck.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Published</span>
          <Switch
            checked={deck.isPublished}
            onCheckedChange={(checked) => setPublished({ deckId, isPublished: checked })}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Badge variant="outline" className="capitalize">{deck.language}</Badge>
        <Badge variant="outline">{deck.level}</Badge>
        <Badge variant="secondary">{deck.totalWords} words</Badge>
      </div>

      {/* Local Server Status */}
      {localServerStatus === "offline" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Local Server Required</AlertTitle>
          <AlertDescription>
            The batch generation server is not running. Start it with:
            <code className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
              cd backend && python scripts/batch_server.py
            </code>
          </AlertDescription>
        </Alert>
      )}

      {/* Pipeline Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sentences</CardTitle>
            <CardDescription>
              {deck.wordsWithSentences} / {deck.totalWords} words
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={sentencesPct} className="h-3 mb-4" />
            <div className="flex gap-2">
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="w-20"
                min="1"
                max="500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerGeneration("sentences")}
                disabled={localServerStatus !== "online" || sentencesPct === 100}
              >
                <Play className="w-4 h-4 mr-1" />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audio</CardTitle>
            <CardDescription>
              {deck.wordsWithAudio} / {deck.totalWords} words
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={audioPct} className="h-3 mb-4" />
            <div className="flex gap-2">
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="w-20"
                min="1"
                max="100"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerGeneration("audio")}
                disabled={localServerStatus !== "online" || audioPct === 100}
              >
                <Play className="w-4 h-4 mr-1" />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Images</CardTitle>
            <CardDescription>
              {deck.wordsWithImages} / {deck.totalWords} words
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={imagesPct} className="h-3 mb-4" />
            <div className="flex gap-2">
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="w-20"
                min="1"
                max="50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerGeneration("images")}
                disabled={localServerStatus !== "online" || imagesPct === 100}
              >
                <Play className="w-4 h-4 mr-1" />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-foreground-muted">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{stats.generating}</p>
                <p className="text-xs text-foreground-muted">Generating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{stats.complete}</p>
                <p className="text-xs text-foreground-muted">Complete</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                <p className="text-xs text-foreground-muted">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-foreground-muted">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLI Commands */}
      <Card>
        <CardHeader>
          <CardTitle>CLI Commands</CardTitle>
          <CardDescription>Run these commands manually if needed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Import words from CSV:</p>
            <code className="block p-2 bg-muted rounded text-sm font-mono overflow-x-auto">
              npx tsx scripts/importWordList.ts --import {deckId} --file data/{deckId}.csv
            </code>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Generate sentences (batch):</p>
            <code className="block p-2 bg-muted rounded text-sm font-mono overflow-x-auto">
              npx tsx scripts/batchGenerate.ts --deck {deckId} --type sentences --count {batchSize}
            </code>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Generate with Python:</p>
            <code className="block p-2 bg-muted rounded text-sm font-mono overflow-x-auto">
              python backend/scripts/batch_generate_deck.py --deck {deckId} --type sentences --count {batchSize}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

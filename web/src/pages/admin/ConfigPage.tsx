import {
  CheckCircle2,
  Copy,
  Cpu,
  Image,
  MessageSquare,
  RefreshCw,
  Terminal,
  Volume2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ServerStatus {
  status: "checking" | "online" | "offline";
  version?: string;
}

const AI_MODELS = [
  {
    purpose: "Sentences",
    icon: MessageSquare,
    models: [
      { name: "google/gemini-3-flash-preview", provider: "Google", note: "Default, batch API" },
    ],
  },
  {
    purpose: "Audio (TTS)",
    icon: Volume2,
    models: [{ name: "gemini-2.5-flash-preview-tts", provider: "Google", note: "Default" }],
  },
  {
    purpose: "Images",
    icon: Image,
    models: [{ name: "gemini-2.5-flash-image", provider: "Google", note: "Default" }],
  },
  {
    purpose: "Questions & Verification",
    icon: Cpu,
    models: [
      { name: "moonshotai/kimi-k2.5", provider: "OpenRouter", note: "Default" },
      { name: "claude-3-5-sonnet", provider: "OpenRouter", note: "Alternative" },
      { name: "gpt-4o", provider: "OpenRouter", note: "Fallback" },
    ],
  },
];

const CLI_COMMANDS = [
  {
    title: "Add Video",
    command:
      'npx tsx scripts/addVideo.ts "https://youtube.com/watch?v=VIDEO_ID" japanese N4 --manual',
  },
  {
    title: "Import Word List",
    command:
      "npx tsx scripts/importWordList.ts --import jlpt_n5 --file data/jlpt_n5.csv --copy-existing",
  },
  {
    title: "Create Deck",
    command:
      'npx tsx scripts/importWordList.ts --create-deck jlpt_n5 --name "JLPT N5" --language japanese --level N5',
  },
  {
    title: "Batch Generate Sentences",
    command: "npx tsx scripts/batchGenerate.ts --deck jlpt_n5 --type sentences --count 100",
  },
  {
    title: "Generate Story",
    command:
      'python backend/scripts/generate_story.py --level N4 --genre "slice of life" --style anime',
  },
  {
    title: "Generate Audio for Story",
    command: "python backend/scripts/generate_audio.py --story STORY_ID",
  },
  {
    title: "Seed All Videos",
    command: "npx convex run youtubeContent:seedAllVideos",
  },
  {
    title: "Deploy to Production",
    command: "npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --yes",
  },
];

export function ConfigPage() {
  const [localServerStatus, setLocalServerStatus] = useState<ServerStatus>({ status: "checking" });

  // Check local server status
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch("http://localhost:8001/health");
        if (response.ok) {
          const data = await response.json();
          setLocalServerStatus({ status: "online", version: data.version });
        } else {
          setLocalServerStatus({ status: "offline" });
        }
      } catch {
        setLocalServerStatus({ status: "offline" });
      }
    };

    checkServer();
  }, []);

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
        <p className="text-foreground-muted">AI models, server status, and CLI commands</p>
      </div>

      {/* Local Server Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Local Batch Server
          </CardTitle>
          <CardDescription>Required for batch generation from the admin UI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {localServerStatus.status === "checking" ? (
              <Badge variant="outline">Checking...</Badge>
            ) : localServerStatus.status === "online" ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}

            {localServerStatus.version && (
              <span className="text-sm text-foreground-muted">v{localServerStatus.version}</span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalServerStatus({ status: "checking" });
                window.location.reload();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {localServerStatus.status === "offline" && (
            <Alert className="mt-4">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Start the batch server</AlertTitle>
              <AlertDescription>
                <code className="block mt-2 p-2 bg-muted rounded text-sm font-mono">
                  cd backend && python scripts/batch_server.py
                </code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* AI Models */}
      <Card>
        <CardHeader>
          <CardTitle>AI Models</CardTitle>
          <CardDescription>Models used for content generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {AI_MODELS.map((category) => (
              <div key={category.purpose}>
                <div className="flex items-center gap-2 mb-2">
                  <category.icon className="w-4 h-4 text-foreground-muted" />
                  <span className="font-medium">{category.purpose}</span>
                </div>
                <div className="pl-6 space-y-1">
                  {category.models.map((model) => (
                    <div key={model.name} className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                        {model.name}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {model.provider}
                      </Badge>
                      <span className="text-foreground-muted text-xs">{model.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CLI Commands Reference */}
      <Card>
        <CardHeader>
          <CardTitle>CLI Commands Reference</CardTitle>
          <CardDescription>Common commands for content management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CLI_COMMANDS.map((cmd) => (
              <div key={cmd.title}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{cmd.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyCommand(cmd.command)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <code className="block p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                  {cmd.command}
                </code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Required Environment Variables</CardTitle>
          <CardDescription>Set these in your environment or .env files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <code>VITE_CONVEX_URL</code>
              <span className="text-foreground-muted">Convex deployment URL</span>
            </div>
            <div className="flex justify-between">
              <code>GEMINI_API_KEY</code>
              <span className="text-foreground-muted">Google AI API key</span>
            </div>
            <div className="flex justify-between">
              <code>OPENROUTER_API_KEY</code>
              <span className="text-foreground-muted">OpenRouter API key</span>
            </div>
            <div className="flex justify-between">
              <code>ELEVENLABS_API_KEY</code>
              <span className="text-foreground-muted">ElevenLabs TTS (optional)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

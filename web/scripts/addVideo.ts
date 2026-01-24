#!/usr/bin/env npx tsx
/**
 * Add YouTube Video Script
 *
 * Usage:
 *   npx tsx scripts/addVideo.ts <youtube-url> <language> <level> [transcript-file]
 *
 * Examples:
 *   # Auto-fetch transcript (may not work for all videos)
 *   npx tsx scripts/addVideo.ts "https://www.youtube.com/watch?v=abc123" japanese N4
 *
 *   # With manual transcript file
 *   npx tsx scripts/addVideo.ts "https://youtu.be/xyz" japanese N4 transcript.txt
 *
 * Transcript file format (copy from YouTube's "Show transcript"):
 *   0:05 First line of text
 *   0:13 Second line of text
 *   1:30 And so on...
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as readline from "readline";
import { YoutubeTranscript } from "youtube-transcript";

import { api } from "../convex/_generated/api";

// ============================================
// CONFIGURATION
// ============================================

const VALID_LANGUAGES = ["japanese", "english", "french"] as const;
const VALID_LEVELS = {
  japanese: ["N5", "N4", "N3", "N2", "N1"],
  english: ["A1", "A2", "B1", "B2", "C1", "C2"],
  french: ["A1", "A2", "B1", "B2", "C1", "C2"],
};

type Language = (typeof VALID_LANGUAGES)[number];

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

// ============================================
// HELPERS
// ============================================

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoMetadata(videoId: string): Promise<{
  title: string;
  description: string;
} | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) return null;

    const data = await response.json();
    return {
      title: data.title || `Video ${videoId}`,
      description: data.author_name
        ? `Video by ${data.author_name}`
        : "YouTube video for language learning",
    };
  } catch {
    return null;
  }
}

async function fetchTranscriptAuto(
  videoId: string
): Promise<{ text: string; start: number; duration: number }[] | null> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) return null;

    return transcript.map((item) => ({
      text: item.text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
      start: Math.round(item.offset / 1000),
      duration: Math.max(1, Math.round(item.duration / 1000)),
    }));
  } catch {
    return null;
  }
}

function parseTranscriptFile(
  filePath: string
): { text: string; start: number; duration: number }[] | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return parseTranscriptText(content);
  } catch {
    return null;
  }
}

function parseTranscriptText(
  content: string
): { text: string; start: number; duration: number }[] {
  const lines = content.trim().split("\n").filter(line => line.trim());
  const segments: { text: string; start: number; duration: number }[] = [];

  // Pattern: "0:05 Text here" or "1:30 Text here"
  const timestampPattern = /^(\d+):(\d{2})\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(timestampPattern);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const text = match[3].trim();
      const start = minutes * 60 + seconds;

      segments.push({ text, start, duration: 3 }); // Default 3 second duration
    }
  }

  // Calculate durations based on next segment start time
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].duration = Math.max(1, segments[i + 1].start - segments[i].start);
  }

  return segments;
}

function estimateDuration(
  transcript: { start: number; duration: number }[]
): number {
  if (transcript.length === 0) return 0;
  const last = transcript[transcript.length - 1];
  return last.start + last.duration;
}

async function promptForTranscript(): Promise<string> {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│  MANUAL TRANSCRIPT ENTRY                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  To get the transcript:                                         │
│  1. Go to the YouTube video                                     │
│  2. Click "..." below the video                                 │
│  3. Click "Show transcript"                                     │
│  4. Select all and copy                                         │
│                                                                 │
│  Paste the transcript below, then press Enter twice to finish:  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    let content = "";
    let emptyLines = 0;

    rl.on("line", (line) => {
      if (line === "") {
        emptyLines++;
        if (emptyLines >= 2) {
          rl.close();
        }
      } else {
        emptyLines = 0;
        content += line + "\n";
      }
    });

    rl.on("close", () => {
      resolve(content);
    });
  });
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const noQuestions = args.includes("--no-questions");
  const manualMode = args.includes("--manual");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  if (filteredArgs.length < 3) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ADD YOUTUBE VIDEO                             ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Usage:                                                          ║
║    npx tsx scripts/addVideo.ts <url> <language> <level> [file]   ║
║                                                                  ║
║  Arguments:                                                      ║
║    url       YouTube video URL or video ID                       ║
║    language  japanese | english | french                         ║
║    level     N5-N1 (Japanese) or A1-C2 (English/French)          ║
║    file      (Optional) Path to transcript file                  ║
║                                                                  ║
║  Options:                                                        ║
║    --manual        Manually paste transcript                     ║
║    --no-questions  Skip AI question generation                   ║
║                                                                  ║
║  Examples:                                                       ║
║    npx tsx scripts/addVideo.ts youtube.com/watch?v=abc jp N4     ║
║    npx tsx scripts/addVideo.ts abc123 jp N4 --manual             ║
║    npx tsx scripts/addVideo.ts abc123 jp N4 transcript.txt       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const [urlOrId, languageArg, levelArg, transcriptFile] = filteredArgs;

  // Validate inputs
  const language = languageArg.toLowerCase() as Language;
  if (!VALID_LANGUAGES.includes(language)) {
    console.error(`\n❌ Invalid language: "${languageArg}". Use: ${VALID_LANGUAGES.join(", ")}\n`);
    process.exit(1);
  }

  const level = levelArg.toUpperCase();
  if (!VALID_LEVELS[language].includes(level)) {
    console.error(`\n❌ Invalid level for ${language}. Use: ${VALID_LEVELS[language].join(", ")}\n`);
    process.exit(1);
  }

  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    console.error(`\n❌ Invalid video URL or ID: "${urlOrId}"\n`);
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ADDING YOUTUBE VIDEO                          ║
╚══════════════════════════════════════════════════════════════════╝
`);
  console.log(`  Video ID:  ${videoId}`);
  console.log(`  Language:  ${language}`);
  console.log(`  Level:     ${level}\n`);

  // Step 1: Fetch metadata
  console.log("📋 Fetching video metadata...");
  const metadata = await fetchVideoMetadata(videoId);
  if (!metadata) {
    console.error("  ❌ Failed to fetch metadata. Is the video public?\n");
    process.exit(1);
  }
  console.log(`  ✓ Title: ${metadata.title}\n`);

  // Step 2: Get transcript
  let transcript: { text: string; start: number; duration: number }[] | null = null;

  if (transcriptFile) {
    // Use provided file
    console.log(`📝 Reading transcript from file: ${transcriptFile}`);
    transcript = parseTranscriptFile(transcriptFile);
    if (!transcript || transcript.length === 0) {
      console.error("  ❌ Could not parse transcript file\n");
      process.exit(1);
    }
  } else if (manualMode) {
    // Manual paste mode
    const content = await promptForTranscript();
    transcript = parseTranscriptText(content);
    if (transcript.length === 0) {
      console.error("  ❌ No valid transcript segments found\n");
      process.exit(1);
    }
  } else {
    // Try auto-fetch
    console.log("📝 Attempting auto-fetch transcript...");
    transcript = await fetchTranscriptAuto(videoId);

    if (!transcript || transcript.length === 0) {
      console.log("  ⚠ Auto-fetch failed. YouTube may be blocking requests.\n");
      console.log("  Options:");
      console.log("    1. Run with --manual to paste transcript");
      console.log("    2. Provide a transcript file as 4th argument");
      console.log("    3. Copy from YouTube: click '...' → 'Show transcript'\n");
      process.exit(1);
    }
  }

  const duration = estimateDuration(transcript);
  console.log(`  ✓ Found ${transcript.length} segments`);
  console.log(`  ✓ Duration: ${Math.floor(duration / 60)}m ${duration % 60}s\n`);

  // Step 3: Connect to Convex
  console.log("🔗 Connecting to Convex...");
  if (!CONVEX_URL) {
    console.error("  ❌ CONVEX_URL not set\n");
    console.log("  Run: export VITE_CONVEX_URL=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2)\n");
    process.exit(1);
  }
  const client = new ConvexHttpClient(CONVEX_URL);
  console.log("  ✓ Connected\n");

  // Step 4: Save to database
  console.log("💾 Saving to database...");
  try {
    const contentId = await client.mutation(api.youtubeContent.seed, {
      videoId,
      language,
      level,
      title: metadata.title,
      description: metadata.description,
      duration,
    });

    await client.mutation(api.youtubeContent.updateTranscript, {
      id: contentId,
      transcript,
    });
    console.log(`  ✓ Video saved (ID: ${contentId})\n`);

    // Step 5: Generate questions
    if (!noQuestions) {
      console.log("🤖 Generating questions (10-30 seconds)...");
      try {
        const result = await client.action(api.ai.generateVideoQuestions, {
          youtubeContentId: contentId,
        });

        if (result.success) {
          console.log(`  ✓ Generated ${result.questionCount} questions\n`);
        } else {
          console.log(`  ⚠ Question generation failed: ${result.error}\n`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  ⚠ Question generation error: ${message}\n`);
      }
    }

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                         SUCCESS! ✓                               ║
╚══════════════════════════════════════════════════════════════════╝

  Video "${metadata.title}" added successfully!
  View at: /library → Videos tab
`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Database error: ${message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message || error);
  process.exit(1);
});

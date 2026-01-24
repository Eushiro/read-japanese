#!/usr/bin/env npx tsx
/**
 * Generate questions for videos that don't have them
 */

import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

async function main() {
  if (!CONVEX_URL) {
    console.error("CONVEX_URL not set");
    process.exit(1);
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get specific video IDs from args or use defaults
  const args = process.argv.slice(2);
  const videoIds: string[] = args.length > 0 ? args : [
    "kd70jck2hp5ppdsd9pzawdgmfx7zregj",
    "kd7cbwwxmssjw496e6at2mm3h97zr3a2",
    "kd7ec7k8zd3awt87f51xjypzan7zrgqa",
    "kd7f62rd96f0sh6qrh6aegqc8s7zsy7v",
  ];

  console.log(`\nGenerating questions for ${videoIds.length} videos...\n`);

  for (const id of videoIds) {
    console.log(`Processing ${id}...`);

    try {
      // Get video details
      const video = await client.query(api.youtubeContent.get, {
        id: id as Id<"youtubeContent">
      });

      if (!video) {
        console.log("  ❌ Video not found");
        continue;
      }

      console.log(`  Title: ${video.title}`);
      console.log(`  Language: ${video.language}, Level: ${video.level}`);

      // Check if already has questions
      if (video.questions && video.questions.length > 0) {
        console.log(`  ✓ Already has ${video.questions.length} questions`);
        continue;
      }

      // Build transcript text
      const transcriptText = video.transcript?.map((s) => s.text).join(" ") || "";
      if (!transcriptText) {
        console.log("  ❌ No transcript available");
        continue;
      }

      console.log(`  Transcript: ${transcriptText.length} chars`);
      console.log("  🤖 Generating questions...");

      const result = await client.action(api.ai.generateVideoQuestions, {
        youtubeContentId: id as Id<"youtubeContent">,
        transcriptText,
        language: video.language,
        videoTitle: video.title,
        userLevel: video.level,
      });

      if (result.success) {
        console.log(`  ✅ Generated ${result.questionCount} questions\n`);
      } else {
        console.log(`  ⚠️ Failed: ${result.error}\n`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ Error: ${message.slice(0, 100)}\n`);
    }
  }

  console.log("Done!\n");
}

main().catch(console.error);

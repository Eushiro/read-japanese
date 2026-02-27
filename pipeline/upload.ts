/**
 * Upload script for pushing validated questions to Convex question pool.
 *
 * Usage:
 *   npx tsx pipeline/upload.ts --language japanese [--level level_1] [--dry-run]
 *
 * Requires CONVEX_URL environment variable (the deployment URL).
 * Authenticates via Clerk JWT — requires CLERK_SECRET_KEY and ADMIN_USER_ID env vars.
 *
 * Alternative: Use CONVEX_ADMIN_KEY for direct Convex admin access (simpler for scripts).
 */

import * as fs from "fs";
import * as path from "path";

// ============================================
// TYPES
// ============================================

interface Question {
  type: string;
  targetSkill: string;
  difficulty: string;
  question: string;
  passageText: string | null;
  translations: Record<string, string>;
  optionTranslations: Record<string, string[]> | null;
  showOptionsInTargetLanguage: boolean;
  options: string[] | null;
  correctAnswer: string;
  acceptableAnswers: string[];
  points: number;
  grammarTags: string[];
  vocabTags: string[];
  topicTags: string[];
}

interface BatchFile {
  batchId: string;
  language: string;
  level: string;
  questionType: string;
  targetSkill: string;
  topic: string;
  learningGoal: string;
  questions: Question[];
  validation?: {
    valid: boolean;
    errorCount: number;
    dupeCount: number;
  };
  generatedAt: string;
}

// Standalone types that don't need audio generation
const STANDALONE_TYPES = new Set([
  "mcq_vocabulary",
  "mcq_grammar",
  "fill_blank",
  "translation",
  "free_input",
  "mcq_comprehension",
]);

// ============================================
// HELPERS
// ============================================

function mapQuestionForUpload(q: Question) {
  return {
    questionType: q.type,
    targetSkill: q.targetSkill,
    difficulty: q.difficulty,
    question: q.question,
    ...(q.passageText ? { passageText: q.passageText } : {}),
    ...(q.options ? { options: q.options } : {}),
    correctAnswer: q.correctAnswer,
    ...(q.acceptableAnswers && q.acceptableAnswers.length > 0
      ? { acceptableAnswers: q.acceptableAnswers }
      : {}),
    points: q.points,
    grammarTags: q.grammarTags,
    vocabTags: q.vocabTags,
    topicTags: q.topicTags,
    translations: q.translations,
    optionTranslations: q.optionTranslations,
    showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const getFlag = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const language = getFlag("language");
  const level = getFlag("level");
  const dryRun = hasFlag("dry-run");
  const chunkSize = 50;

  if (!language) {
    console.error(
      "Usage: npx tsx pipeline/upload.ts --language <language> [--level <level>] [--dry-run]",
    );
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl && !dryRun) {
    console.error("Set CONVEX_URL or VITE_CONVEX_URL environment variable");
    process.exit(1);
  }

  // Dynamic import of convex (only needed for actual upload)
  let httpClient: {
    action: (ref: string, args: Record<string, unknown>) => Promise<unknown>;
  } | null = null;

  if (!dryRun) {
    const { ConvexHttpClient } = await import("convex/browser");
    httpClient = new ConvexHttpClient(convexUrl!);

    // If using admin key for auth
    const adminKey = process.env.CONVEX_ADMIN_KEY;
    if (adminKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (httpClient as any).setAdminAuth(adminKey);
    }
  }

  const pipelineDir = decodeURIComponent(
    path.dirname(new URL(import.meta.url).pathname),
  );
  const outputDir = path.join(pipelineDir, "output");

  const languages =
    language === "all" ? ["japanese", "english", "french"] : [language];

  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalAudioSkipped = 0;

  for (const lang of languages) {
    const langDir = path.join(outputDir, lang);
    if (!fs.existsSync(langDir)) {
      console.log(`No output for ${lang}`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Upload: ${lang.toUpperCase()}${dryRun ? " (DRY RUN)" : ""}`);
    console.log(`${"=".repeat(60)}`);

    const levels = level
      ? [level]
      : fs
          .readdirSync(langDir)
          .filter((f) => fs.statSync(path.join(langDir, f)).isDirectory());

    // Collect all standalone questions
    const allQuestions: Array<ReturnType<typeof mapQuestionForUpload>> = [];
    let audioCount = 0;

    for (const lv of levels) {
      const levelPath = path.join(langDir, lv);
      if (!fs.existsSync(levelPath)) continue;

      const files = fs
        .readdirSync(levelPath)
        .filter((f) => f.endsWith(".json"))
        .sort();

      for (const file of files) {
        try {
          const batch: BatchFile = JSON.parse(
            fs.readFileSync(path.join(levelPath, file), "utf-8"),
          );

          for (const q of batch.questions) {
            if (STANDALONE_TYPES.has(q.type)) {
              allQuestions.push(mapQuestionForUpload(q));
            } else {
              audioCount++;
            }
          }
        } catch (err) {
          console.error(`  Error reading ${file}: ${err}`);
        }
      }
    }

    if (audioCount > 0) {
      console.log(
        `  Skipping ${audioCount} audio questions (listening_mcq, dictation, shadow_record)`,
      );
      totalAudioSkipped += audioCount;
    }

    console.log(`  Standalone questions to upload: ${allQuestions.length}`);

    if (dryRun) {
      // Stats breakdown
      const byType: Record<string, number> = {};
      const byLevel: Record<string, number> = {};
      for (const q of allQuestions) {
        byType[q.questionType] = (byType[q.questionType] ?? 0) + 1;
        byLevel[q.difficulty] = (byLevel[q.difficulty] ?? 0) + 1;
      }
      console.log("  By type:", byType);
      console.log("  By level:", byLevel);
      totalUploaded += allQuestions.length;
      continue;
    }

    // Upload in chunks
    for (let i = 0; i < allQuestions.length; i += chunkSize) {
      const chunk = allQuestions.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(allQuestions.length / chunkSize);

      try {
        console.log(
          `  Uploading chunk ${chunkNum}/${totalChunks} (${chunk.length} questions)...`,
        );

        await httpClient!.action(
          "questionPoolAdmin:adminIngestQuestions" as never,
          {
            language: lang,
            questions: chunk,
            modelUsed: "claude-sonnet-4-6",
            qualityScore: 90,
          },
        );

        totalUploaded += chunk.length;
        console.log(`    Done (${totalUploaded} total uploaded)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`    FAILED: ${message}`);
        totalSkipped += chunk.length;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  UPLOAD SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Uploaded: ${totalUploaded}`);
  console.log(`  Skipped (errors): ${totalSkipped}`);
  console.log(`  Skipped (audio): ${totalAudioSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

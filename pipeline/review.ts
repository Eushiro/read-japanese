/**
 * Review script for manual quality assessment of generated batches.
 *
 * Usage:
 *   npx tsx pipeline/review.ts --language japanese [--level level_1] [--verbose]
 *
 * Pretty-prints questions, flags potential issues, and shows coverage stats.
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

interface Issue {
  batchId: string;
  questionIndex: number;
  severity: "warning" | "info";
  message: string;
}

// ============================================
// ISSUE DETECTION
// ============================================

function detectIssues(batch: BatchFile): Issue[] {
  const issues: Issue[] = [];

  const stems = new Set<string>();

  for (let i = 0; i < batch.questions.length; i++) {
    const q = batch.questions[i];

    // Very short questions
    if (q.question.length < 10) {
      issues.push({
        batchId: batch.batchId,
        questionIndex: i,
        severity: "warning",
        message: `Very short question (${q.question.length} chars): "${q.question}"`,
      });
    }

    // Identical stem patterns (first 20 chars)
    const stemKey = q.question.slice(0, 20).toLowerCase();
    if (stems.has(stemKey)) {
      issues.push({
        batchId: batch.batchId,
        questionIndex: i,
        severity: "warning",
        message: `Duplicate stem pattern: "${stemKey}..."`,
      });
    }
    stems.add(stemKey);

    // Suspicious translations: same as question text
    if (q.translations) {
      for (const [lang, translation] of Object.entries(q.translations)) {
        if (translation === q.question && lang !== batch.language) {
          issues.push({
            batchId: batch.batchId,
            questionIndex: i,
            severity: "warning",
            message: `Translation "${lang}" identical to question text (untranslated?)`,
          });
        }
      }
    }

    // MCQ: correct answer is always first option
    if (q.options && q.options.length > 0 && q.options[0] === q.correctAnswer) {
      issues.push({
        batchId: batch.batchId,
        questionIndex: i,
        severity: "info",
        message: "Correct answer is first option (may indicate non-shuffled)",
      });
    }

    // Empty acceptableAnswers for translation/free_input
    if (
      (q.type === "translation" || q.type === "free_input") &&
      (!q.acceptableAnswers || q.acceptableAnswers.length === 0)
    ) {
      issues.push({
        batchId: batch.batchId,
        questionIndex: i,
        severity: "info",
        message: `${q.type} has no acceptableAnswers (may be too strict)`,
      });
    }
  }

  return issues;
}

// ============================================
// DISPLAY
// ============================================

function printQuestion(q: Question, idx: number, verbose: boolean): void {
  console.log(
    `\n  Q${idx + 1} [${q.type}] (${q.targetSkill}) [${q.difficulty}] ${q.points}pts`,
  );
  console.log(`    Question: ${q.question}`);
  if (q.passageText) {
    console.log(`    Passage:  ${q.passageText}`);
  }
  if (q.options) {
    q.options.forEach((opt, i) => {
      const marker = opt === q.correctAnswer ? " *" : "  ";
      console.log(`    ${marker}${String.fromCharCode(65 + i)}. ${opt}`);
    });
  } else {
    console.log(`    Answer: ${q.correctAnswer}`);
  }

  if (verbose) {
    console.log(`    Translations:`);
    if (q.translations) {
      for (const [lang, text] of Object.entries(q.translations)) {
        console.log(`      ${lang}: ${text}`);
      }
    }
    console.log(
      `    Tags: grammar=[${q.grammarTags.join(", ")}] vocab=[${q.vocabTags.join(", ")}] topic=[${q.topicTags.join(", ")}]`,
    );
    if (q.acceptableAnswers && q.acceptableAnswers.length > 0) {
      console.log(`    Acceptable: ${q.acceptableAnswers.join(" | ")}`);
    }
  }
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
  const verbose = hasFlag("verbose");

  if (!language) {
    console.error(
      "Usage: npx tsx pipeline/review.ts --language <language> [--level <level>] [--verbose]",
    );
    process.exit(1);
  }

  const pipelineDir = decodeURIComponent(
    path.dirname(new URL(import.meta.url).pathname),
  );
  const outputDir = path.join(pipelineDir, "output");

  const languages =
    language === "all" ? ["japanese", "english", "french"] : [language];

  // Stats accumulators
  const stats = {
    byLevel: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    byTopic: {} as Record<string, number>,
    bySkill: {} as Record<string, number>,
    totalQuestions: 0,
    totalBatches: 0,
    totalIssues: 0,
  };

  for (const lang of languages) {
    const langDir = path.join(outputDir, lang);
    if (!fs.existsSync(langDir)) {
      console.log(`No output for ${lang}`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Review: ${lang.toUpperCase()}`);
    console.log(`${"=".repeat(60)}`);

    const levels = level
      ? [level]
      : fs
          .readdirSync(langDir)
          .filter((f) => fs.statSync(path.join(langDir, f)).isDirectory());

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
          stats.totalBatches++;

          console.log(
            `\n--- ${batch.batchId} [${batch.questionType}/${batch.topic}/${batch.learningGoal}] ---`,
          );

          if (batch.validation && !batch.validation.valid) {
            console.log(
              `  Validation: ${batch.validation.errorCount} errors, ${batch.validation.dupeCount} dupes`,
            );
          }

          for (let i = 0; i < batch.questions.length; i++) {
            const q = batch.questions[i];
            printQuestion(q, i, verbose);

            // Track stats
            stats.byLevel[q.difficulty] =
              (stats.byLevel[q.difficulty] ?? 0) + 1;
            stats.byType[q.type] = (stats.byType[q.type] ?? 0) + 1;
            stats.bySkill[q.targetSkill] =
              (stats.bySkill[q.targetSkill] ?? 0) + 1;
            for (const tag of q.topicTags ?? []) {
              stats.byTopic[tag] = (stats.byTopic[tag] ?? 0) + 1;
            }
            stats.totalQuestions++;
          }

          // Flag issues
          const issues = detectIssues(batch);
          if (issues.length > 0) {
            console.log(`\n  Issues:`);
            for (const issue of issues) {
              const icon = issue.severity === "warning" ? "WARN" : "INFO";
              console.log(
                `    [${icon}] Q${issue.questionIndex + 1}: ${issue.message}`,
              );
            }
            stats.totalIssues += issues.length;
          }
        } catch (err) {
          console.error(`  Error reading ${file}: ${err}`);
        }
      }
    }
  }

  // Print summary stats
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total batches: ${stats.totalBatches}`);
  console.log(`  Total questions: ${stats.totalQuestions}`);
  console.log(`  Total issues: ${stats.totalIssues}`);
  console.log(`\n  By level:`);
  for (const [k, v] of Object.entries(stats.byLevel).sort()) {
    console.log(`    ${k}: ${v}`);
  }
  console.log(`\n  By type:`);
  for (const [k, v] of Object.entries(stats.byType).sort()) {
    console.log(`    ${k}: ${v}`);
  }
  console.log(`\n  By skill:`);
  for (const [k, v] of Object.entries(stats.bySkill).sort()) {
    console.log(`    ${k}: ${v}`);
  }
  console.log(`\n  By topic:`);
  for (const [k, v] of Object.entries(stats.byTopic).sort()) {
    console.log(`    ${k}: ${v}`);
  }

  // Coverage gaps
  const expectedLevels = [
    "level_1",
    "level_2",
    "level_3",
    "level_4",
    "level_5",
    "level_6",
  ];
  const expectedTypes = [
    "mcq_vocabulary",
    "mcq_grammar",
    "mcq_comprehension",
    "fill_blank",
    "translation",
    "free_input",
    "listening_mcq",
    "dictation",
    "shadow_record",
  ];
  const missingLevels = expectedLevels.filter((l) => !stats.byLevel[l]);
  const missingTypes = expectedTypes.filter((t) => !stats.byType[t]);

  if (missingLevels.length > 0 || missingTypes.length > 0) {
    console.log(`\n  Coverage gaps:`);
    if (missingLevels.length > 0)
      console.log(`    Missing levels: ${missingLevels.join(", ")}`);
    if (missingTypes.length > 0)
      console.log(`    Missing types: ${missingTypes.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

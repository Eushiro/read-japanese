/**
 * Validation script for generated question batches.
 *
 * Exports validateBatch() for use by generate.ts, and also works as standalone CLI:
 *   npx tsx pipeline/validate.ts --language japanese [--level level_1]
 *
 * Ports validation logic from web/convex/adaptivePractice.ts:489-576
 * and uses the same hash algorithm as web/convex/lib/questionPoolHelpers.ts
 */

import { createHash } from "crypto";
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
  generatedAt: string;
}

export interface ValidationError {
  questionIndex: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  questionCount: number;
  hashConflicts: string[];
}

// ============================================
// CONSTANTS
// ============================================

const MCQ_TYPES = new Set([
  "mcq_vocabulary",
  "mcq_grammar",
  "mcq_comprehension",
  "fill_blank",
  "listening_mcq",
]);

const VALID_TYPES = new Set([
  "mcq_vocabulary",
  "mcq_grammar",
  "mcq_comprehension",
  "fill_blank",
  "translation",
  "listening_mcq",
  "free_input",
  "dictation",
  "shadow_record",
]);

const VALID_SKILLS = new Set([
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "writing",
  "speaking",
]);

const VALID_DIFFICULTIES = new Set([
  "level_1",
  "level_2",
  "level_3",
  "level_4",
  "level_5",
  "level_6",
]);

const UI_LANGUAGES = ["en", "ja", "fr", "zh"];

// ============================================
// HASHING (mirrors web/convex/lib/questionPoolHelpers.ts)
// ============================================

export function hashQuestionContent(question: {
  questionType: string;
  question: string;
  passageText?: string | null;
  correctAnswer: string;
  options?: string[] | null;
}): string {
  const canonical = {
    type: question.questionType,
    q: question.question.trim(),
    p: question.passageText?.trim() ?? "",
    a: question.correctAnswer.trim(),
    o: question.options
      ? [...question.options].sort().map((o) => o.trim())
      : [],
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a batch of questions.
 * @param questions The questions to validate
 * @param expectedType Expected question type for the batch (null to skip type check)
 * @param expectedLevel Expected difficulty level (null to skip level check)
 * @param existingHashes Set of already-seen hashes for dedup
 * @returns ValidationResult with errors and hash conflicts
 */
export function validateBatch(
  questions: Question[],
  expectedType: string | null,
  expectedLevel: string | null,
  existingHashes: Set<string> = new Set(),
): ValidationResult {
  const errors: ValidationError[] = [];
  const hashConflicts: string[] = [];
  const batchHashes = new Set<string>();

  if (!questions || questions.length === 0) {
    return {
      valid: false,
      errors: [
        {
          questionIndex: -1,
          field: "questions",
          message: "No questions in batch",
        },
      ],
      questionCount: 0,
      hashConflicts: [],
    };
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Required fields
    if (!q.type || !VALID_TYPES.has(q.type)) {
      errors.push({
        questionIndex: i,
        field: "type",
        message: `Invalid type: "${q.type}"`,
      });
    }
    if (!q.targetSkill || !VALID_SKILLS.has(q.targetSkill)) {
      errors.push({
        questionIndex: i,
        field: "targetSkill",
        message: `Invalid targetSkill: "${q.targetSkill}"`,
      });
    }
    if (!q.difficulty || !VALID_DIFFICULTIES.has(q.difficulty)) {
      errors.push({
        questionIndex: i,
        field: "difficulty",
        message: `Invalid difficulty: "${q.difficulty}"`,
      });
    }
    if (!q.question || q.question.trim().length === 0) {
      errors.push({
        questionIndex: i,
        field: "question",
        message: "Empty question text",
      });
    }
    if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
      errors.push({
        questionIndex: i,
        field: "correctAnswer",
        message: "Empty correctAnswer",
      });
    }

    // Points
    if (!q.points || q.points <= 0) {
      errors.push({
        questionIndex: i,
        field: "points",
        message: "Points must be positive",
      });
    }

    // Type matches batch target
    if (expectedType && q.type !== expectedType) {
      errors.push({
        questionIndex: i,
        field: "type",
        message: `Expected type "${expectedType}" but got "${q.type}"`,
      });
    }

    // Difficulty matches batch target
    if (expectedLevel && q.difficulty !== expectedLevel) {
      errors.push({
        questionIndex: i,
        field: "difficulty",
        message: `Expected difficulty "${expectedLevel}" but got "${q.difficulty}"`,
      });
    }

    // MCQ: exactly 4 unique options, correctAnswer in options
    if (MCQ_TYPES.has(q.type)) {
      if (!q.options || q.options.length !== 4) {
        errors.push({
          questionIndex: i,
          field: "options",
          message: `MCQ must have exactly 4 options, got ${q.options?.length ?? 0}`,
        });
      } else {
        if (new Set(q.options).size !== 4) {
          errors.push({
            questionIndex: i,
            field: "options",
            message: "MCQ options must be unique",
          });
        }
        if (!q.options.includes(q.correctAnswer)) {
          errors.push({
            questionIndex: i,
            field: "correctAnswer",
            message: "correctAnswer must match one of the options",
          });
        }
      }
    }

    // fill_blank: question or passageText must contain ___
    if (q.type === "fill_blank") {
      const hasBlank =
        q.question.includes("___") ||
        (q.passageText && q.passageText.includes("___"));
      if (!hasBlank) {
        errors.push({
          questionIndex: i,
          field: "question",
          message: 'fill_blank must include "___" in question or passageText',
        });
      }
    }

    // translation: must have non-empty translations
    if (q.type === "translation" || q.type === "shadow_record") {
      const hasTranslation =
        q.translations &&
        Object.values(q.translations).some(
          (v) => typeof v === "string" && v.trim().length > 0,
        );
      if (!hasTranslation) {
        errors.push({
          questionIndex: i,
          field: "translations",
          message: `${q.type} must include non-empty translations`,
        });
      }
    }

    // mcq_comprehension: must have passageText (standalone mode)
    if (q.type === "mcq_comprehension" && !q.passageText) {
      errors.push({
        questionIndex: i,
        field: "passageText",
        message: "mcq_comprehension must have passageText in standalone mode",
      });
    }

    // listening_mcq/dictation: must have passageText
    if (
      (q.type === "listening_mcq" || q.type === "dictation") &&
      !q.passageText
    ) {
      errors.push({
        questionIndex: i,
        field: "passageText",
        message: `${q.type} must have passageText`,
      });
    }

    // Translations: all 4 UI languages present and non-empty
    if (q.translations) {
      for (const lang of UI_LANGUAGES) {
        if (
          !q.translations[lang] ||
          (typeof q.translations[lang] === "string" &&
            q.translations[lang].trim().length === 0)
        ) {
          errors.push({
            questionIndex: i,
            field: "translations",
            message: `Missing or empty translation for "${lang}"`,
          });
        }
      }
    } else {
      errors.push({
        questionIndex: i,
        field: "translations",
        message: "translations object is required",
      });
    }

    // Option translations for MCQ types
    if (MCQ_TYPES.has(q.type) && q.optionTranslations) {
      for (const lang of UI_LANGUAGES) {
        if (
          !q.optionTranslations[lang] ||
          q.optionTranslations[lang].length === 0
        ) {
          errors.push({
            questionIndex: i,
            field: "optionTranslations",
            message: `Missing optionTranslations for "${lang}"`,
          });
        }
      }
    }

    // Tags: non-empty arrays
    if (!q.grammarTags || q.grammarTags.length === 0) {
      errors.push({
        questionIndex: i,
        field: "grammarTags",
        message: "grammarTags must be a non-empty array",
      });
    }
    if (!q.vocabTags || q.vocabTags.length === 0) {
      errors.push({
        questionIndex: i,
        field: "vocabTags",
        message: "vocabTags must be a non-empty array",
      });
    }
    if (!q.topicTags || q.topicTags.length === 0) {
      errors.push({
        questionIndex: i,
        field: "topicTags",
        message: "topicTags must be a non-empty array",
      });
    }

    // Dedup: hash check
    const hash = hashQuestionContent({
      questionType: q.type,
      question: q.question,
      passageText: q.passageText,
      correctAnswer: q.correctAnswer,
      options: q.options,
    });
    if (existingHashes.has(hash) || batchHashes.has(hash)) {
      hashConflicts.push(hash);
    }
    batchHashes.add(hash);
  }

  return {
    valid: errors.length === 0 && hashConflicts.length === 0,
    errors,
    questionCount: questions.length,
    hashConflicts,
  };
}

// ============================================
// STANDALONE CLI
// ============================================

function collectHashes(outputDir: string, language: string): Set<string> {
  const hashes = new Set<string>();
  const langDir = path.join(outputDir, language);
  if (!fs.existsSync(langDir)) return hashes;

  for (const levelDir of fs.readdirSync(langDir)) {
    const levelPath = path.join(langDir, levelDir);
    if (!fs.statSync(levelPath).isDirectory()) continue;
    for (const file of fs.readdirSync(levelPath)) {
      if (!file.endsWith(".json")) continue;
      try {
        const batch: BatchFile = JSON.parse(
          fs.readFileSync(path.join(levelPath, file), "utf-8"),
        );
        for (const q of batch.questions) {
          hashes.add(
            hashQuestionContent({
              questionType: q.type,
              question: q.question,
              passageText: q.passageText,
              correctAnswer: q.correctAnswer,
              options: q.options,
            }),
          );
        }
      } catch {
        // Skip invalid files
      }
    }
  }
  return hashes;
}

async function main() {
  const args = process.argv.slice(2);
  const langIdx = args.indexOf("--language");
  const levelIdx = args.indexOf("--level");

  const language = langIdx >= 0 ? args[langIdx + 1] : null;
  const level = levelIdx >= 0 ? args[levelIdx + 1] : null;

  if (!language) {
    console.error(
      "Usage: npx tsx pipeline/validate.ts --language <language> [--level <level>]",
    );
    process.exit(1);
  }

  const pipelineDir = decodeURIComponent(
    path.dirname(new URL(import.meta.url).pathname),
  );
  const outputDir = path.join(pipelineDir, "output");
  const langDir = path.join(outputDir, language);

  if (!fs.existsSync(langDir)) {
    console.error(`No output directory found: ${langDir}`);
    process.exit(1);
  }

  // Collect all hashes for dedup across batches
  const allHashes = new Set<string>();
  let totalQuestions = 0;
  let totalErrors = 0;
  let totalDupes = 0;
  let batchCount = 0;

  const levels = level
    ? [level]
    : fs
        .readdirSync(langDir)
        .filter((f) => fs.statSync(path.join(langDir, f)).isDirectory());

  for (const lv of levels) {
    const levelPath = path.join(langDir, lv);
    if (!fs.existsSync(levelPath)) continue;

    const files = fs.readdirSync(levelPath).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      batchCount++;
      try {
        const batch: BatchFile = JSON.parse(
          fs.readFileSync(path.join(levelPath, file), "utf-8"),
        );
        const result = validateBatch(
          batch.questions,
          batch.questionType,
          batch.level,
          allHashes,
        );

        totalQuestions += result.questionCount;
        totalErrors += result.errors.length;
        totalDupes += result.hashConflicts.length;

        if (!result.valid) {
          console.log(`\n  FAIL: ${file}`);
          for (const err of result.errors) {
            console.log(
              `    Q${err.questionIndex}: [${err.field}] ${err.message}`,
            );
          }
          for (const hash of result.hashConflicts) {
            console.log(`    DUPLICATE: ${hash.slice(0, 12)}...`);
          }
        }

        // Add hashes to running set
        for (const q of batch.questions) {
          allHashes.add(
            hashQuestionContent({
              questionType: q.type,
              question: q.question,
              passageText: q.passageText,
              correctAnswer: q.correctAnswer,
              options: q.options,
            }),
          );
        }
      } catch (err) {
        console.log(`\n  ERROR reading ${file}: ${err}`);
        totalErrors++;
      }
    }
  }

  console.log(
    `\n=== Validation Summary (${language}${level ? `/${level}` : ""}) ===`,
  );
  console.log(`Batches: ${batchCount}`);
  console.log(`Questions: ${totalQuestions}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Duplicates: ${totalDupes}`);
  console.log(
    `Result: ${totalErrors === 0 && totalDupes === 0 ? "PASS" : "FAIL"}`,
  );

  process.exit(totalErrors === 0 && totalDupes === 0 ? 0 : 1);
}

// Run CLI if executed directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("/validate.ts") ||
    process.argv[1].endsWith("\\validate.ts"));
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

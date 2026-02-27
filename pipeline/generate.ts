/**
 * Main orchestrator for batch question generation.
 *
 * Usage:
 *   npx tsx pipeline/generate.ts --language japanese [--level level_1] [--trial 2] [--parallel 4] [--fresh] [--type mcq_vocabulary] [--dry-run]
 *
 * Reads curriculum specs, builds prompts, calls `claude -p` with structured output,
 * validates results, and saves to output/ with manifest tracking.
 */

import { exec as execCb } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const exec = promisify(execCb);

import { hashQuestionContent, validateBatch } from "./validate.js";

// ============================================
// TYPES
// ============================================

interface LevelSpec {
  level: string;
  label: string;
  target: number;
}

interface CurriculumSpec {
  language: string;
  languageName: string;
  totalTarget: number;
  levels: LevelSpec[];
  typeDistribution: Record<string, number>;
  skillMap: Record<string, string>;
  topics: string[];
  learningGoals: string[];
  grammarConstraintsFile: string;
  vocabByTopicPattern: string;
  levelToVocabKey: Record<string, string>;
}

interface GrammarEntry {
  pattern: string;
  description: string;
  example?: string;
}

interface GrammarConstraints {
  [level: string]: {
    allowed: GrammarEntry[];
    forbidden: GrammarEntry[];
  };
}

interface BatchSpec {
  batchId: string;
  language: string;
  languageName: string;
  level: string;
  levelLabel: string;
  questionType: string;
  targetSkill: string;
  topic: string;
  learningGoal: string;
}

interface ManifestEntry {
  batchId: string;
  status: "generated" | "validated" | "failed";
  outputFile?: string;
  error?: string;
  questionCount?: number;
  generatedAt: string;
}

// ============================================
// DIFFICULTY ANCHORS (mirrors promptHelpers.ts)
// ============================================

const DIFFICULTY_ANCHORS: Record<string, Record<string, string>> = {
  japanese: {
    level_1:
      "N5 vocabulary (top 800 words), hiragana/katakana + basic kanji (~80), sentences <10 characters, ます/です forms only, simple SOV patterns",
    level_2:
      "N4 vocabulary (top 1500 words), ~150 kanji, 10-20 character sentences, て-form, basic conditionals, たい/ている forms",
    level_3:
      "N3 vocabulary (top 3000 words), ~350 kanji, 15-30 character sentences, passive/causative, compound sentences",
    level_4:
      "N2 vocabulary (top 6000 words), ~650 kanji, 20-40 character sentences, complex grammar, formal register",
    level_5:
      "N1 vocabulary (10000+ words), ~1000+ kanji, 30+ character sentences, literary/formal patterns, idiomatic expressions",
    level_6:
      "Beyond N1: 12000+ words, literary/classical Japanese, 40+ character sentences, archaic patterns",
  },
  french: {
    level_1:
      "A1 vocabulary (top 500 words), present tense only, sentences <8 words, basic SVO, etre/avoir",
    level_2:
      "A2 vocabulary (top 1200 words), passe compose, 8-15 word sentences, futur proche, basic negation",
    level_3:
      "B1 vocabulary (top 3000 words), imparfait vs passe compose, 12-22 word sentences, subjonctif basics",
    level_4:
      "B2 vocabulary (top 5000 words), conditionnel, 18-30 word sentences, subjonctif full range, passive voice",
    level_5:
      "C1 vocabulary (8000+ words), literary tenses, 25+ word sentences, formal register, nuanced connectors",
    level_6:
      "C2 vocabulary (10000+ words), plus-que-parfait du subjonctif, 30+ word sentences, academic/literary register",
  },
  english: {
    level_1:
      "A1 vocabulary (top 500 words), present simple/continuous, sentences <8 words, basic SVO",
    level_2:
      "A2 vocabulary (top 1200 words), past simple, 8-15 word sentences, comparatives/superlatives, basic modals",
    level_3:
      "B1 vocabulary (top 3000 words), present perfect vs past simple, 12-22 word sentences, passive voice, conditionals",
    level_4:
      "B2 vocabulary (top 5000 words), reported speech, 18-30 word sentences, 3rd conditional, complex relative clauses",
    level_5:
      "C1 vocabulary (8000+ words), 25+ word sentences, subjunctive mood, inversion, idiomatic language, formal register",
    level_6:
      "C2 vocabulary (10000+ words), 30+ word sentences, academic/literary register, subtle pragmatic distinctions",
  },
};

const CULTURAL_CONTEXTS: Record<string, string> = {
  japanese:
    "- Use Japanese place names, customs, and real-world contexts\n- Reference cultural practices naturally (temples, festivals, seasonal events, train etiquette)\n- Use authentic name patterns",
  french:
    "- Reference French-specific contexts (boulangerie, marche, cafe culture, metro)\n- Use authentic French names and places\n- Include cultural norms (greeting customs, formal vous/tu distinction)",
  english:
    "- Vary between British, American, and international English contexts\n- Use culturally diverse names and settings\n- Reference real-world contexts (supermarket, doctor's office, university)",
};

const DISTRACTOR_EXAMPLES: Record<string, string> = {
  japanese: `Japanese-specific distractor patterns:
  - Visually similar kanji (e.g., 待 vs 持, 読 vs 続)
  - Particle confusion (は/が, に/で, を/が)
  - Verb form confusion (te-form/ta-form/nai-form)
  - Multiple readings of the same kanji
  - Counter word confusion`,
  french: `French-specific distractor patterns:
  - Gender errors (le/la, un/une)
  - Agreement errors (adjective/noun, subject/verb)
  - Tense confusion (passe compose vs imparfait)
  - False cognates with English
  - Preposition confusion (a/de/en)`,
  english: `English-specific distractor patterns:
  - Phrasal verb confusion (look up / look after / look into)
  - Collocation errors (make/do, say/tell)
  - Tense confusion (present perfect vs simple past)
  - Article errors (a/an/the)
  - Preposition confusion (in/on/at)`,
};

const GOAL_DIRECTIVES: Record<string, string> = {
  travel:
    "LEARNING GOAL: Travel & conversation. Prioritize practical, real-world scenarios: ordering food, asking for directions, booking hotels, handling emergencies.",
  professional:
    "LEARNING GOAL: Business & workplace. Prioritize professional scenarios: emails, meetings, presentations, workplace interactions.",
  media:
    "LEARNING GOAL: Entertainment & media. Prioritize understanding native-speed content: anime, films, books, music, social media. Include colloquial expressions.",
  exam: "LEARNING GOAL: Exam preparation. Prioritize exam-style question formats and systematic coverage of tested grammar/vocabulary.",
  casual:
    "LEARNING GOAL: General exploration. Provide a balanced mix of everyday conversation, cultural context, and practical language use.",
};

// ============================================
// HELPERS
// ============================================

const PIPELINE_DIR = decodeURIComponent(
  path.dirname(new URL(import.meta.url).pathname),
);

function loadSpec(language: string): CurriculumSpec {
  const specPath = path.join(PIPELINE_DIR, "specs", `${language}.json`);
  return JSON.parse(fs.readFileSync(specPath, "utf-8"));
}

function loadGrammarConstraints(spec: CurriculumSpec): GrammarConstraints {
  const filePath = path.join(PIPELINE_DIR, spec.grammarConstraintsFile);
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadVocabByTopic(
  spec: CurriculumSpec,
  level: string,
): Record<string, string[]> {
  const vocabKey = spec.levelToVocabKey[level];
  if (!vocabKey) return {};
  const filePath = path.join(
    PIPELINE_DIR,
    spec.vocabByTopicPattern.replace("{level}", vocabKey),
  );
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadPromptTemplate(): string {
  return fs.readFileSync(
    path.join(PIPELINE_DIR, "prompts", "system.txt"),
    "utf-8",
  );
}

function loadManifest(language: string): Record<string, ManifestEntry> {
  const manifestPath = path.join(PIPELINE_DIR, "manifests", `${language}.json`);
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

function saveManifest(
  language: string,
  manifest: Record<string, ManifestEntry>,
): void {
  const manifestDir = path.join(PIPELINE_DIR, "manifests");
  if (!fs.existsSync(manifestDir))
    fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, `${language}.json`),
    JSON.stringify(manifest, null, 2),
  );
}

function sampleVocab(
  vocabByTopic: Record<string, string[]>,
  topic: string,
  count: number,
): string[] {
  const words = vocabByTopic[topic] ?? [];
  if (words.length <= count) return words;
  // Shuffle and take first N
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getGrammarLevel(
  constraints: GrammarConstraints,
  spec: CurriculumSpec,
  level: string,
): { allowed: GrammarEntry[]; forbidden: GrammarEntry[] } {
  const vocabKey = spec.levelToVocabKey[level];
  if (!vocabKey || !constraints[vocabKey])
    return { allowed: [], forbidden: [] };
  return constraints[vocabKey];
}

// ============================================
// BATCH MATRIX COMPUTATION
// ============================================

function computeBatchMatrix(
  spec: CurriculumSpec,
  filters: {
    level?: string;
    type?: string;
    trial?: number;
  },
): BatchSpec[] {
  const batches: BatchSpec[] = [];
  let batchNum = 0;

  for (const levelSpec of spec.levels) {
    if (filters.level && filters.level !== levelSpec.level) continue;

    // How many questions for this level
    const levelTarget = levelSpec.target;
    // Distribute across types by weight
    for (const [qType, weight] of Object.entries(spec.typeDistribution)) {
      if (filters.type && filters.type !== qType) continue;

      const typeTarget = Math.round(levelTarget * weight);
      const batchesNeeded = Math.ceil(typeTarget / 5); // 5 questions per batch

      for (let b = 0; b < batchesNeeded; b++) {
        const topicIdx = batchNum % spec.topics.length;
        const goalIdx = batchNum % spec.learningGoals.length;

        batches.push({
          batchId: `${spec.language}_${levelSpec.level}_${qType}_${String(batchNum).padStart(4, "0")}`,
          language: spec.language,
          languageName: spec.languageName,
          level: levelSpec.level,
          levelLabel: levelSpec.label,
          questionType: qType,
          targetSkill: spec.skillMap[qType] ?? "vocabulary",
          topic: spec.topics[topicIdx],
          learningGoal: spec.learningGoals[goalIdx],
        });
        batchNum++;
      }
    }
  }

  // Apply trial limit
  if (filters.trial && filters.trial > 0) {
    return batches.slice(0, filters.trial);
  }

  return batches;
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildPrompt(
  template: string,
  batch: BatchSpec,
  grammarConstraints: GrammarConstraints,
  vocabByTopic: Record<string, string[]>,
  spec: CurriculumSpec,
): string {
  const grammar = getGrammarLevel(grammarConstraints, spec, batch.level);
  const vocabSample = sampleVocab(vocabByTopic, batch.topic, 20);

  // Pick 2-3 grammar points to "must test" (rotate across batches)
  const mustTestCount = Math.min(3, grammar.allowed.length);
  const mustTestStart =
    parseInt(batch.batchId.slice(-4)) %
    Math.max(1, grammar.allowed.length - mustTestCount + 1);
  const mustTest = grammar.allowed.slice(
    mustTestStart,
    mustTestStart + mustTestCount,
  );
  const grammarPointsBlock =
    mustTest.length > 0
      ? `MUST TEST (pick 1-2 for direct testing):\n${mustTest.map((g) => `- ${g.pattern}: ${g.description}`).join("\n")}\n\n1-2 questions should directly test a "must test" grammar point.\nThe remaining questions may USE these grammar points naturally but should focus on other skills.\n\nAVAILABLE AT THIS LEVEL (use naturally in stems, options, passages):\n- ${grammar.allowed.map((g) => g.pattern).join(", ")}`
      : "";

  const vocabBlock =
    vocabSample.length > 0
      ? `VOCABULARY PALETTE (level-appropriate words for this topic — use naturally, don't force):\n${vocabSample.join(", ")}\n\nThese words define what's appropriate for this level and topic.\nDraw from them when building sentences, options, and passages, but\nprioritize natural, authentic language over cramming in specific words.`
      : "";

  const difficultyAnchor =
    DIFFICULTY_ANCHORS[batch.language]?.[batch.level] ?? "";

  const distractorRules = `DISTRACTOR RULES (for every MCQ):
Construct 3 wrong answers following this pattern:
1. NEAR MISS: Similar form, sound, or meaning to correct answer
2. LEVEL ERROR: A common mistake for ${batch.levelLabel} learners
3. SEMANTIC FIELD: Same topic/category but clearly different meaning

All distractors must be the same part of speech and similar length as the correct answer.

${DISTRACTOR_EXAMPLES[batch.language] ?? ""}`;

  const grammarAllowed =
    grammar.allowed.length > 0
      ? `ALLOWED grammar at ${batch.levelLabel}:\n${grammar.allowed.map((g) => `- ${g.pattern}: ${g.description}`).join("\n")}`
      : "";

  const grammarForbidden =
    grammar.forbidden.length > 0
      ? `FORBIDDEN grammar (above ${batch.levelLabel} — do NOT use):\n${grammar.forbidden.map((g) => `- ${g.pattern}: ${g.description}`).join("\n")}`
      : "";

  const goalDirective = GOAL_DIRECTIVES[batch.learningGoal] ?? "";
  const culturalContext = CULTURAL_CONTEXTS[batch.language] ?? "";

  let prompt = template;
  prompt = prompt.replace(/\{\{language\}\}/g, batch.language);
  prompt = prompt.replace(/\{\{languageName\}\}/g, batch.languageName);
  prompt = prompt.replace(/\{\{level\}\}/g, batch.level);
  prompt = prompt.replace(/\{\{levelLabel\}\}/g, batch.levelLabel);
  prompt = prompt.replace(/\{\{questionType\}\}/g, batch.questionType);
  prompt = prompt.replace(/\{\{targetSkill\}\}/g, batch.targetSkill);
  prompt = prompt.replace(/\{\{topic\}\}/g, batch.topic);
  prompt = prompt.replace(/\{\{learningGoal\}\}/g, batch.learningGoal);
  prompt = prompt.replace(/\{\{grammarPoints\}\}/g, grammarPointsBlock);
  prompt = prompt.replace(/\{\{vocabSample\}\}/g, vocabBlock);
  prompt = prompt.replace(/\{\{difficultyAnchor\}\}/g, difficultyAnchor);
  prompt = prompt.replace(/\{\{distractorRules\}\}/g, distractorRules);
  prompt = prompt.replace(/\{\{grammarAllowed\}\}/g, grammarAllowed);
  prompt = prompt.replace(/\{\{grammarForbidden\}\}/g, grammarForbidden);
  prompt = prompt.replace(/\{\{goalDirective\}\}/g, goalDirective);
  prompt = prompt.replace(/\{\{culturalContext\}\}/g, culturalContext);

  return prompt;
}

// ============================================
// GENERATION
// ============================================

async function generateBatch(
  prompt: string,
  schemaPath: string,
  batchId: string,
): Promise<{ questions: Array<Record<string, unknown>> } | null> {
  // Write prompt to a unique temp file to avoid collisions during parallel runs
  const tmpPromptPath = path.join(PIPELINE_DIR, `.tmp_prompt_${batchId}.txt`);
  try {
    fs.writeFileSync(tmpPromptPath, prompt);

    const wrapperPath = path.join(PIPELINE_DIR, "run-claude.sh");
    const cmd = `cat '${tmpPromptPath}' | '${wrapperPath}' -p --output-format json --json-schema '${schemaPath}' --model claude-sonnet-4-6 --max-turns 1`;

    const { stdout } = await exec(cmd, {
      maxBuffer: 1024 * 1024,
      timeout: 300_000,
      cwd: PIPELINE_DIR,
    });

    const parsed = JSON.parse(stdout);
    // claude --output-format json returns { result: string, ... } or structured_output
    if (parsed.result) {
      // The result field contains the JSON string
      try {
        return JSON.parse(parsed.result);
      } catch {
        return parsed.result;
      }
    }
    return parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string }).stderr ?? "";
    console.error(`  claude -p failed: ${message.slice(0, 500)}`);
    if (stderr) console.error(`  stderr: ${stderr.slice(0, 500)}`);
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpPromptPath);
    } catch {
      /* ignore */
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  // Parse CLI flags
  const getFlag = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const languageArg = getFlag("language") ?? "all";
  const levelArg = getFlag("level");
  const trialArg = getFlag("trial") ? parseInt(getFlag("trial")!) : undefined;
  const parallelArg = getFlag("parallel")
    ? Math.min(parseInt(getFlag("parallel")!), 4)
    : 4;
  const typeArg = getFlag("type");
  const dryRun = hasFlag("dry-run");
  const resume = !hasFlag("fresh");

  const languages =
    languageArg === "all" ? ["japanese", "english", "french"] : [languageArg];

  const schemaPath = path.join(PIPELINE_DIR, "schemas", "question_batch.json");
  if (!fs.existsSync(schemaPath)) {
    console.error(`Schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  const template = loadPromptTemplate();

  for (const language of languages) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  Generating questions for: ${language.toUpperCase()}`);
    console.log(`${"=".repeat(60)}`);

    const spec = loadSpec(language);
    const grammarConstraints = loadGrammarConstraints(spec);
    const manifest = resume ? loadManifest(language) : {};

    // Collect existing hashes for dedup
    const existingHashes = new Set<string>();
    for (const entry of Object.values(manifest)) {
      if (entry.status === "generated" || entry.status === "validated") {
        if (entry.outputFile && fs.existsSync(entry.outputFile)) {
          try {
            const batch = JSON.parse(
              fs.readFileSync(entry.outputFile, "utf-8"),
            );
            for (const q of batch.questions) {
              existingHashes.add(
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
            // Skip unreadable files
          }
        }
      }
    }

    const batches = computeBatchMatrix(spec, {
      level: levelArg,
      type: typeArg,
      trial: trialArg,
    });

    // Filter out already-generated batches if resuming
    const pendingBatches = resume
      ? batches.filter(
          (b) =>
            !manifest[b.batchId] || manifest[b.batchId].status === "failed",
        )
      : batches;

    console.log(
      `  Total batches: ${batches.length} | Pending: ${pendingBatches.length} | Questions target: ~${pendingBatches.length * 5}`,
    );

    if (dryRun) {
      console.log("\n  DRY RUN — batch breakdown:");
      const byLevel: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byTopic: Record<string, number> = {};
      for (const b of pendingBatches) {
        byLevel[b.levelLabel] = (byLevel[b.levelLabel] ?? 0) + 1;
        byType[b.questionType] = (byType[b.questionType] ?? 0) + 1;
        byTopic[b.topic] = (byTopic[b.topic] ?? 0) + 1;
      }
      console.log("  By level:", byLevel);
      console.log("  By type:", byType);
      console.log("  By topic:", byTopic);
      continue;
    }

    // Process batches (with optional parallelism)
    let completed = 0;
    const total = pendingBatches.length;

    const processBatch = async (batch: BatchSpec) => {
      const vocabByTopic = loadVocabByTopic(spec, batch.level);
      const prompt = buildPrompt(
        template,
        batch,
        grammarConstraints,
        vocabByTopic,
        spec,
      );

      console.log(
        `\n  [${completed + 1}/${total}] ${batch.batchId} (${batch.questionType} / ${batch.topic} / ${batch.learningGoal})`,
      );

      const result = await generateBatch(prompt, schemaPath, batch.batchId);

      if (!result || !result.questions) {
        manifest[batch.batchId] = {
          batchId: batch.batchId,
          status: "failed",
          error: "No questions returned from claude",
          generatedAt: new Date().toISOString(),
        };
        console.log("    FAILED: no questions returned");
        completed++;
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questions = result.questions as any[];

      // Validate
      const validation = validateBatch(
        questions,
        batch.questionType,
        batch.level,
        existingHashes,
      );

      // Save output regardless of validation
      const outputDir = path.join(
        PIPELINE_DIR,
        "output",
        batch.language,
        batch.level,
      );
      if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });

      const outputFile = path.join(
        outputDir,
        `batch_${String(completed).padStart(4, "0")}_${batch.questionType}_${batch.topic}.json`,
      );

      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          {
            batchId: batch.batchId,
            language: batch.language,
            level: batch.level,
            questionType: batch.questionType,
            targetSkill: batch.targetSkill,
            topic: batch.topic,
            learningGoal: batch.learningGoal,
            questions,
            validation: {
              valid: validation.valid,
              errorCount: validation.errors.length,
              dupeCount: validation.hashConflicts.length,
            },
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );

      // Add hashes to existing set
      for (const q of questions) {
        existingHashes.add(
          hashQuestionContent({
            questionType: q.type,
            question: q.question,
            passageText: q.passageText,
            correctAnswer: q.correctAnswer,
            options: q.options,
          }),
        );
      }

      manifest[batch.batchId] = {
        batchId: batch.batchId,
        status: validation.valid ? "validated" : "generated",
        outputFile,
        questionCount: questions.length,
        error: validation.valid
          ? undefined
          : `${validation.errors.length} errors, ${validation.hashConflicts.length} dupes`,
        generatedAt: new Date().toISOString(),
      };

      const statusIcon = validation.valid ? "OK" : "WARN";
      console.log(
        `    ${statusIcon}: ${questions.length} questions | ${validation.errors.length} errors | ${validation.hashConflicts.length} dupes`,
      );

      completed++;
    };

    if (parallelArg <= 1) {
      // Sequential
      for (const batch of pendingBatches) {
        await processBatch(batch);
        saveManifest(language, manifest);
      }
    } else {
      // Parallel: process in chunks of parallelArg
      for (let i = 0; i < pendingBatches.length; i += parallelArg) {
        const chunk = pendingBatches.slice(i, i + parallelArg);
        await Promise.all(chunk.map((batch) => processBatch(batch)));
        saveManifest(language, manifest);
      }
    }

    saveManifest(language, manifest);

    // Summary
    const stats = Object.values(manifest);
    const validated = stats.filter((s) => s.status === "validated").length;
    const generated = stats.filter((s) => s.status === "generated").length;
    const failed = stats.filter((s) => s.status === "failed").length;
    const totalQ = stats.reduce((sum, s) => sum + (s.questionCount ?? 0), 0);

    console.log(`\n  --- ${language} Summary ---`);
    console.log(
      `  Validated: ${validated} | With warnings: ${generated} | Failed: ${failed}`,
    );
    console.log(`  Total questions: ${totalQ}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

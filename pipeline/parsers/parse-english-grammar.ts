import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, "../downloads");
const OUT_DIR = join(__dirname, "../reference/english_grammar");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

mkdirSync(OUT_DIR, { recursive: true });

const raw = readFileSync(
  join(DOWNLOADS_DIR, "cefrj-grammar-profile-20180315.csv"),
  "utf-8",
);

const rows = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
});

interface GrammarPoint {
  id: string;
  grammaticalItem: string;
  sentenceType: string;
}

const byLevel = new Map<string, GrammarPoint[]>();
for (const level of LEVELS) {
  byLevel.set(level, []);
}

function normalizeLevel(raw: string): string | null {
  let level = raw.trim().toUpperCase();

  // Remove asterisks
  level = level.replace(/\*/g, "");

  // Handle ranges like "A2-B1" → take lowest
  if (level.includes("-")) {
    level = level.split("-")[0];
  }

  // Handle sub-levels like "A1.1" → "A1"
  level = level.replace(/\.\d+$/, "");

  if (LEVELS.includes(level as (typeof LEVELS)[number])) {
    return level;
  }
  return null;
}

for (const row of rows) {
  // Try common column names (the CSV may have varying header names)
  const id = (row["ID"] || row["id"] || "").trim();
  const grammaticalItem = (
    row["Grammatical Item"] ||
    row["grammatical_item"] ||
    row["Grammatical item"] ||
    ""
  ).trim();
  const sentenceType = (
    row["Sentence Type"] ||
    row["sentence_type"] ||
    row["Sentence type"] ||
    ""
  ).trim();
  const rawLevel = (
    row["CEFR-J Level"] ||
    row["CEFR-J level"] ||
    row["cefr_j_level"] ||
    row["Level"] ||
    row["level"] ||
    ""
  ).trim();

  const level = normalizeLevel(rawLevel);
  if (!level || !grammaticalItem) continue;

  byLevel.get(level)?.push({ id, grammaticalItem, sentenceType });
}

for (const level of LEVELS) {
  const points = byLevel.get(level)!;

  const outFile = join(OUT_DIR, `${level}.json`);
  writeFileSync(outFile, JSON.stringify(points, null, 2) + "\n", "utf-8");
  console.log(`${level}: ${points.length} grammar points`);
}

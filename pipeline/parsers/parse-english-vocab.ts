import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, "../downloads");
const OUT_DIR = join(__dirname, "../reference/english_vocab");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

mkdirSync(OUT_DIR, { recursive: true });

// Map each word to its lowest CEFR level
const wordMap = new Map<string, { pos: string; level: string }>();

function cefrRank(level: string): number {
  const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return order.indexOf(level);
}

// Parse CEFR-J vocabulary (A1-B2)
const cefrjRaw = readFileSync(
  join(DOWNLOADS_DIR, "cefrj-vocabulary-profile-1.5.csv"),
  "utf-8",
);
const cefrjRows = parse(cefrjRaw, { columns: true, skip_empty_lines: true });

for (const row of cefrjRows) {
  const headword = (row["headword"] || "").trim().toLowerCase();
  const pos = (row["pos"] || "").trim();
  let level = (row["CEFR"] || "").trim().toUpperCase();

  if (!headword || !level) continue;

  // Normalize level: A1.1 → A1, A2-B1 → A2 (take lowest)
  if (level.includes("-")) {
    level = level.split("-")[0];
  }
  level = level.replace(/\.\d+$/, "");

  if (!LEVELS.includes(level as (typeof LEVELS)[number])) continue;

  const key = `${headword}|${pos}`;
  const existing = wordMap.get(key);
  if (!existing || cefrRank(level) < cefrRank(existing.level)) {
    wordMap.set(key, { pos, level });
  }
}

// Parse Octanove vocabulary (C1-C2)
const octRaw = readFileSync(
  join(DOWNLOADS_DIR, "octanove-vocabulary-profile-c1c2-1.0.csv"),
  "utf-8",
);
const octRows = parse(octRaw, { columns: true, skip_empty_lines: true });

for (const row of octRows) {
  const headword = (row["headword"] || "").trim().toLowerCase();
  const pos = (row["pos"] || "").trim();
  let level = (row["CEFR"] || "").trim().toUpperCase();

  if (!headword || !level) continue;

  // Normalize
  if (level.includes("-")) {
    level = level.split("-")[0];
  }
  level = level.replace(/\.\d+$/, "");

  if (!LEVELS.includes(level as (typeof LEVELS)[number])) continue;

  const key = `${headword}|${pos}`;
  const existing = wordMap.get(key);
  if (!existing || cefrRank(level) < cefrRank(existing.level)) {
    wordMap.set(key, { pos, level });
  }
}

// Group by level and write CSVs
const byLevel = new Map<string, { word: string; pos: string }[]>();
for (const level of LEVELS) {
  byLevel.set(level, []);
}

for (const [key, { pos, level }] of wordMap) {
  const word = key.split("|")[0];
  byLevel.get(level)?.push({ word, pos });
}

for (const level of LEVELS) {
  const entries = byLevel.get(level)!;
  entries.sort((a, b) => a.word.localeCompare(b.word, "en"));

  const csv =
    "word,pos\n" + entries.map((e) => `${e.word},${e.pos}`).join("\n") + "\n";
  const outFile = join(OUT_DIR, `${level}.csv`);
  writeFileSync(outFile, csv, "utf-8");
  console.log(`${level}: ${entries.length} words`);
}

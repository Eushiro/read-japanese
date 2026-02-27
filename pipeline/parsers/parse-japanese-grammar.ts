import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, "../downloads");
const OUT_DIR = join(__dirname, "../reference/japanese_grammar");
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

mkdirSync(OUT_DIR, { recursive: true });

const raw = readFileSync(
  join(DOWNLOADS_DIR, "jlpt-grammar-full-list.csv"),
  "utf-8",
);

// No header row — columns: level, number, pattern_jp, romanization, meaning, (empty x5), notes
const rows = parse(raw, {
  columns: false,
  skip_empty_lines: true,
  relax_column_count: true,
});

interface GrammarPoint {
  number: number;
  pattern: string;
  romanization: string;
  meaning: string;
}

const byLevel = new Map<string, GrammarPoint[]>();
for (const level of LEVELS) {
  byLevel.set(level, []);
}

for (const row of rows) {
  const level = (row[0] || "").trim().toUpperCase();
  const number = parseInt(row[1], 10);
  const pattern = (row[2] || "").trim();
  const romanization = (row[3] || "").trim();
  const meaning = (row[4] || "").trim();

  if (!LEVELS.includes(level as (typeof LEVELS)[number])) continue;
  if (!pattern) continue;

  byLevel.get(level)?.push({ number, pattern, romanization, meaning });
}

for (const level of LEVELS) {
  const points = byLevel.get(level)!;
  points.sort((a, b) => a.number - b.number);

  const outFile = join(OUT_DIR, `${level}.json`);
  writeFileSync(outFile, JSON.stringify(points, null, 2) + "\n", "utf-8");
  console.log(`${level}: ${points.length} grammar points`);
}

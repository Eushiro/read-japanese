import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, "../downloads");
const OUT_DIR = join(__dirname, "../reference/french_vocab");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// TreeTagger POS tag mapping
const POS_MAP: Record<string, string> = {
  NOM: "noun",
  VER: "verb",
  ADJ: "adjective",
  ADV: "adverb",
  PRE: "preposition",
  DET: "determiner",
  CON: "conjunction",
  PRO: "pronoun",
  INT: "interjection",
  ABR: "abbreviation",
  NUM: "number",
  NAM: "proper noun",
  PRP: "preposition",
  KON: "conjunction",
  SYM: "symbol",
  PUN: "punctuation",
  SENT: "punctuation",
};

function mapPos(tag: string): string {
  // Tags can have subtypes like "VER:pres", take the prefix
  const prefix = tag.split(":")[0].toUpperCase();
  return POS_MAP[prefix] || tag.toLowerCase();
}

mkdirSync(OUT_DIR, { recursive: true });

const raw = readFileSync(join(DOWNLOADS_DIR, "FleLex_TT_Beacco.tsv"), "utf-8");
const lines = raw.split("\n");

// First line is header — trim \r from column names
const header = lines[0].split("\t").map((h) => h.trim());
const wordIdx = header.indexOf("word");
const tagIdx = header.indexOf("tag");
const levelIdx = header.indexOf("level");

if (wordIdx === -1 || tagIdx === -1 || levelIdx === -1) {
  console.error("Missing expected columns. Header:", header);
  process.exit(1);
}

// Collect unique word+pos per level (dedup)
const byLevel = new Map<string, Map<string, string>>();
for (const level of LEVELS) {
  byLevel.set(level, new Map());
}

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const cols = line.split("\t");
  const word = (cols[wordIdx] || "").trim();
  const tag = (cols[tagIdx] || "").trim();
  const level = (cols[levelIdx] || "").trim().toUpperCase();

  if (!word || !level) continue;
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) continue;

  const pos = mapPos(tag);
  const levelMap = byLevel.get(level);
  if (levelMap && !levelMap.has(`${word}|${pos}`)) {
    levelMap.set(`${word}|${pos}`, pos);
  }
}

for (const level of LEVELS) {
  const levelMap = byLevel.get(level)!;
  const entries: { word: string; pos: string }[] = [];

  for (const [key, pos] of levelMap) {
    const word = key.split("|")[0];
    entries.push({ word, pos });
  }

  entries.sort((a, b) => a.word.localeCompare(b.word, "fr"));

  // Escape any commas in words (shouldn't be common but be safe)
  const csv =
    "word,pos\n" +
    entries
      .map((e) => {
        const w = e.word.includes(",") ? `"${e.word}"` : e.word;
        return `${w},${e.pos}`;
      })
      .join("\n") +
    "\n";

  const outFile = join(OUT_DIR, `${level}.csv`);
  writeFileSync(outFile, csv, "utf-8");
  console.log(`${level}: ${entries.length} words`);
}

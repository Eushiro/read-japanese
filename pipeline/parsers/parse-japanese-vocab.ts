import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVELS = ["n5", "n4", "n3", "n2", "n1"] as const;
const JLPT_DIR = join(__dirname, "../../backend/app/data/jlpt");
const OUT_DIR = join(__dirname, "../reference/japanese_vocab");

mkdirSync(OUT_DIR, { recursive: true });

for (const level of LEVELS) {
  const raw = readFileSync(join(JLPT_DIR, `${level}.txt`), "utf-8");
  const words: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // One word per line
    words.push(trimmed);
  }

  const csv = "word\n" + words.join("\n") + "\n";
  const outFile = join(OUT_DIR, `${level.toUpperCase()}.csv`);
  writeFileSync(outFile, csv, "utf-8");
  console.log(`${level.toUpperCase()}: ${words.length} words`);
}

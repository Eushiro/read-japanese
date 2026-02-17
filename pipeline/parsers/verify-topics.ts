import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_DIR = join(__dirname, "../reference");

const LANGUAGES: {
  name: string;
  dir: string;
  levels: string[];
  wordColumn: string;
}[] = [
  {
    name: "Japanese",
    dir: "japanese_vocab",
    levels: ["N5", "N4", "N3", "N2", "N1"],
    wordColumn: "word",
  },
  {
    name: "English",
    dir: "english_vocab",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
    wordColumn: "word",
  },
  {
    name: "French",
    dir: "french_vocab",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
    wordColumn: "word",
  },
];

function extractWordsFromCsv(csvPath: string, wordColumn: string): string[] {
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].split(",");
  const colIndex = header.indexOf(wordColumn);
  if (colIndex === -1) {
    throw new Error(`Column "${wordColumn}" not found in ${csvPath}`);
  }

  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    return parts[colIndex].trim();
  });
}

function flattenTopicJson(jsonPath: string): Set<string> {
  const data = JSON.parse(readFileSync(jsonPath, "utf-8")) as Record<
    string,
    string[]
  >;
  const words = new Set<string>();
  for (const topic of Object.keys(data)) {
    for (const word of data[topic]) {
      words.add(word);
    }
  }
  return words;
}

let hasErrors = false;
let totalLevels = 0;
let passedLevels = 0;

for (const lang of LANGUAGES) {
  console.log(`\n=== ${lang.name} ===`);
  const langDir = join(REF_DIR, lang.dir);

  for (const level of lang.levels) {
    totalLevels++;
    const csvPath = join(langDir, `${level}.csv`);
    const jsonPath = join(langDir, `${level}_by_topic.json`);

    if (!existsSync(jsonPath)) {
      console.log(`  ${level}: MISSING ${level}_by_topic.json`);
      hasErrors = true;
      continue;
    }

    const csvWords = extractWordsFromCsv(csvPath, lang.wordColumn);
    const topicWords = flattenTopicJson(jsonPath);

    const missing = csvWords.filter((w) => !topicWords.has(w));
    const extras = [...topicWords].filter((w) => !csvWords.includes(w));

    if (missing.length === 0 && extras.length === 0) {
      console.log(
        `  ${level}: OK (${csvWords.length} words, ${Object.keys(JSON.parse(readFileSync(jsonPath, "utf-8"))).length} topics)`,
      );
      passedLevels++;
    } else {
      hasErrors = true;
      if (missing.length > 0) {
        console.log(`  ${level}: MISSING ${missing.length} words from topics:`);
        console.log(
          `    ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ` ... and ${missing.length - 20} more` : ""}`,
        );
      }
      if (extras.length > 0) {
        console.log(
          `  ${level}: EXTRA ${extras.length} words in topics not in CSV:`,
        );
        console.log(
          `    ${extras.slice(0, 20).join(", ")}${extras.length > 20 ? ` ... and ${extras.length - 20} more` : ""}`,
        );
      }
    }
  }
}

console.log(`\n=== Summary: ${passedLevels}/${totalLevels} levels passed ===`);

if (hasErrors) {
  process.exit(1);
}

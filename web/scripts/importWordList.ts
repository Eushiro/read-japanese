/**
 * Import Word List Script
 *
 * Imports vocabulary from CSV/JSON files into premade decks.
 *
 * Usage:
 *   npx tsx scripts/importWordList.ts --create-deck jlpt_n5 --name "JLPT N5" --language japanese --level N5
 *   npx tsx scripts/importWordList.ts --import jlpt_n5 --file data/jlpt_n5.csv
 *   npx tsx scripts/importWordList.ts --stats jlpt_n5
 *
 * Expected CSV format:
 *   word,reading,definition
 *   食べる,たべる,to eat
 *
 * Expected JSON format:
 *   [{"word": "食べる", "reading": "たべる", "definitions": ["to eat"]}]
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";

import { api } from "../convex/_generated/api";

// ============================================
// CONFIGURATION
// ============================================

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: CONVEX_URL or VITE_CONVEX_URL environment variable required");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

// ============================================
// CSV PARSING
// ============================================

interface WordEntry {
  word: string;
  reading?: string;
  definitions: string[];
  partOfSpeech?: string;
}

function parseCSV(content: string): WordEntry[] {
  const lines = content.trim().split("\n");
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());

  // Find column indices
  const wordIdx = header.findIndex((h) => h === "word" || h === "expression" || h === "kanji");
  const readingIdx = header.findIndex((h) => h === "reading" || h === "kana" || h === "hiragana");
  const defIdx = header.findIndex((h) => h === "definition" || h === "meaning" || h === "english");
  const posIdx = header.findIndex((h) => h === "pos" || h === "partofspeech" || h === "part_of_speech");

  if (wordIdx === -1) {
    throw new Error("CSV must have a 'word' or 'expression' column");
  }

  const entries: WordEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values
    const values = parseCSVLine(line);

    const word = values[wordIdx]?.trim();
    if (!word) continue;

    const reading = readingIdx !== -1 ? values[readingIdx]?.trim() : undefined;
    const definition = defIdx !== -1 ? values[defIdx]?.trim() : undefined;
    const pos = posIdx !== -1 ? values[posIdx]?.trim() : undefined;

    entries.push({
      word,
      reading: reading || undefined,
      definitions: definition ? [definition] : ["(no definition)"],
      partOfSpeech: pos || undefined,
    });
  }

  return entries;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseJSON(content: string): WordEntry[] {
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array of word objects");
  }

  return data.map((item: Record<string, unknown>) => ({
    word: String(item.word || item.expression || ""),
    reading: item.reading ? String(item.reading) : undefined,
    definitions: Array.isArray(item.definitions)
      ? item.definitions.map(String)
      : item.definition
        ? [String(item.definition)]
        : item.meaning
          ? [String(item.meaning)]
          : ["(no definition)"],
    partOfSpeech: item.partOfSpeech ? String(item.partOfSpeech) : undefined,
  })).filter((e) => e.word);
}

// ============================================
// MAIN CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Import Word List Script

Usage:
  npx tsx scripts/importWordList.ts --create-deck <deckId> --name <name> --language <lang> --level <level>
  npx tsx scripts/importWordList.ts --import <deckId> --file <path>
  npx tsx scripts/importWordList.ts --stats <deckId>
  npx tsx scripts/importWordList.ts --list-decks

Options:
  --create-deck <id>  Create a new deck with given ID
  --name <name>       Deck display name
  --language <lang>   japanese, english, or french
  --level <level>     N5-N1, A1-C2, etc.
  --description <d>   Deck description

  --import <deckId>   Import words into existing deck
  --file <path>       Path to CSV or JSON file
  --copy-existing     Copy generated content from other decks (saves AI costs)

  --stats <deckId>    Show stats for a deck
  --list-decks        List all decks

Examples:
  # Create JLPT N5 deck
  npx tsx scripts/importWordList.ts --create-deck jlpt_n5 --name "JLPT N5" --language japanese --level N5 --description "Basic vocabulary for JLPT N5"

  # Import words from CSV
  npx tsx scripts/importWordList.ts --import jlpt_n5 --file data/jlpt_n5.csv

  # Import with content from other decks (for "Top 1000" style decks)
  npx tsx scripts/importWordList.ts --import top_1000 --file data/top_1000.csv --copy-existing

  # Check stats
  npx tsx scripts/importWordList.ts --stats jlpt_n5
`);
    return;
  }

  // Parse arguments
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const hasFlag = (flag: string): boolean => args.includes(flag);

  // List decks
  if (hasFlag("--list-decks")) {
    const decks = await convex.query(api.premadeDecks.listAllDecks, {});

    if (decks.length === 0) {
      console.log("No decks found");
      return;
    }

    console.log("\nDecks:");
    for (const deck of decks) {
      const status = deck.isPublished ? "✓" : "○";
      console.log(`  ${status} ${deck.deckId}: ${deck.name} (${deck.totalWords} words)`);
    }
    return;
  }

  // Stats
  const statsId = getArg("--stats");
  if (statsId) {
    const deck = await convex.query(api.premadeDecks.getDeck, { deckId: statsId });
    const stats = await convex.query(api.premadeDecks.getDeckGenerationStats, { deckId: statsId });

    if (!deck) {
      console.error(`Deck '${statsId}' not found`);
      return;
    }

    console.log(`\nDeck: ${deck.name} (${deck.deckId})`);
    console.log(`  Language: ${deck.language}`);
    console.log(`  Level: ${deck.level}`);
    console.log(`  Published: ${deck.isPublished ? "Yes" : "No"}`);
    console.log(`\nGeneration Status:`);
    console.log(`  Total words: ${stats.total}`);
    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Generating: ${stats.generating}`);
    console.log(`  Complete: ${stats.complete}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`\nContent:`);
    console.log(`  With sentences: ${stats.withSentences}`);
    console.log(`  With audio: ${stats.withAudio}`);
    console.log(`  With images: ${stats.withImages}`);
    return;
  }

  // Create deck
  const createDeckId = getArg("--create-deck");
  if (createDeckId) {
    const name = getArg("--name");
    const language = getArg("--language") as "japanese" | "english" | "french";
    const level = getArg("--level");
    const description = getArg("--description") || `${name} vocabulary deck`;

    if (!name || !language || !level) {
      console.error("Error: --name, --language, and --level are required for creating a deck");
      return;
    }

    if (!["japanese", "english", "french"].includes(language)) {
      console.error("Error: --language must be 'japanese', 'english', or 'french'");
      return;
    }

    try {
      await convex.mutation(api.premadeDecks.createDeck, {
        deckId: createDeckId,
        name,
        description,
        language,
        level,
      });
      console.log(`\nCreated deck: ${createDeckId}`);
      console.log(`  Name: ${name}`);
      console.log(`  Language: ${language}`);
      console.log(`  Level: ${level}`);
    } catch (error) {
      console.error(`Error creating deck:`, error);
    }
    return;
  }

  // Import
  const importDeckId = getArg("--import");
  const filePath = getArg("--file");

  if (importDeckId && filePath) {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();

    let entries: WordEntry[];

    if (ext === ".csv") {
      entries = parseCSV(content);
    } else if (ext === ".json") {
      entries = parseJSON(content);
    } else {
      console.error("File must be .csv or .json");
      return;
    }

    console.log(`\nParsed ${entries.length} entries from ${path.basename(filePath)}`);

    if (entries.length === 0) {
      console.log("No entries to import");
      return;
    }

    // Check for --copy-existing flag
    const copyExisting = hasFlag("--copy-existing");
    if (copyExisting) {
      console.log("Will copy existing content from other decks");
    }

    // Import in batches of 100
    const BATCH_SIZE = 100;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalCopied = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const result = await convex.mutation(api.premadeDecks.importVocabulary, {
        deckId: importDeckId,
        items: batch,
        copyExistingContent: copyExisting,
      });

      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalCopied += result.copiedContent;

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.imported} imported, ${result.skipped} skipped, ${result.copiedContent} copied from other decks`);
    }

    console.log(`\nImport complete:`);
    console.log(`  Imported: ${totalImported}`);
    console.log(`  Skipped (duplicates): ${totalSkipped}`);
    if (copyExisting) {
      console.log(`  Copied content from other decks: ${totalCopied}`);
      console.log(`  Still need generation: ${totalImported - totalCopied}`);
    }

    // Update deck stats
    await convex.mutation(api.premadeDecks.updateDeckStats, { deckId: importDeckId });
    return;
  }

  console.error("Invalid arguments. Run without arguments for help.");
}

main().catch(console.error);

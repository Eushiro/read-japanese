/**
 * Extract exam questions from PDF files using AI
 *
 * Usage:
 *   # Extract with answers in same PDF
 *   npx tsx scripts/extractExamQuestions.ts \
 *     --file data/exams/jlpt/n5_2023_reading.pdf \
 *     --exam-type jlpt_n5 \
 *     --section reading
 *
 *   # Extract with separate answer key
 *   npx tsx scripts/extractExamQuestions.ts \
 *     --file data/exams/jlpt/n5_2023_vocabulary.pdf \
 *     --answers data/exams/jlpt/n5_2023_vocabulary_answers.pdf \
 *     --exam-type jlpt_n5 \
 *     --section vocabulary
 *
 *   # Batch process entire directory
 *   npx tsx scripts/extractExamQuestions.ts \
 *     --dir data/exams/jlpt \
 *     --exam-type jlpt_n5
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";

import brandConfig from "../../shared/brand.json";
import { TEXT_MODELS } from "../convex/lib/models";

// Exam types and their languages
const EXAM_LANGUAGES: Record<string, string> = {
  jlpt_n5: "japanese",
  jlpt_n4: "japanese",
  jlpt_n3: "japanese",
  jlpt_n2: "japanese",
  jlpt_n1: "japanese",
  toefl: "english",
  sat: "english",
  gre: "english",
  delf_a1: "french",
  delf_a2: "french",
  delf_b1: "french",
  delf_b2: "french",
  dalf_c1: "french",
  dalf_c2: "french",
  tcf: "french",
};

// Section types
type SectionType = "reading" | "listening" | "vocabulary" | "grammar" | "writing";

interface ExtractedQuestion {
  questionText: string;
  questionType: "multiple_choice" | "short_answer" | "essay" | "translation" | "fill_blank";
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  points: number;
  passageText?: string;
}

interface ExtractionResult {
  examType: string;
  language: string;
  section: SectionType;
  source: string;
  passage?: string;
  questions: ExtractedQuestion[];
  extractedAt: string;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    parsed[key] = value;
  }

  return parsed;
}

// Placeholder for PDF parsing - would use pdf-parse in production
async function readPdfContent(filePath: string): Promise<string> {
  // In production, use pdf-parse or similar library
  // For now, we'll read text files for testing
  if (filePath.endsWith(".txt")) {
    return readFileSync(filePath, "utf-8");
  }

  // Attempt to use pdf-parse if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error("pdf-parse not available. Install with: npm install pdf-parse");
    console.error("For testing, you can provide a .txt file instead.");
    throw error;
  }
}

// Call AI to extract questions from PDF content
async function extractQuestionsWithAI(
  content: string,
  answersContent: string | null,
  examType: string,
  section: SectionType
): Promise<ExtractedQuestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  const language = EXAM_LANGUAGES[examType] || "japanese";
  const languageName =
    language === "japanese" ? "Japanese" : language === "french" ? "French" : "English";

  const systemPrompt = `You are an expert at extracting exam questions from ${languageName} language proficiency tests.

Extract all questions from the provided exam content. For each question, identify:
1. The question text (in ${languageName})
2. The question type (multiple_choice, short_answer, essay, translation, or fill_blank)
3. Answer options if multiple choice (array of strings)
4. The correct answer
5. Any passage or context the question relates to
6. Point value (estimate if not provided: MC=2, short=5, essay=10)

${answersContent ? `\nAnswer key is provided separately. Match answers to questions by number.` : "Correct answers should be in the PDF. Look for answer sections or marked correct options."}

Respond with valid JSON in this exact format:
{
  "passage": "Optional reading passage if present",
  "questions": [
    {
      "questionText": "The question in ${languageName}",
      "questionType": "multiple_choice",
      "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
      "correctAnswer": "B",
      "explanation": "Optional explanation",
      "points": 2
    }
  ]
}

IMPORTANT:
- Extract ALL questions, not just the first few
- Preserve exact text in ${languageName}
- For multiple choice, correctAnswer should be the option letter (A, B, C, D) or exact text
- If you can't determine the correct answer, use "" as placeholder`;

  let userPrompt = `Extract questions from this ${examType.replace("_", " ").toUpperCase()} ${section} section:\n\n${content}`;

  if (answersContent) {
    userPrompt += `\n\n--- ANSWER KEY ---\n${answersContent}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": `https://${brandConfig.domain}`,
      "X-Title": `${brandConfig.name} Exam Extractor`,
    },
    body: JSON.stringify({
      model: `google/${TEXT_MODELS.GEMINI_3_FLASH}`,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI extraction failed: ${error}`);
  }

  const result = await response.json();
  const content_result = result.choices?.[0]?.message?.content;

  if (!content_result) {
    throw new Error("No content in AI response");
  }

  try {
    const parsed = JSON.parse(content_result);
    return parsed.questions || [];
  } catch (error) {
    console.error("Failed to parse AI response:", content_result);
    throw error;
  }
}

// Main extraction function
async function extractFromFile(
  filePath: string,
  answersPath: string | null,
  examType: string,
  section: SectionType
): Promise<ExtractionResult> {
  console.log(`\nExtracting from: ${filePath}`);
  if (answersPath) {
    console.log(`Answer key: ${answersPath}`);
  }

  // Read PDF content
  const content = await readPdfContent(filePath);
  const answersContent = answersPath ? await readPdfContent(answersPath) : null;

  console.log(`Read ${content.length} characters from exam file`);
  if (answersContent) {
    console.log(`Read ${answersContent.length} characters from answer key`);
  }

  // Extract questions with AI
  console.log("Extracting questions with AI...");
  const questions = await extractQuestionsWithAI(content, answersContent, examType, section);

  console.log(`Extracted ${questions.length} questions`);

  return {
    examType,
    language: EXAM_LANGUAGES[examType] || "japanese",
    section,
    source: basename(filePath),
    questions,
    extractedAt: new Date().toISOString(),
  };
}

// Save extraction result
function saveResult(result: ExtractionResult, outputPath: string) {
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Saved to: ${outputPath}`);
}

// Process a single file
async function processFile(
  filePath: string,
  answersPath: string | null,
  examType: string,
  section: SectionType
) {
  const result = await extractFromFile(filePath, answersPath, examType, section);

  // Generate output path
  const dir = dirname(filePath);
  const base = basename(filePath, ".pdf").replace(".txt", "");
  const outputPath = join(dir, `${base}_extracted.json`);

  saveResult(result, outputPath);

  return result;
}

// Process a directory
async function processDirectory(dirPath: string, examType: string) {
  const files = readdirSync(dirPath).filter((f) => f.endsWith(".pdf") || f.endsWith(".txt"));

  // Group files by base name to match exams with answer keys
  const fileGroups: Record<string, { exam?: string; answers?: string }> = {};

  for (const file of files) {
    if (file.includes("_extracted")) continue; // Skip already extracted

    const base = file.replace("_answers", "").replace(".pdf", "").replace(".txt", "");

    if (!fileGroups[base]) {
      fileGroups[base] = {};
    }

    if (file.includes("_answers")) {
      fileGroups[base].answers = join(dirPath, file);
    } else {
      fileGroups[base].exam = join(dirPath, file);
    }
  }

  console.log(`Found ${Object.keys(fileGroups).length} exam files to process`);

  for (const [base, group] of Object.entries(fileGroups)) {
    if (!group.exam) continue;

    // Try to infer section from filename
    let section: SectionType = "reading";
    if (base.includes("listening")) section = "listening";
    else if (base.includes("vocab")) section = "vocabulary";
    else if (base.includes("grammar")) section = "grammar";
    else if (base.includes("writing")) section = "writing";

    try {
      await processFile(group.exam, group.answers || null, examType, section);
    } catch (error) {
      console.error(`Failed to process ${base}:`, error);
    }
  }
}

// Main
async function main() {
  const args = parseArgs();

  if (!args["exam-type"]) {
    console.error("Error: --exam-type is required");
    console.log("\nUsage:");
    console.log(
      "  npx tsx scripts/extractExamQuestions.ts --file <path> --exam-type <type> --section <section>"
    );
    console.log("  npx tsx scripts/extractExamQuestions.ts --dir <path> --exam-type <type>");
    console.log("\nExam types: jlpt_n5, jlpt_n4, jlpt_n3, jlpt_n2, jlpt_n1, toefl, delf_a1, etc.");
    console.log("Sections: reading, listening, vocabulary, grammar, writing");
    process.exit(1);
  }

  try {
    if (args.dir) {
      // Process directory
      await processDirectory(args.dir, args["exam-type"]);
    } else if (args.file) {
      // Process single file
      const section = (args.section || "reading") as SectionType;
      await processFile(args.file, args.answers || null, args["exam-type"], section);
    } else {
      console.error("Error: Either --file or --dir is required");
      process.exit(1);
    }

    console.log("\nExtraction complete!");
  } catch (error) {
    console.error("Extraction failed:", error);
    process.exit(1);
  }
}

main();

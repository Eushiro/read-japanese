/**
 * Import extracted exam questions to Convex
 *
 * Usage:
 *   npx tsx scripts/importExamToConvex.ts \
 *     --file data/exams/jlpt/n5_2023_reading_extracted.json \
 *     --title "JLPT N5 Reading 2023"
 *
 *   # Import with auto-publish
 *   npx tsx scripts/importExamToConvex.ts \
 *     --file data/exams/jlpt/n5_2023_reading_extracted.json \
 *     --title "JLPT N5 Reading 2023" \
 *     --publish
 */

import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

// Types matching the extraction output
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
  section: string;
  source: string;
  passage?: string;
  questions: ExtractedQuestion[];
  extractedAt: string;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        parsed[key] = nextArg;
        i++;
      } else {
        // Flag without value
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

// Import to Convex
async function importToConvex(
  data: ExtractionResult,
  title: string,
  publish: boolean
) {
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL environment variable is required");
  }

  const client = new ConvexHttpClient(convexUrl);

  console.log("\n--- Importing to Convex ---");
  console.log(`Convex URL: ${convexUrl}`);
  console.log(`Exam Type: ${data.examType}`);
  console.log(`Language: ${data.language}`);
  console.log(`Section: ${data.section}`);
  console.log(`Questions: ${data.questions.length}`);

  // 1. Create the exam template
  console.log("\n1. Creating exam template...");

  const totalPoints = data.questions.reduce((sum, q) => sum + q.points, 0);

  // Estimate time based on question types
  const timeEstimate = data.questions.reduce((sum, q) => {
    switch (q.questionType) {
      case "multiple_choice":
        return sum + 1; // 1 min per MC
      case "short_answer":
        return sum + 2;
      case "translation":
        return sum + 3;
      case "essay":
        return sum + 10;
      default:
        return sum + 2;
    }
  }, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic API call using string identifier, types not available at compile time
  const templateId = await client.mutation("examTemplates:create" as any, {
    examType: data.examType,
    language: data.language,
    title,
    description: `Extracted from ${data.source}`,
    source: data.source,
    sections: [
      {
        type: data.section,
        title: `${data.section.charAt(0).toUpperCase() + data.section.slice(1)} Section`,
        timeLimitMinutes: timeEstimate,
        questionCount: data.questions.length,
      },
    ],
    totalTimeLimitMinutes: timeEstimate,
    passingScore: 60,
    isPublished: publish,
  });

  console.log(`Created template: ${templateId}`);

  // 2. Import questions
  console.log("\n2. Importing questions...");

  const questionsToImport = data.questions.map((q) => ({
    templateId,
    examType: data.examType,
    language: data.language,
    sectionType: data.section,
    questionText: q.questionText,
    passageText: q.passageText || data.passage,
    questionType: q.questionType,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    points: q.points,
    source: data.source,
  }));

  // Import in batches to avoid timeout
  const batchSize = 20;
  let imported = 0;

  for (let i = 0; i < questionsToImport.length; i += batchSize) {
    const batch = questionsToImport.slice(i, i + batchSize);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic API call using string identifier, types not available at compile time
    await client.mutation("examQuestions:createBatch" as any, {
      questions: batch,
    });
    imported += batch.length;
    console.log(`Imported ${imported}/${questionsToImport.length} questions`);
  }

  console.log("\n--- Import Complete ---");
  console.log(`Template ID: ${templateId}`);
  console.log(`Questions imported: ${imported}`);
  console.log(`Total points: ${totalPoints}`);
  console.log(`Estimated time: ${timeEstimate} minutes`);
  console.log(`Published: ${publish}`);

  return { templateId, questionCount: imported };
}

// Validate extracted data
function validateData(data: ExtractionResult): string[] {
  const errors: string[] = [];

  if (!data.examType) {
    errors.push("Missing examType");
  }

  if (!data.language) {
    errors.push("Missing language");
  }

  if (!data.section) {
    errors.push("Missing section");
  }

  if (!data.questions || data.questions.length === 0) {
    errors.push("No questions found");
  }

  // Validate each question
  data.questions?.forEach((q, idx) => {
    if (!q.questionText) {
      errors.push(`Question ${idx + 1}: Missing questionText`);
    }
    if (!q.questionType) {
      errors.push(`Question ${idx + 1}: Missing questionType`);
    }
    if (q.questionType === "multiple_choice" && (!q.options || q.options.length < 2)) {
      errors.push(`Question ${idx + 1}: Multiple choice needs at least 2 options`);
    }
    if (!q.correctAnswer && q.correctAnswer !== "") {
      errors.push(`Question ${idx + 1}: Missing correctAnswer`);
    }
  });

  return errors;
}

// Preview data before import
function previewData(data: ExtractionResult) {
  console.log("\n--- Preview ---");
  console.log(`Exam Type: ${data.examType}`);
  console.log(`Language: ${data.language}`);
  console.log(`Section: ${data.section}`);
  console.log(`Source: ${data.source}`);
  console.log(`Total Questions: ${data.questions.length}`);
  console.log(`Extracted At: ${data.extractedAt}`);

  // Question type breakdown
  const typeCounts: Record<string, number> = {};
  data.questions.forEach((q) => {
    typeCounts[q.questionType] = (typeCounts[q.questionType] || 0) + 1;
  });

  console.log("\nQuestion Types:");
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Show first 3 questions
  console.log("\nFirst 3 Questions:");
  data.questions.slice(0, 3).forEach((q, idx) => {
    console.log(`\n  ${idx + 1}. [${q.questionType}] ${q.questionText.slice(0, 100)}...`);
    if (q.options) {
      console.log(`     Options: ${q.options.slice(0, 2).join(", ")}...`);
    }
    console.log(`     Answer: ${q.correctAnswer || "(not set)"}`);
    console.log(`     Points: ${q.points}`);
  });

  // Check for issues
  const questionsWithoutAnswers = data.questions.filter((q) => !q.correctAnswer).length;
  if (questionsWithoutAnswers > 0) {
    console.log(`\n⚠️  Warning: ${questionsWithoutAnswers} questions have no correct answer`);
  }
}

// Main
async function main() {
  const args = parseArgs();

  if (!args.file) {
    console.error("Error: --file is required");
    console.log("\nUsage:");
    console.log(
      "  npx tsx scripts/importExamToConvex.ts --file <path> --title <title> [--publish]"
    );
    console.log("\nOptions:");
    console.log("  --file     Path to extracted JSON file");
    console.log("  --title    Display title for the exam");
    console.log("  --publish  Publish immediately (default: draft)");
    console.log("  --preview  Preview only, don't import");
    process.exit(1);
  }

  try {
    // Read the extracted data
    const filePath = args.file as string;
    console.log(`Reading: ${filePath}`);
    const content = readFileSync(filePath, "utf-8");
    const data: ExtractionResult = JSON.parse(content);

    // Preview
    previewData(data);

    // Validate
    const errors = validateData(data);
    if (errors.length > 0) {
      console.log("\n❌ Validation Errors:");
      errors.forEach((e) => console.log(`  - ${e}`));
      console.log("\nFix these issues before importing.");
      process.exit(1);
    }

    console.log("\n✓ Validation passed");

    // Preview only mode
    if (args.preview) {
      console.log("\nPreview mode - not importing");
      process.exit(0);
    }

    // Get title
    const title = (args.title as string) ||
      `${data.examType.replace("_", " ").toUpperCase()} ${data.section} (${data.source})`;

    // Import
    console.log(`\nImporting as: "${title}"`);
    const result = await importToConvex(data, title, args.publish === true);

    console.log("\n✓ Import successful!");
    console.log(`Template ID: ${result.templateId}`);
  } catch (error) {
    console.error("\nImport failed:", error);
    process.exit(1);
  }
}

main();

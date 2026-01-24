/**
 * Batch Generate Script
 *
 * Uses Google's Batch API for cost-efficient generation of:
 * - Sentences (50% cheaper than interactive API)
 * - Audio (via Gemini TTS - may not support batch)
 * - Images (via Gemini - may not support batch)
 *
 * Usage:
 *   npx tsx scripts/batchGenerate.ts --deck jlpt_n5 --type sentences --count 100
 *   npx tsx scripts/batchGenerate.ts --deck jlpt_n5 --type audio --count 50
 *   npx tsx scripts/batchGenerate.ts --status <jobId>
 *   npx tsx scripts/batchGenerate.ts --process <jobId>
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// ============================================
// CONFIGURATION
// ============================================

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!CONVEX_URL) {
  console.error("Error: CONVEX_URL or VITE_CONVEX_URL environment variable required");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

// Google Batch API config
const BATCH_MODEL = "gemini-2.0-flash"; // Or gemini-1.5-flash for cheaper
const BATCH_API_URL = "https://generativelanguage.googleapis.com/v1beta";

// Cost estimates (per item, with 50% batch discount)
const COSTS = {
  sentences: 0.001, // ~$0.002 / 2 = $0.001 with batch
  audio: 0.002, // TTS pricing TBD
  images: 0.02, // ~$0.04 / 2 = $0.02 with batch
};

// ============================================
// HELPERS
// ============================================

interface PremadeVocabItem {
  _id: Id<"premadeVocabulary">;
  word: string;
  reading?: string;
  definitions: string[];
  language: "japanese" | "english" | "french";
  level: string;
  sentence?: string;
}

function getLanguageName(lang: string): string {
  const names: Record<string, string> = {
    japanese: "Japanese",
    english: "English",
    french: "French",
  };
  return names[lang] || "English";
}

function buildSentencePrompt(item: PremadeVocabItem): string {
  const langName = getLanguageName(item.language);
  const readingInfo = item.reading ? ` (reading: ${item.reading})` : "";
  const levelInfo = item.level ? ` at ${item.level} level` : "";
  const definitionList = item.definitions.join(", ");

  return `Create an example sentence for the ${langName} word "${item.word}"${readingInfo}${levelInfo}.

The word means: ${definitionList}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners${levelInfo}.

Respond with JSON:
{
  "sentence": "the example sentence in ${langName}",
  "translation": "the English translation"
}`;
}

// ============================================
// BATCH FILE GENERATION
// ============================================

interface BatchRequest {
  key: string;
  request: {
    contents: Array<{
      parts: Array<{ text: string }>;
    }>;
    generationConfig?: {
      responseMimeType?: string;
    };
  };
}

async function generateSentenceBatchFile(
  deckId: string,
  count: number
): Promise<{ filePath: string; items: PremadeVocabItem[]; jobId: Id<"batchJobs"> }> {
  console.log(`\nFetching up to ${count} pending items from deck: ${deckId}`);

  // Get pending items from Convex
  const items = (await convex.query(api.premadeDecks.getVocabularyForDeck, {
    deckId,
    limit: count,
    status: "pending",
  })) as PremadeVocabItem[];

  if (items.length === 0) {
    throw new Error("No pending items found for sentence generation");
  }

  console.log(`Found ${items.length} items to process`);

  // Create batch job in Convex
  const estimatedCost = items.length * COSTS.sentences;
  const jobId = await convex.mutation(api.batchJobs.create, {
    jobType: "sentences",
    deckId,
    model: BATCH_MODEL,
    itemCount: items.length,
    estimatedCost,
  });

  console.log(`Created batch job: ${jobId}`);
  console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);

  // Build JSONL content
  const requests: BatchRequest[] = items.map((item) => ({
    key: item._id,
    request: {
      contents: [
        {
          parts: [{ text: buildSentencePrompt(item) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    },
  }));

  const jsonlContent = requests.map((r) => JSON.stringify(r)).join("\n");

  // Write to temp file
  const fileName = `batch_sentences_${deckId}_${Date.now()}.jsonl`;
  const filePath = path.join(process.cwd(), "scripts", "temp", fileName);

  // Ensure temp directory exists
  const tempDir = path.join(process.cwd(), "scripts", "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(filePath, jsonlContent);
  console.log(`Wrote batch file: ${filePath}`);

  return { filePath, items, jobId };
}

// ============================================
// GOOGLE BATCH API INTERACTION
// ============================================

async function uploadFileToGoogle(filePath: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable required");
  }

  console.log("\nUploading file to Google Files API...");

  const fileContent = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const numBytes = fileContent.length;

  // Step 1: Start resumable upload
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(numBytes),
        "X-Goog-Upload-Header-Content-Type": "application/jsonl",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: {
          display_name: fileName,
        },
      }),
    }
  );

  if (!startResponse.ok) {
    const error = await startResponse.text();
    throw new Error(`Upload start failed: ${error}`);
  }

  // Get the upload URL from response headers
  const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("No upload URL returned");
  }

  // Step 2: Upload the actual content
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`File upload failed: ${error}`);
  }

  const uploadResult = await uploadResponse.json();
  const fileUri = uploadResult.file?.name || uploadResult.file?.uri;

  if (!fileUri) {
    throw new Error("No file URI in upload response: " + JSON.stringify(uploadResult));
  }

  console.log(`File uploaded: ${fileUri}`);
  return fileUri;
}

async function submitBatchJob(
  fileUri: string,
  jobId: Id<"batchJobs">,
  displayName?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable required");
  }

  console.log("\nSubmitting batch job to Google...");

  // Use the correct batch request format per docs
  const response = await fetch(
    `${BATCH_API_URL}/models/${BATCH_MODEL}:batchGenerateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch: {
          display_name: displayName || `batch_${Date.now()}`,
          input_config: {
            file_name: fileUri,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Batch submission failed: ${error}`);
  }

  const result = await response.json();
  const googleJobName = result.name;

  if (!googleJobName) {
    throw new Error("No batch job name returned: " + JSON.stringify(result));
  }

  console.log(`Batch job submitted: ${googleJobName}`);

  // Update Convex with Google job info
  await convex.mutation(api.batchJobs.markSubmitted, {
    jobId,
    googleBatchJobName: googleJobName,
    inputFileUri: fileUri,
  });

  return googleJobName;
}

async function checkBatchStatus(googleJobName: string): Promise<{
  state: string;
  processedCount?: number;
  outputFile?: string;
  error?: string;
  done?: boolean;
}> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable required");
  }

  // Status endpoint: GET /v1beta/{batch_name}
  const response = await fetch(
    `${BATCH_API_URL}/${googleJobName}?key=${GEMINI_API_KEY}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Status check failed: ${error}`);
  }

  const result = await response.json();

  // Response format per docs:
  // { metadata: { state: "JOB_STATE_..." }, done: true/false, response: { ... } }
  return {
    state: result.metadata?.state || result.state || "UNKNOWN",
    processedCount: result.metadata?.processedRequests,
    outputFile: result.response?.output_config?.file_name || result.dest?.file_name,
    error: result.error?.message,
    done: result.done,
  };
}

// ============================================
// BATCH RESULT PROCESSING (for async file-based batches)
// ============================================

async function downloadBatchResults(outputFileName: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable required");
  }

  console.log(`\nDownloading results from: ${outputFileName}`);

  // Download endpoint: GET /download/v1beta/{file_name}:download?alt=media
  // Note: uses /download/ prefix, not regular /v1beta/
  const downloadUrl = `https://generativelanguage.googleapis.com/download/v1beta/${outputFileName}:download?alt=media&key=${GEMINI_API_KEY}`;

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Download failed: ${error}`);
  }

  const content = await response.text();
  return content;
}

async function processBatchResults(
  jobId: Id<"batchJobs">,
  resultsContent: string
): Promise<{ success: number; failed: number }> {
  console.log("\nProcessing batch results...");

  const lines = resultsContent.trim().split("\n");
  let successCount = 0;
  let failCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const result = JSON.parse(line);

      // The key is the premadeVocabulary ID we set when creating the batch
      const itemId = result.key as Id<"premadeVocabulary">;

      // Check for error response
      if (result.error) {
        console.error(`Error for ${itemId}: ${result.error.message}`);
        await convex.mutation(api.premadeDecks.updateItemContent, {
          itemId,
          generationStatus: "failed",
        });
        failCount++;
        continue;
      }

      // Extract the generated content
      const content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.error(`No content for ${itemId}`);
        await convex.mutation(api.premadeDecks.updateItemContent, {
          itemId,
          generationStatus: "failed",
        });
        failCount++;
        continue;
      }

      // Parse the JSON response
      const parsed = JSON.parse(content);

      await convex.mutation(api.premadeDecks.updateItemContent, {
        itemId,
        sentence: parsed.sentence,
        sentenceTranslation: parsed.translation,
        generationStatus: "complete",
      });

      successCount++;

      if (successCount % 50 === 0) {
        console.log(`  Processed ${successCount} items...`);
      }
    } catch (error) {
      console.error(`Failed to parse result line:`, error);
      failCount++;
    }
  }

  // Update job status
  await convex.mutation(api.batchJobs.updateStatus, {
    jobId,
    status: "succeeded",
    processedCount: successCount,
  });

  return { success: successCount, failed: failCount };
}

async function pollAndProcessBatch(jobId: Id<"batchJobs">): Promise<void> {
  const job = await convex.query(api.batchJobs.get, { jobId });

  if (!job) {
    throw new Error("Job not found");
  }

  if (!job.googleBatchJobName) {
    throw new Error("Job has no Google batch job name - was it submitted?");
  }

  console.log(`\nPolling job: ${job.googleBatchJobName}`);

  // Poll until complete
  const POLL_INTERVAL = 15000; // 15 seconds
  const MAX_POLLS = 240; // 1 hour max

  for (let i = 0; i < MAX_POLLS; i++) {
    const status = await checkBatchStatus(job.googleBatchJobName);

    console.log(`  [${new Date().toLocaleTimeString()}] State: ${status.state}, Done: ${status.done}, Processed: ${status.processedCount || "?"}`);

    // Update Convex with current status
    if (status.state === "JOB_STATE_RUNNING" || status.state === "JOB_STATE_PENDING") {
      await convex.mutation(api.batchJobs.updateStatus, {
        jobId,
        status: status.state === "JOB_STATE_RUNNING" ? "running" : "submitted",
        processedCount: status.processedCount,
      });
    }

    // Check for terminal states (using both state and done flag)
    if (status.state === "JOB_STATE_SUCCEEDED" || (status.done && !status.error)) {
      console.log("\n✓ Job completed successfully!");

      if (!status.outputFile) {
        // Some batch responses include inline results
        console.log("Note: No output file - results may have been inline");
        await convex.mutation(api.batchJobs.updateStatus, {
          jobId,
          status: "succeeded",
        });
        return;
      }

      // Download and process results
      const resultsContent = await downloadBatchResults(status.outputFile);
      const { success, failed } = await processBatchResults(jobId, resultsContent);

      console.log(`\nBatch complete: ${success} succeeded, ${failed} failed`);

      // Update deck stats
      if (job.deckId) {
        await convex.mutation(api.premadeDecks.updateDeckStats, { deckId: job.deckId });
      }

      return;
    }

    if (status.state === "JOB_STATE_FAILED" || (status.done && status.error)) {
      await convex.mutation(api.batchJobs.updateStatus, {
        jobId,
        status: "failed",
        errorMessage: status.error || "Unknown error",
      });
      throw new Error(`Batch failed: ${status.error || "Unknown error"}`);
    }

    if (status.state === "JOB_STATE_CANCELLED") {
      await convex.mutation(api.batchJobs.updateStatus, {
        jobId,
        status: "cancelled",
      });
      throw new Error("Batch was cancelled");
    }

    if (status.state === "JOB_STATE_EXPIRED") {
      await convex.mutation(api.batchJobs.updateStatus, {
        jobId,
        status: "failed",
        errorMessage: "Job expired (48 hour limit)",
      });
      throw new Error("Batch expired (48 hour limit)");
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Polling timed out after 1 hour");
}

// ============================================
// INLINE BATCH (for smaller batches without file upload)
// ============================================

async function submitInlineBatch(
  items: PremadeVocabItem[],
  jobId: Id<"batchJobs">
): Promise<void> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable required");
  }

  console.log(`\nSubmitting inline batch of ${items.length} items...`);

  // Build inline requests per the docs format
  // { batch: { input_config: { requests: { requests: [...] } } } }
  const requests = items.map((item) => ({
    request: {
      contents: [
        {
          parts: [{ text: buildSentencePrompt(item) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    },
    metadata: {
      key: item._id, // Use the Convex ID as the key
    },
  }));

  const response = await fetch(
    `${BATCH_API_URL}/models/${BATCH_MODEL}:batchGenerateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch: {
          display_name: `inline_batch_${Date.now()}`,
          input_config: {
            requests: {
              requests,
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Inline batch failed: ${error}`);
  }

  const result = await response.json();

  // Check if we got inline responses (small batch) or async job (larger batch)
  const inlineResponses = result.response?.inline_response?.responses;

  if (inlineResponses) {
    console.log(`Received ${inlineResponses.length} inline responses`);

    // Process results
    let successCount = 0;
    let failCount = 0;

    for (const respItem of inlineResponses) {
      const itemId = respItem.metadata?.key as Id<"premadeVocabulary">;
      const item = items.find((i) => i._id === itemId);

      if (!item) {
        console.error(`Unknown response key: ${respItem.metadata?.key}`);
        failCount++;
        continue;
      }

      try {
        const content = respItem.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);

          await convex.mutation(api.premadeDecks.updateItemContent, {
            itemId: item._id,
            sentence: parsed.sentence,
            sentenceTranslation: parsed.translation,
            generationStatus: "complete",
          });

          successCount++;
        } else {
          throw new Error("No content in response");
        }
      } catch (error) {
        console.error(`Failed to process item ${item.word}:`, error);

        await convex.mutation(api.premadeDecks.updateItemContent, {
          itemId: item._id,
          generationStatus: "failed",
        });

        failCount++;
      }
    }

    // Update job status
    await convex.mutation(api.batchJobs.updateStatus, {
      jobId,
      status: "succeeded",
      processedCount: successCount,
    });

    console.log(`\nBatch complete: ${successCount} succeeded, ${failCount} failed`);
  } else if (result.name) {
    // Async batch job created (even for inline, if too large)
    console.log(`Async batch job created: ${result.name}`);

    await convex.mutation(api.batchJobs.markSubmitted, {
      jobId,
      googleBatchJobName: result.name,
    });

    console.log("\nJob submitted for async processing. Poll/process with:");
    console.log(`  npx tsx scripts/batchGenerate.ts --process ${jobId}`);
  } else {
    console.error("Unexpected response format:", JSON.stringify(result, null, 2));
    throw new Error("Unknown response format from batch API");
  }
}

// ============================================
// MAIN CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Batch Generate Script

Usage:
  npx tsx scripts/batchGenerate.ts --deck <deckId> --type sentences --count <n>
  npx tsx scripts/batchGenerate.ts --status <jobId>
  npx tsx scripts/batchGenerate.ts --process <jobId>

Options:
  --deck <deckId>     Deck to process (e.g., jlpt_n5)
  --type <type>       Content type: sentences, audio, images
  --count <n>         Number of items to process (default: 10)
  --status <jobId>    Check status of a batch job
  --process <jobId>   Process results of a completed job

Examples:
  npx tsx scripts/batchGenerate.ts --deck jlpt_n5 --type sentences --count 100
  npx tsx scripts/batchGenerate.ts --deck jlpt_n5 --type sentences --count 10
`);
    return;
  }

  // Parse arguments
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const deckId = getArg("--deck");
  const contentType = getArg("--type") as "sentences" | "audio" | "images" | undefined;
  const count = parseInt(getArg("--count") || "10", 10);
  const statusJobId = getArg("--status");
  const processJobId = getArg("--process");

  // Check status
  if (statusJobId) {
    const job = await convex.query(api.batchJobs.get, {
      jobId: statusJobId as Id<"batchJobs">,
    });

    if (!job) {
      console.error("Job not found");
      return;
    }

    console.log("\nBatch Job Status:");
    console.log(`  ID: ${job._id}`);
    console.log(`  Type: ${job.jobType}`);
    console.log(`  Deck: ${job.deckId || "N/A"}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Items: ${job.processedCount}/${job.itemCount}`);
    console.log(`  Estimated Cost: $${job.estimatedCost?.toFixed(4) || "N/A"}`);
    console.log(`  Google Job: ${job.googleBatchJobName || "N/A"}`);

    // Check Google status for submitted/running jobs
    if (job.googleBatchJobName && (job.status === "submitted" || job.status === "running")) {
      try {
        const googleStatus = await checkBatchStatus(job.googleBatchJobName);
        console.log(`\n  Google Batch State: ${googleStatus.state}`);
        if (googleStatus.processedCount) {
          console.log(`  Google Processed: ${googleStatus.processedCount}`);
        }
        if (googleStatus.outputFile) {
          console.log(`  Output File: ${googleStatus.outputFile}`);
        }

        // Suggest next action
        if (googleStatus.state === "JOB_STATE_SUCCEEDED") {
          console.log(`\n  ✓ Job complete! Process results with:`);
          console.log(`    npx tsx scripts/batchGenerate.ts --process ${statusJobId}`);
        } else if (googleStatus.state === "JOB_STATE_RUNNING" || googleStatus.state === "JOB_STATE_PENDING") {
          console.log(`\n  ⏳ Job still running. Poll and process with:`);
          console.log(`    npx tsx scripts/batchGenerate.ts --process ${statusJobId}`);
        }
      } catch (error) {
        console.log(`  (Could not fetch Google status: ${error})`);
      }
    }

    return;
  }

  // Process results (poll + download + update Convex)
  if (processJobId) {
    await pollAndProcessBatch(processJobId as Id<"batchJobs">);
    return;
  }

  // Generate batch
  if (!deckId || !contentType) {
    console.error("Error: --deck and --type are required");
    return;
  }

  if (contentType !== "sentences") {
    console.error("Error: Only 'sentences' type is currently supported");
    return;
  }

  // Get deck stats first
  const stats = await convex.query(api.premadeDecks.getDeckGenerationStats, {
    deckId,
  });

  console.log("\nDeck Stats:");
  console.log(`  Total words: ${stats.total}`);
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Complete: ${stats.complete}`);
  console.log(`  With sentences: ${stats.withSentences}`);

  if (stats.pending === 0) {
    console.log("\nNo pending items to process!");
    return;
  }

  const actualCount = Math.min(count, stats.pending);
  console.log(`\nWill process ${actualCount} items`);
  console.log(`Estimated cost: $${(actualCount * COSTS.sentences).toFixed(4)}`);

  // For small batches, use inline API (simpler, immediate results)
  if (actualCount <= 100) {
    const items = (await convex.query(api.premadeDecks.getVocabularyForDeck, {
      deckId,
      limit: actualCount,
      status: "pending",
    })) as PremadeVocabItem[];

    const estimatedCost = items.length * COSTS.sentences;
    const jobId = await convex.mutation(api.batchJobs.create, {
      jobType: "sentences",
      deckId,
      model: BATCH_MODEL,
      itemCount: items.length,
      estimatedCost,
    });

    await submitInlineBatch(items, jobId);
  } else {
    // For larger batches, use file upload
    const { filePath, jobId } = await generateSentenceBatchFile(
      deckId,
      actualCount
    );

    const fileUri = await uploadFileToGoogle(filePath);
    await submitBatchJob(fileUri, jobId);

    console.log("\nBatch job submitted. Poll for status with:");
    console.log(`  npx tsx scripts/batchGenerate.ts --status ${jobId}`);
  }

  // Update deck stats
  await convex.mutation(api.premadeDecks.updateDeckStats, { deckId });
}

main().catch(console.error);

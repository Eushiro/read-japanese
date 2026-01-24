/**
 * Media Compression Script
 *
 * Compresses audio (WAV → MP3) and images (PNG → WebP) stored in R2.
 *
 * Prerequisites:
 *   - ffmpeg installed: brew install ffmpeg
 *   - sharp installed: bun add sharp
 *
 * Usage:
 *   npx tsx scripts/compressMedia.ts              # Compress all
 *   npx tsx scripts/compressMedia.ts --type audio # Audio only
 *   npx tsx scripts/compressMedia.ts --type image # Images only
 *   npx tsx scripts/compressMedia.ts --limit 10   # Process only 10 files
 *   npx tsx scripts/compressMedia.ts --dry-run    # Preview without changes
 */

import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import sharp from "sharp";

// Parse arguments
const args = process.argv.slice(2);
const typeFilter = args.includes("--type")
  ? (args[args.indexOf("--type") + 1] as "audio" | "image")
  : undefined;
const limit = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1])
  : undefined;
const dryRun = args.includes("--dry-run");
const deleteOriginals = args.includes("--delete-originals");

// Configuration
const CONVEX_URL = process.env.VITE_CONVEX_URL!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "sanlang-media";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// Validate environment
if (!CONVEX_URL || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
  console.error("Missing environment variables. Required:");
  console.error("  VITE_CONVEX_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL");
  console.error("\nSet them with:");
  console.error('  export VITE_CONVEX_URL=$(grep VITE_CONVEX_URL .env.local | cut -d\'=\' -f2)');
  console.error('  export R2_ACCOUNT_ID="your_account_id"');
  console.error("  ... etc");
  process.exit(1);
}

// Check for ffmpeg
try {
  execSync("which ffmpeg", { stdio: "ignore" });
} catch {
  console.error("ffmpeg not found. Install with: brew install ffmpeg");
  process.exit(1);
}

// Initialize clients
const convex = new ConvexHttpClient(CONVEX_URL);
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Create temp directory
const TEMP_DIR = join(process.cwd(), ".compress-temp");
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

// Stats
let processed = 0;
let compressed = 0;
let errors = 0;
let savedBytes = 0;

/**
 * Download file from URL
 */
async function downloadFile(url: string, outputPath: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);

  const buffer = await response.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(buffer));
  return buffer.byteLength;
}

/**
 * Upload file to R2
 */
async function uploadToR2(
  filePath: string,
  key: string,
  contentType: string
): Promise<string> {
  const { readFileSync } = await import("fs");
  const data = readFileSync(filePath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const baseUrl = R2_PUBLIC_URL.endsWith("/") ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
  return `${baseUrl}/${key}`;
}

/**
 * Delete file from R2
 */
async function deleteFromR2(url: string): Promise<void> {
  const baseUrl = R2_PUBLIC_URL.endsWith("/") ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
  const key = url.replace(baseUrl + "/", "");

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Compress audio file (WAV → MP3)
 */
async function compressAudio(inputPath: string, outputPath: string): Promise<void> {
  execSync(`ffmpeg -y -i "${inputPath}" -codec:a libmp3lame -b:a 128k "${outputPath}"`, {
    stdio: "ignore",
  });
}

/**
 * Compress image file (PNG → WebP)
 */
async function compressImage(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath).webp({ quality: 80 }).toFile(outputPath);
}

/**
 * Process a single file
 */
async function processFile(file: {
  url: string;
  type: "audio" | "image";
  format: string;
  source: "premadeVocabulary" | "flashcards";
  id: string;
  field: "audioUrl" | "wordAudioUrl" | "imageUrl";
}): Promise<void> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  const inputExt = file.format;
  const outputExt = file.type === "audio" ? "mp3" : "webp";
  const inputPath = join(TEMP_DIR, `${timestamp}-${random}-input.${inputExt}`);
  const outputPath = join(TEMP_DIR, `${timestamp}-${random}-output.${outputExt}`);

  try {
    // Download
    console.log(`  Downloading ${file.type}...`);
    const originalSize = await downloadFile(file.url, inputPath);

    // Compress
    console.log(`  Compressing ${inputExt} → ${outputExt}...`);
    if (file.type === "audio") {
      await compressAudio(inputPath, outputPath);
    } else {
      await compressImage(inputPath, outputPath);
    }

    // Get compressed size
    const { statSync } = await import("fs");
    const compressedSize = statSync(outputPath).size;
    const savings = originalSize - compressedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);

    console.log(
      `  Size: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${savingsPercent}% smaller)`
    );

    if (!dryRun) {
      // Upload compressed file
      const prefix = file.type === "audio" ? "audio" : "images";
      const key = `${prefix}/${timestamp}-${random}.${outputExt}`;
      console.log(`  Uploading to R2...`);
      const newUrl = await uploadToR2(
        outputPath,
        key,
        file.type === "audio" ? "audio/mpeg" : "image/webp"
      );

      // Update database
      console.log(`  Updating database...`);
      await convex.mutation(api.admin.updateCompressedUrl, {
        source: file.source,
        id: file.id,
        field: file.field,
        newUrl,
      });

      // Delete original if requested
      if (deleteOriginals) {
        console.log(`  Deleting original from R2...`);
        await deleteFromR2(file.url);
      }

      savedBytes += savings;
    }

    compressed++;
  } catch (error) {
    console.error(`  Error: ${error}`);
    errors++;
  } finally {
    // Cleanup temp files
    try {
      unlinkSync(inputPath);
    } catch {}
    try {
      unlinkSync(outputPath);
    } catch {}
  }

  processed++;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  console.log("🗜️  Media Compression Script\n");
  console.log(`Convex: ${CONVEX_URL}`);
  console.log(`R2 Bucket: ${R2_BUCKET_NAME}`);
  if (dryRun) console.log("Mode: DRY RUN (no changes will be made)");
  if (typeFilter) console.log(`Filter: ${typeFilter} only`);
  if (limit) console.log(`Limit: ${limit} files`);
  console.log();

  // Get uncompressed files
  console.log("Fetching uncompressed files...");
  const files = await convex.query(api.admin.listUncompressedFiles, {
    type: typeFilter,
    limit,
  });

  if (files.length === 0) {
    console.log("✅ No uncompressed files found. All media is already optimized!");
    return;
  }

  console.log(`Found ${files.length} uncompressed files\n`);

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] ${file.source}/${file.id} (${file.field})`);
    await processFile(file);
    console.log();
  }

  // Summary
  console.log("═".repeat(50));
  console.log("📊 Summary");
  console.log("═".repeat(50));
  console.log(`Processed: ${processed} files`);
  console.log(`Compressed: ${compressed} files`);
  console.log(`Errors: ${errors} files`);
  if (!dryRun) {
    console.log(`Total space saved: ${formatBytes(savedBytes)}`);
  }

  // Cleanup temp directory
  try {
    const { rmdirSync } = await import("fs");
    rmdirSync(TEMP_DIR);
  } catch {}
}

main().catch(console.error);

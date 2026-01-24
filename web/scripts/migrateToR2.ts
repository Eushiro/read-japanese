/**
 * Migration script: Move existing files from Convex storage to R2
 *
 * Run with: npx tsx scripts/migrateToR2.ts
 *
 * This script:
 * 1. Finds all records with Convex storage URLs
 * 2. Downloads each file
 * 3. Uploads to R2
 * 4. Updates the database record
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Configuration from environment
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

// Track stats
let downloaded = 0;
let uploaded = 0;
let updated = 0;
let skipped = 0;
let errors = 0;

/**
 * Check if URL is a Convex storage URL
 */
function isConvexUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes("convex.cloud") || url.includes("convex.site");
}

/**
 * Get file extension from URL or content type
 */
function getExtension(url: string, contentType?: string): string {
  // Try to get from URL
  const urlMatch = url.match(/\.(\w+)(?:\?|$)/);
  if (urlMatch) return urlMatch[1];

  // Infer from content type
  if (contentType?.includes("wav")) return "wav";
  if (contentType?.includes("mp3") || contentType?.includes("mpeg")) return "mp3";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";

  return "bin";
}

/**
 * Download file from Convex and upload to R2
 */
async function migrateFile(convexUrl: string, prefix: string): Promise<string | null> {
  try {
    // Download from Convex
    const response = await fetch(convexUrl);
    if (!response.ok) {
      console.error(`  Failed to download: ${response.status} ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const data = await response.arrayBuffer();
    downloaded++;

    // Generate R2 key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const extension = getExtension(convexUrl, contentType);
    const key = `${prefix}/${timestamp}-${random}.${extension}`;

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(data),
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    uploaded++;

    // Return new URL
    const baseUrl = R2_PUBLIC_URL.endsWith("/") ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
    return `${baseUrl}/${key}`;
  } catch (error) {
    console.error(`  Error migrating file: ${error}`);
    errors++;
    return null;
  }
}

/**
 * Migrate premadeVocabulary table
 */
async function migratePremadeVocabulary() {
  console.log("\n📦 Migrating premadeVocabulary...");

  // Get all items with Convex URLs
  const items = await convex.query(api.premadeDecks.listAllItemsForMigration, {});

  const toMigrate = items.filter(
    (item) => isConvexUrl(item.audioUrl) || isConvexUrl(item.wordAudioUrl) || isConvexUrl(item.imageUrl)
  );

  console.log(`  Found ${toMigrate.length} items with Convex URLs (out of ${items.length} total)`);

  for (let i = 0; i < toMigrate.length; i++) {
    const item = toMigrate[i];
    console.log(`  [${i + 1}/${toMigrate.length}] ${item.word}`);

    const updates: { audioUrl?: string; wordAudioUrl?: string; imageUrl?: string } = {};

    if (isConvexUrl(item.audioUrl)) {
      const newUrl = await migrateFile(item.audioUrl!, "audio");
      if (newUrl) updates.audioUrl = newUrl;
    }

    if (isConvexUrl(item.wordAudioUrl)) {
      const newUrl = await migrateFile(item.wordAudioUrl!, "audio");
      if (newUrl) updates.wordAudioUrl = newUrl;
    }

    if (isConvexUrl(item.imageUrl)) {
      const newUrl = await migrateFile(item.imageUrl!, "images");
      if (newUrl) updates.imageUrl = newUrl;
    }

    if (Object.keys(updates).length > 0) {
      await convex.mutation(api.premadeDecks.updateItemUrls, {
        premadeVocabularyId: item._id,
        ...updates,
      });
      updated++;
    }
  }
}

/**
 * Migrate flashcards table
 */
async function migrateFlashcards() {
  console.log("\n📦 Migrating flashcards...");

  // Get all items with Convex URLs
  const items = await convex.query(api.flashcards.listAllForMigration, {});

  const toMigrate = items.filter(
    (item) => isConvexUrl(item.audioUrl) || isConvexUrl(item.wordAudioUrl) || isConvexUrl(item.imageUrl)
  );

  console.log(`  Found ${toMigrate.length} items with Convex URLs (out of ${items.length} total)`);

  for (let i = 0; i < toMigrate.length; i++) {
    const item = toMigrate[i];
    console.log(`  [${i + 1}/${toMigrate.length}] Flashcard ${item._id}`);

    const updates: { audioUrl?: string; wordAudioUrl?: string; imageUrl?: string } = {};

    if (isConvexUrl(item.audioUrl)) {
      const newUrl = await migrateFile(item.audioUrl!, "audio");
      if (newUrl) updates.audioUrl = newUrl;
    }

    if (isConvexUrl(item.wordAudioUrl)) {
      const newUrl = await migrateFile(item.wordAudioUrl!, "audio");
      if (newUrl) updates.wordAudioUrl = newUrl;
    }

    if (isConvexUrl(item.imageUrl)) {
      const newUrl = await migrateFile(item.imageUrl!, "images");
      if (newUrl) updates.imageUrl = newUrl;
    }

    if (Object.keys(updates).length > 0) {
      await convex.mutation(api.flashcards.updateUrls, {
        flashcardId: item._id,
        ...updates,
      });
      updated++;
    }
  }
}

async function main() {
  console.log("🚀 Starting migration from Convex storage to R2...\n");
  console.log(`Convex: ${CONVEX_URL}`);
  console.log(`R2 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`R2 Public URL: ${R2_PUBLIC_URL}`);

  await migratePremadeVocabulary();
  await migrateFlashcards();

  console.log("\n✅ Migration complete!");
  console.log(`   Downloaded: ${downloaded} files`);
  console.log(`   Uploaded: ${uploaded} files`);
  console.log(`   Updated: ${updated} records`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);

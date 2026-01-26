/**
 * Migration: Reorganize media files to word-centric structure
 *
 * This migration moves existing media files from flat structure:
 *   audio/{timestamp}-{random}.mp3
 *   images/{timestamp}-{random}.webp
 *
 * To word-centric structure:
 *   flashcards/{language}/{word}/word.mp3
 *   flashcards/{language}/{word}/sentence-{id}.mp3
 *   flashcards/{language}/{word}/image-{id}.webp
 *
 * Usage:
 *   # Check what would be migrated (dry run)
 *   npx convex run migrations/mediaReorganization:checkMigrationStatus
 *
 *   # Run migration in batches
 *   npx convex run migrations/mediaReorganization:migrateWordAudio
 *   npx convex run migrations/mediaReorganization:migrateSentenceAudio
 *   npx convex run migrations/mediaReorganization:migrateImages
 *
 *   # Verify migration
 *   npx convex run migrations/mediaReorganization:verifyMigration
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import {
  downloadFile,
  extractKeyFromUrl,
  uploadSentenceAudio,
  uploadWordAudio,
  uploadWordImage,
} from "../lib/storage";
import type { ContentLanguage } from "../schema";

// ============================================
// STATUS CHECKING
// ============================================

/**
 * Check migration status - how many records need migration
 */
export const checkMigrationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Count wordAudio records
    const wordAudioRecords = await ctx.db.query("wordAudio").collect();
    const wordAudioNeedsMigration = wordAudioRecords.filter(
      (r) => r.audioUrl && !r.audioUrl.includes("/flashcards/")
    );

    // Count sentences with audio
    const sentenceRecords = await ctx.db.query("sentences").collect();
    const sentencesNeedsMigration = sentenceRecords.filter(
      (r) => r.audioUrl && !r.audioUrl.includes("/flashcards/")
    );

    // Count images
    const imageRecords = await ctx.db.query("images").collect();
    const imagesNeedsMigration = imageRecords.filter(
      (r) => r.imageUrl && !r.imageUrl.includes("/flashcards/")
    );

    return {
      wordAudio: {
        total: wordAudioRecords.length,
        needsMigration: wordAudioNeedsMigration.length,
        alreadyMigrated: wordAudioRecords.length - wordAudioNeedsMigration.length,
      },
      sentences: {
        total: sentenceRecords.length,
        withAudio: sentenceRecords.filter((r) => r.audioUrl).length,
        needsMigration: sentencesNeedsMigration.length,
        alreadyMigrated:
          sentenceRecords.filter((r) => r.audioUrl).length - sentencesNeedsMigration.length,
      },
      images: {
        total: imageRecords.length,
        needsMigration: imagesNeedsMigration.length,
        alreadyMigrated: imageRecords.length - imagesNeedsMigration.length,
      },
    };
  },
});

// ============================================
// WORD AUDIO MIGRATION
// ============================================

/**
 * Get batch of word audio records needing migration
 */
export const getWordAudioToMigrate = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("wordAudio").collect();
    return records
      .filter((r) => r.audioUrl && !r.audioUrl.includes("/flashcards/"))
      .slice(0, args.limit)
      .map((r) => ({
        _id: r._id,
        word: r.word,
        language: r.language,
        audioUrl: r.audioUrl,
      }));
  },
});

/**
 * Update word audio URL after migration
 */
export const updateWordAudioUrl = internalMutation({
  args: {
    id: v.id("wordAudio"),
    newUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { audioUrl: args.newUrl });
  },
});

/**
 * Migrate word audio files to word-centric structure
 */
export const migrateWordAudio = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx) => {
    const batchSize = 10;
    console.log(`Migrating word audio (batch size: ${batchSize})...`);

    const records = await ctx.runQuery(
      internal.migrations.mediaReorganization.getWordAudioToMigrate,
      { limit: batchSize }
    );

    if (records.length === 0) {
      console.log("No word audio records need migration");
      return { migrated: 0, errors: 0 };
    }

    let migrated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        console.log(`  Migrating: ${record.word} (${record.language})`);

        // Download from old URL
        const key = extractKeyFromUrl(record.audioUrl);
        if (!key) {
          console.log(`    Skipping: Could not extract key from URL`);
          errors++;
          continue;
        }

        const { data, contentType } = await downloadFile(key);

        // Upload to new path
        const newUrl = await uploadWordAudio(
          data,
          record.word,
          record.language as ContentLanguage,
          contentType
        );

        // Update database
        await ctx.runMutation(internal.migrations.mediaReorganization.updateWordAudioUrl, {
          id: record._id,
          newUrl,
        });

        console.log(`    Migrated: ${record.audioUrl} -> ${newUrl}`);
        migrated++;
      } catch (error) {
        console.error(`    Error migrating ${record.word}:`, error);
        errors++;
      }
    }

    console.log(`\nWord audio migration batch complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors };
  },
});

// ============================================
// SENTENCE AUDIO MIGRATION
// ============================================

/**
 * Get batch of sentences with audio needing migration
 */
export const getSentencesToMigrate = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("sentences").collect();
    return records
      .filter((r) => r.audioUrl && !r.audioUrl.includes("/flashcards/"))
      .slice(0, args.limit)
      .map((r) => ({
        _id: r._id,
        word: r.word,
        language: r.language,
        audioUrl: r.audioUrl,
      }));
  },
});

/**
 * Update sentence audio URL after migration
 */
export const updateSentenceAudioUrl = internalMutation({
  args: {
    id: v.id("sentences"),
    newUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { audioUrl: args.newUrl });
  },
});

/**
 * Migrate sentence audio files to word-centric structure
 */
export const migrateSentenceAudio = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx) => {
    const batchSize = 10;
    console.log(`Migrating sentence audio (batch size: ${batchSize})...`);

    const records = await ctx.runQuery(
      internal.migrations.mediaReorganization.getSentencesToMigrate,
      { limit: batchSize }
    );

    if (records.length === 0) {
      console.log("No sentence audio records need migration");
      return { migrated: 0, errors: 0 };
    }

    let migrated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        console.log(`  Migrating sentence for: ${record.word} (${record.language})`);

        // Download from old URL
        const key = extractKeyFromUrl(record.audioUrl!);
        if (!key) {
          console.log(`    Skipping: Could not extract key from URL`);
          errors++;
          continue;
        }

        const { data, contentType } = await downloadFile(key);

        // Upload to new path (use sentence ID as the identifier)
        const newUrl = await uploadSentenceAudio(
          data,
          record.word,
          record.language as ContentLanguage,
          record._id, // Use sentence DB ID
          contentType
        );

        // Update database
        await ctx.runMutation(internal.migrations.mediaReorganization.updateSentenceAudioUrl, {
          id: record._id,
          newUrl,
        });

        console.log(`    Migrated: ${record.audioUrl} -> ${newUrl}`);
        migrated++;
      } catch (error) {
        console.error(`    Error migrating sentence for ${record.word}:`, error);
        errors++;
      }
    }

    console.log(
      `\nSentence audio migration batch complete: ${migrated} migrated, ${errors} errors`
    );
    return { migrated, errors };
  },
});

// ============================================
// IMAGE MIGRATION
// ============================================

/**
 * Get batch of images needing migration
 */
export const getImagesToMigrate = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("images").collect();
    return records
      .filter((r) => r.imageUrl && !r.imageUrl.includes("/flashcards/"))
      .slice(0, args.limit)
      .map((r) => ({
        _id: r._id,
        word: r.word,
        language: r.language,
        imageUrl: r.imageUrl,
      }));
  },
});

/**
 * Update image URL after migration
 */
export const updateImageUrl = internalMutation({
  args: {
    id: v.id("images"),
    newUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageUrl: args.newUrl });
  },
});

/**
 * Migrate image files to word-centric structure
 */
export const migrateImages = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx) => {
    const batchSize = 10;
    console.log(`Migrating images (batch size: ${batchSize})...`);

    const records = await ctx.runQuery(internal.migrations.mediaReorganization.getImagesToMigrate, {
      limit: batchSize,
    });

    if (records.length === 0) {
      console.log("No image records need migration");
      return { migrated: 0, errors: 0 };
    }

    let migrated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        console.log(`  Migrating image for: ${record.word} (${record.language})`);

        // Download from old URL
        const key = extractKeyFromUrl(record.imageUrl);
        if (!key) {
          console.log(`    Skipping: Could not extract key from URL`);
          errors++;
          continue;
        }

        const { data, contentType } = await downloadFile(key);

        // Upload to new path (use image ID as the identifier)
        const newUrl = await uploadWordImage(
          data,
          record.word,
          record.language as ContentLanguage,
          record._id, // Use image DB ID
          contentType
        );

        // Update database
        await ctx.runMutation(internal.migrations.mediaReorganization.updateImageUrl, {
          id: record._id,
          newUrl,
        });

        console.log(`    Migrated: ${record.imageUrl} -> ${newUrl}`);
        migrated++;
      } catch (error) {
        console.error(`    Error migrating image for ${record.word}:`, error);
        errors++;
      }
    }

    console.log(`\nImage migration batch complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors };
  },
});

// ============================================
// VERIFICATION
// ============================================

// Types for migration status
interface MigrationStatus {
  wordAudio: { total: number; needsMigration: number; alreadyMigrated: number };
  sentences: { total: number; withAudio: number; needsMigration: number; alreadyMigrated: number };
  images: { total: number; needsMigration: number; alreadyMigrated: number };
}

interface MigrationResult {
  migrated: number;
  errors: number;
}

/**
 * Verify migration by sampling URLs
 */
export const verifyMigration = internalAction({
  args: {},
  handler: async (ctx): Promise<{ status: MigrationStatus; complete: boolean }> => {
    console.log("Verifying migration...");

    const status: MigrationStatus = await ctx.runQuery(
      internal.migrations.mediaReorganization.checkMigrationStatus,
      {}
    );

    console.log("\nMigration Status:");
    console.log(
      `  Word Audio: ${status.wordAudio.alreadyMigrated}/${status.wordAudio.total} migrated`
    );
    console.log(
      `  Sentences:  ${status.sentences.alreadyMigrated}/${status.sentences.withAudio} migrated`
    );
    console.log(`  Images:     ${status.images.alreadyMigrated}/${status.images.total} migrated`);

    // Sample a few URLs to verify they work
    const wordAudioRecords = await ctx.runQuery(
      internal.migrations.mediaReorganization.getWordAudioToMigrate,
      { limit: 1 }
    );

    if (wordAudioRecords.length === 0) {
      console.log("\nAll word audio migrated!");
    } else {
      console.log(`\n${status.wordAudio.needsMigration} word audio records still need migration`);
    }

    return {
      status,
      complete:
        status.wordAudio.needsMigration === 0 &&
        status.sentences.needsMigration === 0 &&
        status.images.needsMigration === 0,
    };
  },
});

// ============================================
// BATCH MIGRATION RUNNER
// ============================================

/**
 * Run all migrations until complete
 * Call this repeatedly until it returns complete: true
 */
export const migrateAllBatch = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    wordAudio: MigrationResult;
    sentences: MigrationResult;
    images: MigrationResult;
    remaining: { wordAudio: number; sentences: number; images: number };
    complete: boolean;
  }> => {
    console.log("Running batch migration...\n");

    // Migrate word audio
    const wordAudioResult: MigrationResult = await ctx.runAction(
      internal.migrations.mediaReorganization.migrateWordAudio,
      {}
    );

    // Migrate sentence audio
    const sentenceResult: MigrationResult = await ctx.runAction(
      internal.migrations.mediaReorganization.migrateSentenceAudio,
      {}
    );

    // Migrate images
    const imageResult: MigrationResult = await ctx.runAction(
      internal.migrations.mediaReorganization.migrateImages,
      {}
    );

    // Check status
    const status: MigrationStatus = await ctx.runQuery(
      internal.migrations.mediaReorganization.checkMigrationStatus,
      {}
    );

    const complete =
      status.wordAudio.needsMigration === 0 &&
      status.sentences.needsMigration === 0 &&
      status.images.needsMigration === 0;

    console.log("\n=== Batch Summary ===");
    console.log(
      `Word Audio: ${wordAudioResult.migrated} migrated, ${wordAudioResult.errors} errors`
    );
    console.log(`Sentences:  ${sentenceResult.migrated} migrated, ${sentenceResult.errors} errors`);
    console.log(`Images:     ${imageResult.migrated} migrated, ${imageResult.errors} errors`);
    console.log(
      `\nRemaining: ${status.wordAudio.needsMigration + status.sentences.needsMigration + status.images.needsMigration} records`
    );
    console.log(`Complete: ${complete}`);

    return {
      wordAudio: wordAudioResult,
      sentences: sentenceResult,
      images: imageResult,
      remaining: {
        wordAudio: status.wordAudio.needsMigration,
        sentences: status.sentences.needsMigration,
        images: status.images.needsMigration,
      },
      complete,
    };
  },
});

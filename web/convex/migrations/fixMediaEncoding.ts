/**
 * Migration: Fix Media URL Encoding - Queries and Mutations
 *
 * Problem: Japanese characters were double URL-encoded in S3 keys.
 * - getWordFolderPath() used encodeURIComponent() to create the S3 key
 * - Key stored in R2 has literal %E8%81%9E%E3%81%8F characters
 * - When browser requests URL, R2 URL-decodes the path and looks for raw Unicode
 * - 404 because actual key has literal % characters
 *
 * Fix: Download files using literal key, re-upload with raw Unicode key,
 * update database URLs.
 *
 * Usage:
 *   npx convex run migrations/fixMediaEncoding:findAffectedRecords
 *   npx convex run migrations/fixMediaEncodingActions:migrateImages --args '{"limit": 10}'
 *   npx convex run migrations/fixMediaEncodingActions:migrateSentences --args '{"limit": 10}'
 *   npx convex run migrations/fixMediaEncodingActions:migrateWordAudio --args '{"limit": 10}'
 */

import { v } from "convex/values";

import { internalMutation, internalQuery, query } from "../_generated/server";

// Detect if a URL has encoded characters in the path
// This means the R2 key has literal % characters that need to be migrated
// e.g., URL contains %E9%A3%9F which will be decoded by browser but R2 key has literal %E9%A3%9F
function hasEncodedPath(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    // Check if path contains %XX patterns (percent-encoded characters)
    // We check the raw URL string, not the decoded pathname
    const pathFromUrl = url.slice(url.indexOf(urlObj.pathname));
    return /%[0-9A-Fa-f]{2}/.test(pathFromUrl);
  } catch {
    return false;
  }
}

// Find all images with potentially double-encoded URLs
export const findAffectedImages = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("images").collect();
    const affected = images.filter((img) => hasEncodedPath(img.imageUrl));
    return {
      total: images.length,
      affected: affected.length,
      samples: affected.slice(0, 5).map((img) => ({
        id: img._id,
        url: img.imageUrl,
        word: img.word,
      })),
    };
  },
});

// Find all sentences with potentially double-encoded audio URLs
export const findAffectedSentences = query({
  args: {},
  handler: async (ctx) => {
    const sentences = await ctx.db.query("sentences").collect();
    const affected = sentences.filter((s) => s.audioUrl && hasEncodedPath(s.audioUrl));
    return {
      total: sentences.length,
      affected: affected.length,
      samples: affected.slice(0, 5).map((s) => ({
        id: s._id,
        url: s.audioUrl,
      })),
    };
  },
});

// Find all wordAudio with potentially double-encoded URLs
export const findAffectedWordAudio = query({
  args: {},
  handler: async (ctx) => {
    const wordAudio = await ctx.db.query("wordAudio").collect();
    const affected = wordAudio.filter((wa) => hasEncodedPath(wa.audioUrl));
    return {
      total: wordAudio.length,
      affected: affected.length,
      samples: affected.slice(0, 5).map((wa) => ({
        id: wa._id,
        url: wa.audioUrl,
        word: wa.word,
      })),
    };
  },
});

// Combined summary
export const findAffectedRecords = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("images").collect();
    const sentences = await ctx.db.query("sentences").collect();
    const wordAudio = await ctx.db.query("wordAudio").collect();

    return {
      images: {
        total: images.length,
        affected: images.filter((img) => hasEncodedPath(img.imageUrl)).length,
      },
      sentences: {
        total: sentences.length,
        affected: sentences.filter((s) => s.audioUrl && hasEncodedPath(s.audioUrl)).length,
      },
      wordAudio: {
        total: wordAudio.length,
        affected: wordAudio.filter((wa) => hasEncodedPath(wa.audioUrl)).length,
      },
    };
  },
});

// Internal query to get affected images for migration
export const getAffectedImages = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const images = await ctx.db.query("images").collect();
    return images.filter((img) => hasEncodedPath(img.imageUrl)).slice(0, limit);
  },
});

// Internal query to get affected sentences for migration
export const getAffectedSentences = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const sentences = await ctx.db.query("sentences").collect();
    return sentences.filter((s) => s.audioUrl && hasEncodedPath(s.audioUrl)).slice(0, limit);
  },
});

// Internal query to get affected wordAudio for migration
export const getAffectedWordAudio = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const wordAudio = await ctx.db.query("wordAudio").collect();
    return wordAudio.filter((wa) => hasEncodedPath(wa.audioUrl)).slice(0, limit);
  },
});

// Update image URL after migration
export const updateImageUrl = internalMutation({
  args: {
    imageId: v.id("images"),
    newUrl: v.string(),
  },
  handler: async (ctx, { imageId, newUrl }) => {
    await ctx.db.patch(imageId, { imageUrl: newUrl });
  },
});

// Update sentence audio URL after migration
export const updateSentenceUrl = internalMutation({
  args: {
    sentenceId: v.id("sentences"),
    newUrl: v.string(),
  },
  handler: async (ctx, { sentenceId, newUrl }) => {
    await ctx.db.patch(sentenceId, { audioUrl: newUrl });
  },
});

// Update wordAudio URL after migration
export const updateWordAudioUrl = internalMutation({
  args: {
    wordAudioId: v.id("wordAudio"),
    newUrl: v.string(),
  },
  handler: async (ctx, { wordAudioId, newUrl }) => {
    await ctx.db.patch(wordAudioId, { audioUrl: newUrl });
  },
});

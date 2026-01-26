"use node";

/**
 * Migration Actions: Fix Media URL Encoding
 *
 * These actions run in Node.js to perform R2 file operations.
 * See fixMediaEncoding.ts for queries and usage instructions.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function migrateFile(
  client: S3Client,
  bucketName: string,
  publicUrl: string,
  oldUrl: string
): Promise<string> {
  const baseUrl = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;

  // Extract the path from URL - we need the raw path with %XX intact
  const encodedPath = oldUrl.slice(baseUrl.length + 1); // +1 for the /

  // The decoded key is what we want to use going forward
  const decodedKey = decodeURIComponent(encodedPath);

  // If path has no encoded characters, nothing to migrate
  if (encodedPath === decodedKey) {
    return oldUrl;
  }

  // Try to find the file - it could be at decoded path (if R2 decoded during upload)
  // or at encoded path (literal % in key)
  let fileData: Uint8Array;
  let contentType: string;
  let foundAtDecodedPath = false;

  try {
    // First try: file is stored at decoded path (R2 decoded the key during upload)
    const getResponse = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: decodedKey,
      })
    );
    if (!getResponse.Body) {
      throw new Error("No body");
    }
    fileData = await getResponse.Body.transformToByteArray();
    contentType = getResponse.ContentType || "application/octet-stream";
    foundAtDecodedPath = true;
  } catch {
    // Second try: file is stored at encoded path (literal % in key)
    try {
      const getResponse = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: encodedPath,
        })
      );
      if (!getResponse.Body) {
        throw new Error("No body");
      }
      fileData = await getResponse.Body.transformToByteArray();
      contentType = getResponse.ContentType || "application/octet-stream";
      foundAtDecodedPath = false;
    } catch {
      throw new Error(`File not found at decoded (${decodedKey}) or encoded (${encodedPath}) path`);
    }
  }

  // If file was at encoded path, move it to decoded path
  if (!foundAtDecodedPath) {
    // Upload to decoded key
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: decodedKey,
        Body: fileData,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    // Delete from encoded key
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: encodedPath,
      })
    );
  }

  // Return new URL with properly encoded path segments for the decoded key
  const encodedNewKey = decodedKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/${encodedNewKey}`;
}

// Migrate images with encoded URLs
export const migrateImages = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";
    const publicUrl = process.env.R2_PUBLIC_URL || "";

    const affectedImages = await ctx.runQuery(
      internal.migrations.fixMediaEncoding.getAffectedImages,
      { limit }
    );

    const client = getR2Client();
    const results: { id: string; oldUrl: string; newUrl: string; error?: string }[] = [];

    for (const image of affectedImages) {
      try {
        const newUrl = await migrateFile(client, bucketName, publicUrl, image.imageUrl);
        await ctx.runMutation(internal.migrations.fixMediaEncoding.updateImageUrl, {
          imageId: image._id,
          newUrl,
        });
        results.push({ id: image._id, oldUrl: image.imageUrl, newUrl });
      } catch (error) {
        results.push({
          id: image._id,
          oldUrl: image.imageUrl,
          newUrl: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  },
});

// Migrate sentences with encoded audio URLs
export const migrateSentences = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";
    const publicUrl = process.env.R2_PUBLIC_URL || "";

    const affectedSentences = await ctx.runQuery(
      internal.migrations.fixMediaEncoding.getAffectedSentences,
      { limit }
    );

    const client = getR2Client();
    const results: { id: string; oldUrl: string; newUrl: string; error?: string }[] = [];

    for (const sentence of affectedSentences) {
      if (!sentence.audioUrl) continue;
      try {
        const newUrl = await migrateFile(client, bucketName, publicUrl, sentence.audioUrl);
        await ctx.runMutation(internal.migrations.fixMediaEncoding.updateSentenceUrl, {
          sentenceId: sentence._id,
          newUrl,
        });
        results.push({ id: sentence._id, oldUrl: sentence.audioUrl, newUrl });
      } catch (error) {
        results.push({
          id: sentence._id,
          oldUrl: sentence.audioUrl,
          newUrl: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  },
});

// Migrate wordAudio with encoded URLs
export const migrateWordAudio = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";
    const publicUrl = process.env.R2_PUBLIC_URL || "";

    const affectedWordAudio = await ctx.runQuery(
      internal.migrations.fixMediaEncoding.getAffectedWordAudio,
      { limit }
    );

    const client = getR2Client();
    const results: { id: string; oldUrl: string; newUrl: string; error?: string }[] = [];

    for (const wordAudio of affectedWordAudio) {
      try {
        const newUrl = await migrateFile(client, bucketName, publicUrl, wordAudio.audioUrl);
        await ctx.runMutation(internal.migrations.fixMediaEncoding.updateWordAudioUrl, {
          wordAudioId: wordAudio._id,
          newUrl,
        });
        results.push({ id: wordAudio._id, oldUrl: wordAudio.audioUrl, newUrl });
      } catch (error) {
        results.push({
          id: wordAudio._id,
          oldUrl: wordAudio.audioUrl,
          newUrl: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  },
});

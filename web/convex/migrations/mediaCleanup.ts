"use node";

/**
 * Cleanup old R2 folders after media reorganization
 *
 * Usage:
 *   # Preview what would be deleted
 *   npx convex run migrations/mediaCleanup:previewCleanup
 *
 *   # Delete old folders
 *   npx convex run migrations/mediaCleanup:cleanupOldFolders
 */

import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import { internalAction } from "../_generated/server";

function getR2Client(): { client: S3Client; bucketName: string } {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucketName };
}

async function listObjectsWithPrefix(prefix: string): Promise<string[]> {
  const { client, bucketName } = getR2Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function deleteObjectsWithPrefix(prefix: string): Promise<number> {
  const { client, bucketName } = getR2Client();
  const keys = await listObjectsWithPrefix(prefix);

  if (keys.length === 0) {
    return 0;
  }

  // Delete in batches of 1000 (S3/R2 limit)
  const batchSize = 1000;
  let deleted = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
        },
      })
    );
    deleted += batch.length;
  }

  return deleted;
}

/**
 * Preview what would be deleted from old folders
 */
export const previewCleanup = internalAction({
  args: {},
  handler: async (): Promise<{ audio: number; images: number; words: number }> => {
    console.log("Listing objects in old folders...\n");

    const audioKeys = await listObjectsWithPrefix("audio/");
    const imageKeys = await listObjectsWithPrefix("images/");
    const wordsKeys = await listObjectsWithPrefix("words/");

    console.log(`audio/: ${audioKeys.length} objects`);
    console.log(`images/: ${imageKeys.length} objects`);
    console.log(`words/: ${wordsKeys.length} objects`);

    return {
      audio: audioKeys.length,
      images: imageKeys.length,
      words: wordsKeys.length,
    };
  },
});

/**
 * Delete old folders after migration is complete
 * WARNING: This permanently deletes files. Only run after verifying migration.
 */
export const cleanupOldFolders = internalAction({
  args: {},
  handler: async (): Promise<{ audio: number; images: number; words: number; total: number }> => {
    console.log("Deleting old folders...\n");

    const audioDeleted = await deleteObjectsWithPrefix("audio/");
    console.log(`Deleted ${audioDeleted} objects from audio/`);

    const imagesDeleted = await deleteObjectsWithPrefix("images/");
    console.log(`Deleted ${imagesDeleted} objects from images/`);

    const wordsDeleted = await deleteObjectsWithPrefix("words/");
    console.log(`Deleted ${wordsDeleted} objects from words/`);

    const total = audioDeleted + imagesDeleted + wordsDeleted;
    console.log(`\nTotal deleted: ${total} objects`);

    return {
      audio: audioDeleted,
      images: imagesDeleted,
      words: wordsDeleted,
      total,
    };
  },
});

/**
 * Generic file storage abstraction
 *
 * This module provides a provider-agnostic interface for file uploads.
 * To change providers, simply update the implementation in this file.
 *
 * Currently supported: Cloudflare R2
 * Easy to add: AWS S3, Google Cloud Storage, Backblaze B2, etc.
 */

import { PutObjectCommand,S3Client } from "@aws-sdk/client-s3";

// ============================================
// STORAGE INTERFACE
// ============================================

export interface UploadOptions {
  /** File data as Uint8Array */
  data: Uint8Array;
  /** MIME type (e.g., "audio/wav", "image/png") */
  contentType: string;
  /** Optional folder prefix (e.g., "audio", "images") */
  prefix?: string;
  /** Optional cache control header */
  cacheControl?: string;
}

export interface StorageProvider {
  upload(options: UploadOptions): Promise<string>;
}

// ============================================
// R2 PROVIDER
// ============================================

class R2StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || "sanlang-media";
    this.publicUrl = process.env.R2_PUBLIC_URL || "";
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL in Convex environment variables."
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  async upload(options: UploadOptions): Promise<string> {
    const client = this.getClient();

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const extension = getExtensionFromMime(options.contentType);
    const key = options.prefix
      ? `${options.prefix}/${timestamp}-${random}.${extension}`
      : `${timestamp}-${random}.${extension}`;

    // Upload to R2
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: options.data,
        ContentType: options.contentType,
        CacheControl: options.cacheControl || "public, max-age=31536000, immutable",
      })
    );

    // Return public URL
    const baseUrl = this.publicUrl.endsWith("/") ? this.publicUrl.slice(0, -1) : this.publicUrl;
    return `${baseUrl}/${key}`;
  }
}

// ============================================
// CONVEX STORAGE PROVIDER (fallback/legacy)
// ============================================

// This can be used if you want to fallback to Convex storage
// Requires passing the ctx.storage object from the action
export class ConvexStorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex storage type is complex to import in shared lib
  constructor(private storage: any) {}

  async upload(options: UploadOptions): Promise<string> {
    // Convert Uint8Array to Blob-compatible format
    const arrayBuffer = options.data.buffer.slice(
      options.data.byteOffset,
      options.data.byteOffset + options.data.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: options.contentType });
    const storageId = await this.storage.store(blob);
    const url = await this.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Failed to get URL from Convex storage");
    }
    return url;
  }
}

// ============================================
// PROVIDER SELECTION
// ============================================

// Change this to switch providers globally
type ProviderType = "r2" | "convex";

const ACTIVE_PROVIDER: ProviderType = "r2";

// Singleton instance for R2
let r2Provider: R2StorageProvider | null = null;

/**
 * Get the active storage provider
 *
 * @param convexStorage - Optional Convex storage object (needed for "convex" provider)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex storage type is complex to import in shared lib
export function getStorageProvider(convexStorage?: any): StorageProvider {
  switch (ACTIVE_PROVIDER) {
    case "r2":
      if (!r2Provider) {
        r2Provider = new R2StorageProvider();
      }
      return r2Provider;

    case "convex":
      if (!convexStorage) {
        throw new Error("Convex storage object required for convex provider");
      }
      return new ConvexStorageProvider(convexStorage);

    default:
      throw new Error(`Unknown storage provider: ${ACTIVE_PROVIDER}`);
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Upload audio file to storage
 */
export async function uploadAudio(
  data: Uint8Array,
  mimeType: string = "audio/wav"
): Promise<string> {
  const provider = getStorageProvider();
  return provider.upload({
    data,
    contentType: mimeType,
    prefix: "audio",
  });
}

/**
 * Upload image file to storage
 */
export async function uploadImage(
  data: Uint8Array,
  mimeType: string = "image/png"
): Promise<string> {
  const provider = getStorageProvider();
  return provider.upload({
    data,
    contentType: mimeType,
    prefix: "images",
  });
}

// ============================================
// UTILITIES
// ============================================

function getExtensionFromMime(contentType: string): string {
  const map: Record<string, string> = {
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType] || "bin";
}

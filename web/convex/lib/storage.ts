/**
 * Generic file storage abstraction
 *
 * This module provides a provider-agnostic interface for file uploads.
 * To change providers, simply update the implementation in this file.
 *
 * Currently supported: Cloudflare R2
 * Easy to add: AWS S3, Google Cloud Storage, Backblaze B2, etc.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

export interface DownloadResult {
  /** File data as Uint8Array */
  data: Uint8Array;
  /** MIME type from storage */
  contentType: string;
}

export interface StorageProvider {
  /** Upload a file and return its public URL */
  upload(options: UploadOptions): Promise<string>;
  /** Download a file by its key (path after bucket) */
  download(key: string): Promise<DownloadResult>;
  /** Delete a file by its key */
  delete(key: string): Promise<void>;
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

  async download(key: string): Promise<DownloadResult> {
    const client = this.getClient();

    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`No body in response for key: ${key}`);
    }

    // Convert stream to Uint8Array
    const bytes = await response.Body.transformToByteArray();

    return {
      data: bytes,
      contentType: response.ContentType || "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    const client = this.getClient();

    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }

  /**
   * Extract the storage key from a public URL
   * Useful when you have a URL and need to download/delete by key
   */
  extractKeyFromUrl(url: string): string | null {
    const baseUrl = this.publicUrl.endsWith("/") ? this.publicUrl.slice(0, -1) : this.publicUrl;
    if (!url.startsWith(baseUrl)) {
      return null;
    }
    return url.slice(baseUrl.length + 1); // +1 for the /
  }
}

// ============================================
// CONVEX STORAGE PROVIDER (fallback/legacy)
// ============================================

// This can be used if you want to fallback to Convex storage
// Requires passing the ctx.storage object from the action
export class ConvexStorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex storage type is complex to import in shared lib
  private storage: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex storage type is complex to import in shared lib
  constructor(storage: any) {
    this.storage = storage;
  }

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

  async download(_key: string): Promise<DownloadResult> {
    // Convex storage uses storageIds, not keys - direct download not supported through this interface
    throw new Error("Download by key not supported for Convex storage provider");
  }

  async delete(_key: string): Promise<void> {
    // Convex storage uses storageIds for deletion - not supported through this interface
    throw new Error("Delete by key not supported for Convex storage provider");
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

/**
 * Download a file from storage by its key
 */
export async function downloadFile(key: string): Promise<DownloadResult> {
  const provider = getStorageProvider();
  return provider.download(key);
}

/**
 * Delete a file from storage by its key
 */
export async function deleteFile(key: string): Promise<void> {
  const provider = getStorageProvider();
  return provider.delete(key);
}

/**
 * Extract storage key from a public URL (R2 only)
 * Returns null if URL doesn't match the configured public URL
 */
export function extractKeyFromUrl(url: string): string | null {
  const publicUrl = process.env.R2_PUBLIC_URL || "";
  const baseUrl = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;
  if (!url.startsWith(baseUrl)) {
    return null;
  }
  return url.slice(baseUrl.length + 1);
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

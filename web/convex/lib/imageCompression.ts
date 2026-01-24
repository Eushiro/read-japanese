"use node";

/**
 * Image compression utilities for storage optimization
 *
 * Uses Sharp to convert PNG images to WebP format,
 * reducing file size by ~70% while maintaining quality.
 */

import sharp from "sharp";

/**
 * Compress an image to WebP format
 *
 * @param imageData - Raw image data (PNG, JPEG, etc.)
 * @param quality - WebP quality (0-100), default 80
 * @returns Compressed WebP image data
 */
export async function compressToWebp(imageData: Uint8Array, quality = 80): Promise<Uint8Array> {
  const buffer = await sharp(imageData).webp({ quality }).toBuffer();
  return new Uint8Array(buffer);
}

/**
 * Compress a PNG image to WebP format
 * Alias for compressToWebp for clarity at call sites
 */
export async function compressPngToWebp(pngData: Uint8Array, quality = 80): Promise<Uint8Array> {
  return compressToWebp(pngData, quality);
}

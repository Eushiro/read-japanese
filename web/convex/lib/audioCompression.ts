"use node";

/**
 * Audio compression utilities for storage optimization
 *
 * Uses lamejs to convert raw PCM audio to MP3 format,
 * reducing file size by ~70% while maintaining quality.
 *
 * Gemini TTS returns raw PCM 16-bit 24kHz audio, which browsers
 * cannot play directly. This converts to MP3 for playback.
 */

import lamejs from "@breezystack/lamejs";

/**
 * Convert raw PCM 16-bit audio to MP3
 *
 * @param pcmData - Raw PCM audio as Uint8Array (16-bit little-endian)
 * @param sampleRate - Sample rate in Hz (Gemini returns 24000)
 * @param channels - Number of channels (1 for mono)
 * @param bitRate - MP3 bitrate in kbps (default 128)
 * @returns Compressed MP3 audio data
 */
export function convertPcmToMp3(
  pcmData: Uint8Array,
  sampleRate: number = 24000,
  channels: number = 1,
  bitRate: number = 128
): Uint8Array {
  // Convert Uint8Array to Int16Array (PCM 16-bit little-endian)
  const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);

  const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
  const mp3Data: Uint8Array[] = [];

  // Process in blocks - must be multiple of 576 for lamejs
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, Math.min(i + blockSize, samples.length));
    const mp3Chunk = mp3Encoder.encodeBuffer(chunk);
    if (mp3Chunk.length > 0) {
      mp3Data.push(new Uint8Array(mp3Chunk));
    }
  }

  // Flush remaining data
  const finalChunk = mp3Encoder.flush();
  if (finalChunk.length > 0) {
    mp3Data.push(new Uint8Array(finalChunk));
  }

  // Combine all chunks into single Uint8Array
  const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

"use node";

// ============================================
// SHARED TYPES FOR AI PROVIDERS
// ============================================

/**
 * JSON schema for structured output
 */
export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Options for text generation
 */
export interface TextGenerationOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  jsonSchema?: JsonSchema;
  temperature?: number;
}

/**
 * Result from text generation
 */
export interface TextGenerationResult {
  content: string;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
}

/**
 * Options for image generation
 */
export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "4:3" | "3:4" | "9:16";
}

/**
 * Result from image generation
 */
export interface ImageGenerationResult {
  imageData: Uint8Array;
  mimeType: string;
}

/**
 * Options for TTS generation
 */
export interface TTSOptions {
  text: string;
  language: string;
  voice?: string;
}

/**
 * Options for text generation with audio input
 */
export interface AudioInputOptions extends TextGenerationOptions {
  audioBase64: string;
  audioFormat: string;
}

/**
 * Result from TTS generation
 */
export interface TTSResult {
  audioData: Uint8Array;
  mimeType: string;
}

/**
 * Provider type
 */
export type ProviderType = "google" | "openrouter";

/**
 * Model configuration with provider
 */
export interface ModelConfig {
  model: string;
  provider: ProviderType;
}

/**
 * Provider-agnostic interface for AI operations
 */
export interface AIProvider {
  generateText(options: TextGenerationOptions): Promise<TextGenerationResult>;
  generateImage?(options: ImageGenerationOptions): Promise<ImageGenerationResult | null>;
  generateSpeech?(options: TTSOptions): Promise<TTSResult | null>;
}

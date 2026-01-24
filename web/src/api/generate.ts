import type { JLPTLevel,Story } from "@/types/story";

import apiClient from "./client";

// Story generation request
export interface GenerateStoryRequest {
  jlpt_level: JLPTLevel;
  genre: string;
  theme?: string;
  num_chapters?: number;
  words_per_chapter?: number;
  voice?: string;
  image_style?: string;
  generate_audio?: boolean;
  generate_image?: boolean;
  generate_chapter_images?: boolean;
  align_audio?: boolean;
}

// Generation job response
export interface GenerateStoryResponse {
  status: "pending" | "running" | "completed" | "failed";
  story_id?: string;
  message: string;
}

// Generation status response
export interface GenerationStatus {
  status: "pending" | "running" | "completed" | "failed";
  progress: string;
  story_id?: string;
  story?: Story;
  error?: string;
}

// Start story generation (background)
export async function generateStory(request: GenerateStoryRequest): Promise<GenerateStoryResponse> {
  return apiClient.post<GenerateStoryResponse>("/api/generate/story", request);
}

// Start story generation (synchronous - waits for completion)
export async function generateStorySync(
  request: GenerateStoryRequest
): Promise<{ status: string; story: Story }> {
  return apiClient.post<{ status: string; story: Story }>("/api/generate/story/sync", request);
}

// Check generation status
export async function getGenerationStatus(jobId: string): Promise<GenerationStatus> {
  return apiClient.get<GenerationStatus>(`/api/generate/status/${jobId}`);
}

// Get story ideas
export async function generateIdeas(
  jlptLevel: JLPTLevel
): Promise<Array<{ title: string; genre: string; description: string }>> {
  return apiClient.post<Array<{ title: string; genre: string; description: string }>>(
    "/api/generate/ideas",
    { jlpt_level: jlptLevel }
  );
}

// Get available genres
export async function getGenres(): Promise<string[]> {
  return apiClient.get<string[]>("/api/generate/genres");
}

// Get available TTS voices
export async function getVoices(): Promise<string[]> {
  return apiClient.get<string[]>("/api/generate/voices");
}

// Get available image styles
export async function getImageStyles(): Promise<string[]> {
  return apiClient.get<string[]>("/api/generate/styles");
}

// Poll for generation completion
export async function pollGenerationStatus(
  jobId: string,
  onProgress?: (status: GenerationStatus) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 180 // 6 minutes max
): Promise<GenerationStatus> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getGenerationStatus(jobId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error("Generation timed out");
}

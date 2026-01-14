// API base URL - defaults to production, can be overridden for local dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://read-japanese.onrender.com";

export interface ApiError {
  status: number;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = {
        status: response.status,
        message: response.statusText,
      };
      try {
        const data = await response.json();
        error.message = data.detail || data.message || response.statusText;
      } catch {
        // Ignore JSON parse errors
      }
      throw error;
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Get full URL for static assets (images, audio)
  getAssetUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/cdn")) return `${this.baseUrl}${path}`;
    return `${this.baseUrl}/cdn${path.startsWith("/") ? "" : "/"}${path}`;
  }
}

export const apiClient = new ApiClient();
export default apiClient;

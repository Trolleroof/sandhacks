// API client for Recall backend

import type { ObjectLocation, GuidanceData } from "./mockData";
import { findObject, searchObjects, getMockGuidance, mockObjects, mockDetections } from "./mockData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { data: null, error: message };
  }
}

// API endpoints
export const api = {
  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Mapping endpoints
  mapping: {
    async start(): Promise<{ success: boolean; error?: string }> {
      const result = await apiFetch<{ status: string }>("/mapping/start", {
        method: "POST",
      });
      return {
        success: !result.error,
        error: result.error || undefined,
      };
    },

    async stop(): Promise<{ success: boolean; error?: string }> {
      const result = await apiFetch<{ status: string }>("/mapping/stop", {
        method: "POST",
      });
      return {
        success: !result.error,
        error: result.error || undefined,
      };
    },
  },

  // Object search
  objects: {
    async search(query: string): Promise<{ results: ObjectLocation[]; error?: string }> {
      const result = await apiFetch<{ objects: ObjectLocation[] }>(
        `/objects/search?query=${encodeURIComponent(query)}`
      );
      return {
        results: result.data?.objects || [],
        error: result.error || undefined,
      };
    },
  },

  // Navigation guidance
  navigation: {
    async getGuidance(targetId: string): Promise<{ guidance: GuidanceData | null; error?: string }> {
      const result = await apiFetch<GuidanceData>(
        `/navigation/guide?target_id=${targetId}`
      );
      return {
        guidance: result.data,
        error: result.error || undefined,
      };
    },
  },

  // Camera stream URL
  camera: {
    streamUrl: `${API_BASE}/camera/stream`,
  },
};

// Mock API implementation for demo mode
export const mockApi = {
  async checkHealth(): Promise<boolean> {
    return true;
  },

  mapping: {
    async start(): Promise<{ success: boolean; error?: string }> {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },

    async stop(): Promise<{ success: boolean; error?: string }> {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },
  },

  objects: {
    async search(query: string): Promise<{ results: ObjectLocation[]; error?: string }> {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const found = searchObjects(query);
      // Sort by distance (nearest first)
      const sorted = found.sort((a, b) => a.distanceMeters - b.distanceMeters);
      return {
        results: sorted,
      };
    },
  },

  navigation: {
    async getGuidance(targetId: string): Promise<{ guidance: GuidanceData | null; error?: string }> {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const target = mockObjects.find((obj) => obj.id === targetId);
      if (!target) {
        return { guidance: null, error: "Target not found" };
      }
      return { guidance: getMockGuidance(target) };
    },
  },

  camera: {
    // For mock mode, use a placeholder
    streamUrl: "/placeholder-camera.png",
  },

  // Additional mock data helpers
  getDetections() {
    return mockDetections;
  },

  getMemoryCount() {
    return mockObjects.length;
  },
};

// Get the appropriate API based on mode
export function getApi(useMock: boolean) {
  return useMock ? mockApi : api;
}

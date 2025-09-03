// API utilities for backend communication
import type {
  SearchParams,
  SearchResponse,
  DataSource,
  Favorite,
  Settings,
  Stats,
  AddSourceForm,
  UpdateSourceForm,
  ApiError,
} from "../types";

const API_BASE = "/api";

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData: ApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: "Unknown error",
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        throw new Error(errorData.message || errorData.error);
      }

      // Handle empty responses (like DELETE requests)
      if (
        response.status === 204 ||
        response.headers.get("content-length") === "0"
      ) {
        return {} as T;
      }

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Response is not JSON:", await response.text());
        throw new Error("Server returned non-JSON response");
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", { url, error });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred");
    }
  }

  // Search endpoints
  async search(params: SearchParams): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();

    searchParams.append("query", params.query);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.category) searchParams.append("category", params.category);
    if (params.source) searchParams.append("source", params.source);

    return this.request<SearchResponse>(`/search?${searchParams}`);
  }

  // Data source endpoints
  async getSources(): Promise<DataSource[]> {
    return this.request<DataSource[]>("/sources");
  }

  async addSource(source: AddSourceForm): Promise<DataSource> {
    return this.request<DataSource>("/sources", {
      method: "POST",
      body: JSON.stringify(source),
    });
  }

  async updateSource(source: UpdateSourceForm): Promise<DataSource> {
    return this.request<DataSource>(`/sources/${source.id}`, {
      method: "PUT",
      body: JSON.stringify(source),
    });
  }

  async deleteSource(id: string): Promise<void> {
    return this.request<void>(`/sources/${id}`, {
      method: "DELETE",
    });
  }

  async toggleSource(id: string, enabled: boolean): Promise<DataSource> {
    return this.request<DataSource>(`/sources/${id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  }

  async updateSourceById(id: string): Promise<void> {
    return this.request<void>(`/sources/${id}/update`, {
      method: "POST",
    });
  }

  async processSource(id: string): Promise<void> {
    return this.request<void>(`/sources/${id}/process`, {
      method: "POST",
    });
  }

  // Favorites endpoints
  async getFavorites(): Promise<Favorite[]> {
    try {
      return await this.request<Favorite[]>("/favorites");
    } catch (error) {
      console.warn("Favorites endpoint not available, returning empty array");
      return [];
    }
  }

  async addFavorite(
    favorite: Omit<Favorite, "id" | "addedAt">,
  ): Promise<Favorite> {
    return this.request<Favorite>("/favorites", {
      method: "POST",
      body: JSON.stringify(favorite),
    });
  }

  async removeFavorite(id: string): Promise<void> {
    return this.request<void>(`/favorites/${id}`, {
      method: "DELETE",
    });
  }

  async updateFavorite(
    id: string,
    updates: Partial<Favorite>,
  ): Promise<Favorite> {
    return this.request<Favorite>(`/favorites/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // Settings endpoints
  async getSettings(): Promise<Settings> {
    return this.request<Settings>("/settings");
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return this.request<Settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async resetSettings(): Promise<Settings> {
    return this.request<Settings>("/settings/reset", {
      method: "POST",
    });
  }

  // Stats endpoints
  async getStats(): Promise<Stats> {
    try {
      return await this.request<Stats>("/stats");
    } catch (error) {
      console.warn("Stats endpoint not available, returning mock data");
      return {
        totalSources: 0,
        totalItems: 0,
        totalFavorites: 0,
        lastUpdated: new Date().toISOString(),
        topCategories: [],
        sourceStats: [],
        searchStats: {
          totalSearches: 0,
          popularQueries: [],
        },
      };
    }
  }

  async getLibrary(): Promise<{
    sources: DataSource[];
    totalItems: number;
    lastUpdated: string;
  }> {
    try {
      return await this.request("/library");
    } catch (error) {
      console.warn("Library endpoint not available, returning mock data");
      return {
        sources: [],
        totalItems: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>("/health");
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Utility functions for common operations
export const searchUtils = {
  buildSearchUrl: (params: SearchParams): string => {
    const searchParams = new URLSearchParams();
    searchParams.append("query", params.query);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.category) searchParams.append("category", params.category);
    if (params.source) searchParams.append("source", params.source);
    return `${API_BASE}/search?${searchParams}`;
  },

  validateSearchQuery: (
    query: string,
    minLength = 2,
    maxLength = 100,
  ): string | null => {
    if (!query || query.trim().length === 0) {
      return "Please enter a search query";
    }

    if (query.length < minLength) {
      return `Search query must be at least ${minLength} characters long`;
    }

    if (query.length > maxLength) {
      return "Search query is too long";
    }

    if (/[<>]/.test(query)) {
      return "Search query contains invalid characters";
    }

    return null;
  },
};

export const sourceUtils = {
  validateSourceUrl: (
    url: string,
    type: "git" | "reddit_wiki",
  ): string | null => {
    try {
      const urlObj = new URL(url);

      if (type === "git") {
        if (
          !urlObj.hostname.includes("github.com") &&
          !urlObj.hostname.includes("gitlab.com") &&
          !urlObj.hostname.includes("gitea.com")
        ) {
          return "Git sources must be from GitHub, GitLab, or Gitea";
        }
      } else if (type === "reddit_wiki") {
        if (
          !urlObj.hostname.includes("reddit.com") ||
          !urlObj.pathname.includes("/wiki/")
        ) {
          return "Reddit wiki sources must be from reddit.com and include /wiki/ in the path";
        }
      }

      return null;
    } catch {
      return "Please enter a valid URL";
    }
  },

  getSourceDisplayName: (source: DataSource): string => {
    return source.name || source.url.split("/").pop() || "Unknown Source";
  },

  getSourceStatus: (
    source: DataSource,
  ): {
    color: string;
    text: string;
  } => {
    switch (source.status) {
      case "active":
        return { color: "green", text: "Active" };
      case "updating":
        return { color: "blue", text: "Updating..." };
      case "error":
        return { color: "red", text: "Error" };
      case "disabled":
        return { color: "gray", text: "Disabled" };
      default:
        return { color: "gray", text: "Unknown" };
    }
  },
};

export const favoriteUtils = {
  createFavoriteFromSearchResult: (result: {
    id: string;
    title: string;
    description: string;
    url: string;
    category: string;
    source: string;
  }): Omit<Favorite, "id" | "addedAt"> => ({
    title: result.title,
    description: result.description,
    url: result.url,
    category: result.category,
    source: result.source,
    tags: [result.category].filter(Boolean),
  }),
};

// Error handling utilities
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
};

export const isNetworkError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes("Network");
};

// Cache utilities for offline support
export const cacheUtils = {
  getCacheKey: (endpoint: string, params?: Record<string, unknown>): string => {
    const key = params ? `${endpoint}_${JSON.stringify(params)}` : endpoint;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, "");
  },

  setCacheItem: (key: string, data: unknown, ttl = 300000): void => {
    // 5 minutes default
    const item = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn("Failed to cache data:", error);
    }
  },

  getCacheItem: <T>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) return null;

      const item = JSON.parse(cached);
      const isExpired = Date.now() - item.timestamp > item.ttl;

      if (isExpired) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn("Failed to retrieve cached data:", error);
      return null;
    }
  },

  clearExpiredCache: (): void => {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith("cache_"),
    );
    keys.forEach((key) => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || "");
        const isExpired = Date.now() - item.timestamp > item.ttl;
        if (isExpired) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  },
};

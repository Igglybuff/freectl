// API utilities for backend communication
import type {
  SearchParams,
  SearchResponse,
  DataSource,
  Favorite,
  Settings,
  BackendSettings,
  Stats,
  AddSourceForm,
  ApiError,
} from "../types";

const API_BASE = "http://localhost:8080";

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

    searchParams.append("q", params.query);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("per_page", params.limit.toString());
    if (params.category) searchParams.append("category", params.category);
    if (params.source) searchParams.append("source", params.source);

    const backendResponse = await this.request<{
      results: Array<{
        category: string;
        description: string;
        url: string;
        name: string;
        score: number;
        source: string;
      }>;
      total_results: number;
      current_page: number;
      total_pages: number;
      per_page: number;
    }>(`/search?${searchParams}`);

    // Transform backend response to frontend format
    const transformedResults = backendResponse.results.map((result, index) => ({
      id: `${result.url}-${index}`, // Generate ID from URL and index
      title: result.name,
      description: result.description.replace(/<[^>]*>/g, ""), // Strip HTML tags
      url: result.url,
      category: result.category,
      source: result.source,
      sourceType: result.source.toLowerCase().includes("git")
        ? ("git" as const)
        : ("reddit_wiki" as const),
      isFavorite: false, // Will be set by favorites store
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Extract unique categories and filter out empty ones
    const categories = [
      ...new Set(
        backendResponse.results
          .map((r) => r.category)
          .filter((cat) => cat && cat.trim()),
      ),
    ];

    return {
      results: transformedResults,
      totalResults: backendResponse.total_results,
      currentPage: backendResponse.current_page,
      totalPages: backendResponse.total_pages,
      query: params.query,
      categories,
      executionTime: 0, // Backend doesn't provide this, set to 0
    };
  }

  // Data source endpoints
  async getSources(): Promise<{ success: boolean; sources: DataSource[] }> {
    const response = await this.request<{
      success: boolean;
      sources: Array<{
        name: string;
        path: string;
        url: string;
        enabled: boolean;
        type: string;
        size?: string;
        last_updated?: string;
      }>;
    }>("/sources/list");

    // Transform backend sources to frontend format with actual item counts
    const transformedSources = await Promise.all(
      response.sources.map(async (source) => {
        let itemCount = 0;

        // Fetch actual link count from stats endpoint
        try {
          const statsResponse = await this.request<{
            TotalLinks: number;
          }>(`/stats?source=${encodeURIComponent(source.name)}`);
          itemCount = statsResponse.TotalLinks || 0;
        } catch (error) {
          console.warn(`Failed to get stats for source ${source.name}:`, error);
          // Fallback: try to parse file size if available
          if (source.size) {
            const sizeStr = source.size;
            const numStr = sizeStr.replace(/[^0-9.]/g, "");
            const num = parseFloat(numStr) || 0;
            itemCount = Math.round(num);
          }
        }

        return {
          id: source.name,
          name: source.name,
          url: source.url,
          type: source.type as "git" | "reddit_wiki" | "hn5000",
          enabled: source.enabled,
          lastUpdated: source.last_updated || new Date().toISOString(),
          itemCount,
          status: source.enabled ? ("active" as const) : ("disabled" as const),
          description: `${source.type} source`,
          categories: [],
        };
      }),
    );

    return {
      success: response.success,
      sources: transformedSources,
    };
  }

  async addSource(
    source: AddSourceForm,
  ): Promise<{ success: boolean; message: string }> {
    // For hn5000 sources, we don't need a URL - set it to the official source
    const requestBody = {
      name: source.name,
      type: source.type,
      url:
        source.type === "hn5000"
          ? "https://refactoringenglish.com/tools/hn-popularity/"
          : source.url,
    };

    return this.request<{ success: boolean; message: string }>("/sources/add", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  }

  async updateSource(
    name: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>("/update", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deleteSource(
    name: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      "/sources/delete",
      {
        method: "POST",
        body: JSON.stringify({ name, force: false }),
      },
    );
  }

  async toggleSource(
    name: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      "/sources/toggle",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
  }

  async processAllSources(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>("/process", {
      method: "POST",
    });
  }

  // Favorites endpoints
  async getFavorites(): Promise<Favorite[]> {
    try {
      const backendFavorites = await this.request<
        Array<{
          link: string;
          name: string;
          description: string;
          category: string;
          repository: string;
        }>
      >("/favorites");

      // Transform backend format to frontend format
      return backendFavorites.map((fav, index) => ({
        id: `${fav.link}-${index}`, // Generate ID from link and index
        title: fav.name || "Untitled",
        description: fav.description || "No description",
        url: fav.link,
        category: fav.category || "Uncategorized",
        source: fav.repository || "Unknown",
        tags: [fav.category].filter(Boolean),
        addedAt: new Date().toISOString(), // Backend doesn't provide this
      }));
    } catch (error) {
      console.warn("Favorites endpoint not available, returning empty array");
      return [];
    }
  }

  async addFavorite(
    favorite: Omit<Favorite, "id" | "addedAt">,
  ): Promise<Favorite> {
    // Transform frontend format to backend format
    const backendFavorite = {
      link: favorite.url,
      name: favorite.title,
      description: favorite.description,
      category: favorite.category,
      repository: favorite.source,
    };

    const backendFavorites = await this.request<
      Array<{
        link: string;
        name: string;
        description: string;
        category: string;
        repository: string;
      }>
    >("/favorites/add", {
      method: "POST",
      body: JSON.stringify(backendFavorite),
    });

    // Return the added favorite in frontend format
    const addedFavorite = backendFavorites.find((f) => f.link === favorite.url);
    if (addedFavorite) {
      return {
        id: `${addedFavorite.link}-${Date.now()}`,
        title: addedFavorite.name,
        description: addedFavorite.description,
        url: addedFavorite.link,
        category: addedFavorite.category,
        source: addedFavorite.repository,
        tags: [addedFavorite.category].filter(Boolean),
        addedAt: new Date().toISOString(),
      };
    }

    // Fallback if not found in response
    return {
      id: `${favorite.url}-${Date.now()}`,
      ...favorite,
      addedAt: new Date().toISOString(),
    };
  }

  async removeFavorite(favoriteUrl: string): Promise<void> {
    // Backend expects the full favorite object for removal
    const backendFavorite = {
      link: favoriteUrl,
      name: "", // Backend only uses link for matching
      description: "",
      category: "",
      repository: "",
    };

    await this.request<
      Array<{
        link: string;
        name: string;
        description: string;
        category: string;
        repository: string;
      }>
    >("/favorites/remove", {
      method: "POST",
      body: JSON.stringify(backendFavorite),
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
  async getSettings(): Promise<BackendSettings> {
    return this.request<BackendSettings>("/settings");
  }

  async updateSettings(settings: any): Promise<BackendSettings> {
    return this.request<BackendSettings>("/settings", {
      method: "POST",
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
      // Get all sources first
      const sourcesResponse = await this.getSources();
      const sources = sourcesResponse.sources;

      if (sources.length === 0) {
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

      // Aggregate stats from all sources
      let totalLinks = 0;
      let totalFiles = 0;
      let totalSize = 0;
      const allCategories: { [key: string]: number } = {};
      const allDomains: { [key: string]: number } = {};
      const sourceStats: Array<{
        name: string;
        itemCount: number;
        lastUpdated: string;
        status: string;
      }> = [];

      // Fetch stats for each source
      for (const source of sources) {
        try {
          const sourceStatsResponse = await this.request<{
            TotalFiles: number;
            TotalLinks: number;
            TotalSize: number;
            Categories: Array<{ Name: string; LinkCount: number }>;
            DomainsCount: { [key: string]: number };
          }>(`/stats?source=${encodeURIComponent(source.name)}`);

          totalFiles += sourceStatsResponse.TotalFiles || 0;
          totalLinks += sourceStatsResponse.TotalLinks || 0;
          totalSize += sourceStatsResponse.TotalSize || 0;

          // Aggregate categories
          if (sourceStatsResponse.Categories) {
            sourceStatsResponse.Categories.forEach((cat) => {
              allCategories[cat.Name] =
                (allCategories[cat.Name] || 0) + cat.LinkCount;
            });
          }

          // Aggregate domains
          if (sourceStatsResponse.DomainsCount) {
            Object.entries(sourceStatsResponse.DomainsCount).forEach(
              ([domain, count]) => {
                allDomains[domain] = (allDomains[domain] || 0) + count;
              },
            );
          }

          sourceStats.push({
            name: source.name,
            itemCount: sourceStatsResponse.TotalLinks || 0,
            lastUpdated: source.lastUpdated,
            status: source.enabled ? "active" : "disabled",
          });
        } catch (sourceError) {
          console.warn(
            `Failed to get stats for source ${source.name}:`,
            sourceError,
          );
          sourceStats.push({
            name: source.name,
            itemCount: 0,
            lastUpdated: source.lastUpdated,
            status: "error",
          });
        }
      }

      // Get favorites count
      let favoritesCount = 0;
      try {
        const favorites = await this.getFavorites();
        favoritesCount = favorites.length;
      } catch (error) {
        console.warn("Failed to get favorites count:", error);
      }

      // Convert aggregated data to frontend format
      const topCategories = Object.entries(allCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      return {
        totalSources: sources.length,
        totalItems: totalLinks,
        totalFavorites: favoritesCount,
        lastUpdated: new Date().toISOString(),
        topCategories,
        sourceStats,
        searchStats: {
          totalSearches: 0, // Backend doesn't track this
          popularQueries: [], // Backend doesn't track this
        },
      };
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
    recommendedSources: Record<
      string,
      Array<{
        name: string;
        url: string;
        type: string;
        description: string;
        category: string;
        id: string;
      }>
    >;
    existingSources: string[];
  }> {
    try {
      return await this.request("/library");
    } catch (error) {
      console.warn("Library endpoint not available, returning mock data");
      return {
        recommendedSources: {},
        existingSources: [],
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
    searchParams.append("q", params.query);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("per_page", params.limit.toString());
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
    type: "git" | "reddit_wiki" | "hn5000",
  ): string | null => {
    if (type === "hn5000") {
      // HackerNews sources don't need URL validation
      return null;
    }

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

  normalizeGitUrl: (url: string, type: string): string => {
    if (type !== "git") return url;

    try {
      const urlObj = new URL(url);

      // Handle GitHub URLs
      if (urlObj.hostname === "github.com") {
        // Remove trailing slash and normalize path
        const cleanPath = urlObj.pathname.replace(/\/$/, "");

        // Add .git suffix if not present
        const gitUrl = cleanPath.endsWith(".git")
          ? `https://github.com${cleanPath}`
          : `https://github.com${cleanPath}.git`;

        return gitUrl;
      }

      // Handle GitLab URLs
      if (
        urlObj.hostname === "gitlab.com" ||
        urlObj.hostname.includes("gitlab")
      ) {
        const cleanPath = urlObj.pathname.replace(/\/$/, "");
        const gitUrl = cleanPath.endsWith(".git")
          ? `${urlObj.protocol}//${urlObj.hostname}${cleanPath}`
          : `${urlObj.protocol}//${urlObj.hostname}${cleanPath}.git`;

        return gitUrl;
      }

      // Handle other Git hosting services
      if (urlObj.hostname.includes("gitea") || url.includes(".git")) {
        const cleanPath = urlObj.pathname.replace(/\/$/, "");
        if (!cleanPath.endsWith(".git")) {
          return `${urlObj.protocol}//${urlObj.hostname}${cleanPath}.git`;
        }
      }

      return url;
    } catch {
      // If URL parsing fails, return original
      return url;
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

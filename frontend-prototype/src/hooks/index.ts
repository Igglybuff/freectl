// Custom React hooks for common functionality
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, searchUtils, handleApiError } from "../utils/api";
import {
  useSettingsStore,
  useToastStore,
  useFavoritesStore,
} from "../stores/appStore";
import type {
  SearchParams,
  SearchResponse,
  DataSource,
  Favorite,
  Stats,
} from "../types";

// Theme hook
export const useTheme = () => {
  const { settings, updateSettings } = useSettingsStore();
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const effectiveTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  useEffect(() => {
    if (effectiveTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [effectiveTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    updateSettings({ theme: newTheme });
  }, [effectiveTheme, updateSettings]);

  return {
    theme: effectiveTheme,
    toggleTheme,
    setTheme: (theme: "light" | "dark" | "system") => updateSettings({ theme }),
  };
};

// Search hook with debouncing
export const useSearch = () => {
  const { settings } = useSettingsStore();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: "",
    page: 1,
    limit: settings.resultsPerPage,
  });

  // Mock search function for now
  const mockSearch = useCallback(
    async (params: SearchParams): Promise<SearchResponse> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!params.query) {
        throw new Error("Query is required");
      }

      // Mock search results
      const mockResults = [
        {
          id: "1",
          title: `Awesome ${params.query} Library`,
          description: `A comprehensive collection of ${params.query} tools and resources for developers.`,
          url: `https://github.com/awesome/${params.query.toLowerCase()}`,
          category: "Development Tools",
          source: "awesome-lists",
          sourceType: "git" as const,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          title: `${params.query} Framework`,
          description: `Modern ${params.query} framework for building scalable applications.`,
          url: `https://github.com/framework/${params.query.toLowerCase()}`,
          category: "Frameworks",
          source: "awesome-frameworks",
          sourceType: "git" as const,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      return {
        results: mockResults,
        totalResults: mockResults.length,
        currentPage: params.page || 1,
        totalPages: 1,
        query: params.query,
        categories: ["Development Tools", "Frameworks"],
        executionTime: 150,
      };
    },
    [],
  );

  const query = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => mockSearch(searchParams),
    enabled:
      !!searchParams.query &&
      searchParams.query.length >= settings.minQueryLength,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const updateSearchParams = useCallback((updates: Partial<SearchParams>) => {
    setSearchParams((prev) => ({ ...prev, ...updates }));
  }, []);

  const validateQuery = useCallback(
    (query: string): string | null => {
      return searchUtils.validateSearchQuery(
        query,
        settings.minQueryLength,
        settings.maxQueryLength,
      );
    },
    [settings.minQueryLength, settings.maxQueryLength],
  );

  return {
    ...query,
    searchParams,
    updateSearchParams,
    validateQuery,
  };
};

// Debounced search hook
export const useDebouncedSearch = (initialQuery = "") => {
  const { settings } = useSettingsStore();
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, settings.queryDelay);

    return () => clearTimeout(timer);
  }, [query, settings.queryDelay]);

  const searchQuery = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => apiClient.search({ query: debouncedQuery }),
    enabled:
      !!debouncedQuery && debouncedQuery.length >= settings.minQueryLength,
    staleTime: 5 * 60 * 1000,
  });

  return {
    query,
    setQuery,
    debouncedQuery,
    ...searchQuery,
  };
};

// Data sources hook
export const useSources = () => {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  // Mock sources function
  const mockGetSources = useCallback(async (): Promise<DataSource[]> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [
      {
        id: "1",
        name: "Awesome Lists",
        url: "https://github.com/sindresorhus/awesome",
        type: "git",
        enabled: true,
        lastUpdated: new Date().toISOString(),
        itemCount: 1250,
        status: "active",
        description: "A curated list of awesome lists",
        categories: ["Lists", "Resources"],
      },
      {
        id: "2",
        name: "Reddit Piracy Wiki",
        url: "https://old.reddit.com/r/Piracy/wiki/megathread",
        type: "reddit_wiki",
        enabled: true,
        lastUpdated: new Date().toISOString(),
        itemCount: 340,
        status: "active",
        description: "Piracy megathread resources",
        categories: ["Media", "Tools"],
      },
    ];
  }, []);

  const sourcesQuery = useQuery({
    queryKey: ["sources"],
    queryFn: mockGetSources,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const addSourceMutation = useMutation({
    mutationFn: apiClient.addSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      addToast({
        type: "success",
        title: "Source added",
        message: "The data source has been added successfully",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to add source",
        message: handleApiError(error),
      });
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: apiClient.updateSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      addToast({
        type: "success",
        title: "Source updated",
        message: "The data source has been updated successfully",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to update source",
        message: handleApiError(error),
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: apiClient.deleteSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      addToast({
        type: "success",
        title: "Source deleted",
        message: "The data source has been deleted successfully",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to delete source",
        message: handleApiError(error),
      });
    },
  });

  return {
    ...sourcesQuery,
    addSource: addSourceMutation,
    updateSource: updateSourceMutation,
    deleteSource: deleteSourceMutation,
  };
};

// Favorites hook
export const useFavorites = () => {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const favoritesStore = useFavoritesStore();

  // Mock favorites function
  const mockGetFavorites = useCallback(async (): Promise<Favorite[]> => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return [];
  }, []);

  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: mockGetFavorites,
    staleTime: 5 * 60 * 1000,
  });

  const addFavoriteMutation = useMutation({
    mutationFn: apiClient.addFavorite,
    onSuccess: (favorite) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      favoritesStore.addFavorite(favorite.id);
      addToast({
        type: "success",
        title: "Added to favorites",
        message: favorite.title,
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to add favorite",
        message: handleApiError(error),
      });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: apiClient.removeFavorite,
    onSuccess: (_, favoriteId) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      favoritesStore.removeFavorite(favoriteId);
      addToast({
        type: "success",
        title: "Removed from favorites",
      });
    },
    onError: (error) => {
      addToast({
        type: "error",
        title: "Failed to remove favorite",
        message: handleApiError(error),
      });
    },
  });

  const toggleFavorite = useCallback(
    (item: {
      id: string;
      title: string;
      description: string;
      url: string;
      category: string;
      source: string;
    }) => {
      if (favoritesStore.isFavorite(item.id)) {
        removeFavoriteMutation.mutate(item.id);
      } else {
        addFavoriteMutation.mutate({
          title: item.title,
          description: item.description,
          url: item.url,
          category: item.category,
          source: item.source,
          tags: [item.category].filter(Boolean),
        });
      }
    },
    [favoritesStore, addFavoriteMutation, removeFavoriteMutation],
  );

  return {
    ...favoritesQuery,
    addFavorite: addFavoriteMutation,
    removeFavorite: removeFavoriteMutation,
    toggleFavorite,
    isFavorite: favoritesStore.isFavorite,
  };
};

// Stats hook
export const useStats = () => {
  const mockGetStats = useCallback(async (): Promise<Stats> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      totalSources: 2,
      totalItems: 1590,
      totalFavorites: 0,
      lastUpdated: new Date().toISOString(),
      topCategories: [
        { name: "Development Tools", count: 450 },
        { name: "Frameworks", count: 320 },
        { name: "Resources", count: 280 },
        { name: "Lists", count: 250 },
        { name: "Media", count: 200 },
      ],
      sourceStats: [
        {
          name: "Awesome Lists",
          itemCount: 1250,
          lastUpdated: new Date().toISOString(),
          status: "active",
        },
        {
          name: "Reddit Piracy Wiki",
          itemCount: 340,
          lastUpdated: new Date().toISOString(),
          status: "active",
        },
      ],
      searchStats: {
        totalSearches: 0,
        popularQueries: [],
      },
    };
  }, []);

  return useQuery({
    queryKey: ["stats"],
    queryFn: mockGetStats,
    staleTime: 5 * 60 * 1000,
  });
};

// Local storage hook
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue] as const;
};

// Debounce hook
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Previous value hook
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// Online status hook
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};

// Intersection observer hook
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {},
) => {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [node, setNode] = useState<Element | null>(null);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      options,
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, options]);

  return [setNode, entry] as const;
};

// Window size hook
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
};

// Keyboard shortcut hook
export const useKeyboardShortcut = (
  keys: string[],
  callback: () => void,
  options: { preventDefault?: boolean; stopPropagation?: boolean } = {},
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keysPressed = keys.every((key) => {
        switch (key) {
          case "ctrl":
            return event.ctrlKey;
          case "alt":
            return event.altKey;
          case "shift":
            return event.shiftKey;
          case "meta":
            return event.metaKey;
          default:
            return event.key.toLowerCase() === key.toLowerCase();
        }
      });

      if (keysPressed) {
        if (options.preventDefault) event.preventDefault();
        if (options.stopPropagation) event.stopPropagation();
        callback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [keys, callback, options]);
};

// Copy to clipboard hook
export const useClipboard = () => {
  const [copied, setCopied] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        addToast({
          type: "success",
          title: "Copied to clipboard",
          duration: 2000,
        });

        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        addToast({
          type: "error",
          title: "Failed to copy",
          message: "Unable to copy to clipboard",
        });
      }
    },
    [addToast],
  );

  return { copy, copied };
};

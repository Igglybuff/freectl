import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { TabType, Settings, AppState } from "../types";
import { apiClient } from "../utils/api";

interface AppStore extends AppState {
  // State
  currentTab: TabType;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentTab: (tab: TabType) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Initial state
      currentTab: (() => {
        const hash = window.location.hash.slice(1);
        return hash &&
          ["search", "favorites", "library", "stats", "settings"].includes(hash)
          ? (hash as TabType)
          : "search";
      })(),
      searchQuery: "",
      isLoading: false,
      error: null,

      // Actions
      setCurrentTab: (tab) => set({ currentTab: tab }, false, "setCurrentTab"),

      setSearchQuery: (query) =>
        set({ searchQuery: query }, false, "setSearchQuery"),

      setIsLoading: (loading) =>
        set({ isLoading: loading }, false, "setIsLoading"),

      setError: (error) => set({ error }, false, "setError"),

      clearError: () => set({ error: null }, false, "clearError"),
    }),
    {
      name: "app-store",
    },
  ),
);

// Settings store with persistence
interface SettingsStore {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  loadSettings: () => Promise<void>;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  theme: "system",
  minQueryLength: 2,
  maxQueryLength: 100,
  resultsPerPage: 20,
  queryDelay: 300,
  enabledSources: [],
  autoUpdateSources: true,
  notifications: {
    enabled: true,
    newSources: true,
    updates: true,
  },
  ui: {
    compactMode: false,
    showCategories: true,
    showDescriptions: true,
    animationsEnabled: true,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        settings: defaultSettings,
        isLoading: false,
        error: null,

        loadSettings: async () => {
          set({ isLoading: true, error: null });
          try {
            const backendSettings = await apiClient.getSettings();
            // Transform backend settings to frontend format
            const frontendSettings: Settings = {
              theme: get().settings.theme, // Keep current theme setting
              minQueryLength: backendSettings.minQueryLength,
              maxQueryLength: backendSettings.maxQueryLength,
              resultsPerPage: backendSettings.resultsPerPage,
              queryDelay: backendSettings.searchDelay,
              enabledSources: Array.isArray(backendSettings.sources)
                ? backendSettings.sources
                    .filter((s: any) => s.enabled)
                    .map((s: any) => s.name)
                : [],
              autoUpdateSources: backendSettings.auto_update,
              usePreprocessedSearch:
                backendSettings.usePreprocessedSearch || false,
              showScores: backendSettings.showScores || false,
              truncateTitles: backendSettings.truncateTitles || false,
              maxTitleLength: backendSettings.maxTitleLength || 100,
              customHeader: backendSettings.customHeader || "",
              minFuzzyScore: backendSettings.minFuzzyScore || 0,
              searchConcurrency: backendSettings.searchConcurrency || 1,
              cacheDir: backendSettings.cache_dir || "",
              notifications: {
                enabled: true,
                newSources: true,
                updates: true,
              },
              ui: {
                compactMode: false,
                showCategories: !backendSettings.truncateTitles,
                showDescriptions: backendSettings.showScores,
                animationsEnabled: true,
              },
            };
            set({ settings: frontendSettings, isLoading: false });
          } catch (error) {
            console.error("Failed to load settings:", error);
            set({
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load settings",
              isLoading: false,
            });
          }
        },

        updateSettings: async (updates) => {
          const currentSettings = get().settings;
          const newSettings = { ...currentSettings, ...updates };

          // Optimistically update local state
          set({ settings: newSettings, isLoading: true, error: null });

          try {
            // Get current backend settings first
            const currentBackend = await apiClient.getSettings();

            // Transform frontend settings to backend format
            const backendSettings = {
              ...currentBackend,
              minQueryLength: newSettings.minQueryLength,
              maxQueryLength: newSettings.maxQueryLength,
              resultsPerPage: newSettings.resultsPerPage,
              searchDelay: newSettings.queryDelay,
              showScores: newSettings.showScores,
              usePreprocessedSearch: newSettings.usePreprocessedSearch,
              auto_update: newSettings.autoUpdateSources,
              truncateTitles: newSettings.truncateTitles,
              maxTitleLength: newSettings.maxTitleLength,
              customHeader: newSettings.customHeader,
              minFuzzyScore: newSettings.minFuzzyScore,
              searchConcurrency: newSettings.searchConcurrency,
              cache_dir: newSettings.cacheDir,
              sources: currentBackend.sources,
            };

            await apiClient.updateSettings(backendSettings);
            set({ isLoading: false });
          } catch (error) {
            console.error("Failed to save settings:", error);
            // Revert optimistic update
            set({
              settings: currentSettings,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to save settings",
              isLoading: false,
            });
            throw error;
          }
        },

        resetSettings: () =>
          set({ settings: defaultSettings }, false, "resetSettings"),
      }),
      {
        name: "freectl-settings",
        version: 1,
      },
    ),
    {
      name: "settings-store",
    },
  ),
);

// Favorites store with persistence
interface FavoritesStore {
  favoriteUrls: Set<string>;
  addFavorite: (url: string) => void;
  removeFavorite: (url: string) => void;
  toggleFavorite: (url: string) => void;
  isFavorite: (url: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  devtools(
    persist(
      (set, get) => ({
        favoriteUrls: new Set(),

        addFavorite: (url) =>
          set(
            (state) => ({
              favoriteUrls: new Set([...state.favoriteUrls, url]),
            }),
            false,
            "addFavorite",
          ),

        removeFavorite: (url) =>
          set(
            (state) => {
              const newFavorites = new Set(state.favoriteUrls);
              newFavorites.delete(url);
              return { favoriteUrls: newFavorites };
            },
            false,
            "removeFavorite",
          ),

        toggleFavorite: (url) => {
          const { favoriteUrls, addFavorite, removeFavorite } = get();
          if (favoriteUrls.has(url)) {
            removeFavorite(url);
          } else {
            addFavorite(url);
          }
        },

        isFavorite: (url) => get().favoriteUrls.has(url),

        clearFavorites: () =>
          set({ favoriteUrls: new Set() }, false, "clearFavorites"),
      }),
      {
        name: "freectl-favorites",
        version: 1,
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              ...state,
              favoriteUrls: new Set(state.favoriteUrls || []),
            };
          },
          setItem: (name, value) => {
            const { state } = value;
            const serialized = {
              ...state,
              favoriteUrls: Array.from(state.favoriteUrls),
            };
            localStorage.setItem(name, JSON.stringify({ state: serialized }));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      },
    ),
    {
      name: "favorites-store",
    },
  ),
);

// Toast notifications store
export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>()(
  devtools(
    (set, get) => ({
      toasts: [],

      addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { ...toast, id };

        set(
          (state) => ({
            toasts: [...state.toasts, newToast],
          }),
          false,
          "addToast",
        );

        // Auto remove after duration (default 5 seconds)
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.duration || 5000);
        }

        return id;
      },

      removeToast: (id) =>
        set(
          (state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
          }),
          false,
          "removeToast",
        ),

      clearToasts: () => set({ toasts: [] }, false, "clearToasts"),
    }),
    {
      name: "toast-store",
    },
  ),
);

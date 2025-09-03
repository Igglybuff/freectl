import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TabType, Settings, AppState } from '../types';

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
      currentTab: 'search',
      searchQuery: '',
      isLoading: false,
      error: null,

      // Actions
      setCurrentTab: (tab) =>
        set({ currentTab: tab }, false, 'setCurrentTab'),

      setSearchQuery: (query) =>
        set({ searchQuery: query }, false, 'setSearchQuery'),

      setIsLoading: (loading) =>
        set({ isLoading: loading }, false, 'setIsLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      clearError: () =>
        set({ error: null }, false, 'clearError'),
    }),
    {
      name: 'app-store',
    }
  )
);

// Settings store with persistence
interface SettingsStore {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  theme: 'system',
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

        updateSettings: (updates) =>
          set(
            (state) => ({
              settings: { ...state.settings, ...updates },
            }),
            false,
            'updateSettings'
          ),

        resetSettings: () =>
          set({ settings: defaultSettings }, false, 'resetSettings'),
      }),
      {
        name: 'freectl-settings',
        version: 1,
      }
    ),
    {
      name: 'settings-store',
    }
  )
);

// Favorites store with persistence
interface FavoritesStore {
  favoriteIds: Set<string>;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  devtools(
    persist(
      (set, get) => ({
        favoriteIds: new Set(),

        addFavorite: (id) =>
          set(
            (state) => ({
              favoriteIds: new Set([...state.favoriteIds, id]),
            }),
            false,
            'addFavorite'
          ),

        removeFavorite: (id) =>
          set(
            (state) => {
              const newFavorites = new Set(state.favoriteIds);
              newFavorites.delete(id);
              return { favoriteIds: newFavorites };
            },
            false,
            'removeFavorite'
          ),

        toggleFavorite: (id) => {
          const { favoriteIds, addFavorite, removeFavorite } = get();
          if (favoriteIds.has(id)) {
            removeFavorite(id);
          } else {
            addFavorite(id);
          }
        },

        isFavorite: (id) => get().favoriteIds.has(id),

        clearFavorites: () =>
          set({ favoriteIds: new Set() }, false, 'clearFavorites'),
      }),
      {
        name: 'freectl-favorites',
        version: 1,
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              ...state,
              favoriteIds: new Set(state.favoriteIds || []),
            };
          },
          setItem: (name, value) => {
            const { state } = value;
            const serialized = {
              ...state,
              favoriteIds: Array.from(state.favoriteIds),
            };
            localStorage.setItem(name, JSON.stringify({ state: serialized }));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    {
      name: 'favorites-store',
    }
  )
);

// Toast notifications store
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
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
  addToast: (toast: Omit<Toast, 'id'>) => string;
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
          'addToast'
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
          'removeToast'
        ),

      clearToasts: () =>
        set({ toasts: [] }, false, 'clearToasts'),
    }),
    {
      name: 'toast-store',
    }
  )
);

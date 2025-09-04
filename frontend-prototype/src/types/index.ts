// Core data types based on the existing freectl backend
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  source: string;
  sourceType: "git" | "reddit_wiki";
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  query: string;
  categories: string[];
  executionTime: number;
}

export interface SearchParams {
  query: string;
  page?: number;
  limit?: number;
  category?: string;
  source?: string;
}

export interface DataSource {
  id: string;
  name: string;
  url: string;
  type: "git" | "reddit_wiki" | "hn5000";
  enabled: boolean;
  lastUpdated: string;
  itemCount: number;
  status: "active" | "updating" | "error" | "disabled";
  description: string;
  categories: string[];
}

export interface Favorite {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  source: string;
  addedAt: string;
  tags: string[];
}

export interface Settings {
  theme: "light" | "dark" | "system";
  minQueryLength: number;
  maxQueryLength: number;
  resultsPerPage: number;
  queryDelay: number;
  enabledSources: string[];
  autoUpdateSources: boolean;
  usePreprocessedSearch: boolean;
  showScores: boolean;
  truncateTitles: boolean;
  maxTitleLength: number;
  customHeader: string;
  minFuzzyScore: number;
  searchConcurrency: number;
  cacheDir: string;
  notifications: {
    enabled: boolean;
    newSources: boolean;
    updates: boolean;
  };
  ui: {
    compactMode: boolean;
    showCategories: boolean;
    showDescriptions: boolean;
    animationsEnabled: boolean;
  };
}

// Backend Settings type (matches Go struct)
export interface BackendSettings {
  minQueryLength: number;
  maxQueryLength: number;
  searchDelay: number;
  showScores: boolean;
  resultsPerPage: number;
  usePreprocessedSearch: boolean;
  cache_dir: string;
  auto_update: boolean;
  truncateTitles: boolean;
  maxTitleLength: number;
  customHeader: string;
  minFuzzyScore: number;
  searchConcurrency: number;
  sources: Array<{
    name: string;
    path: string;
    url: string;
    enabled: boolean;
    type: string;
    size?: number;
    lastUpdated?: string;
  }>;
}

export interface Stats {
  totalSources: number;
  totalItems: number;
  totalFavorites: number;
  lastUpdated: string;
  topCategories: Array<{
    name: string;
    count: number;
  }>;
  sourceStats: Array<{
    name: string;
    itemCount: number;
    lastUpdated: string;
    status: string;
  }>;
  searchStats: {
    totalSearches: number;
    popularQueries: Array<{
      query: string;
      count: number;
    }>;
  };
}

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

export interface AppState {
  currentTab: TabType;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

export type TabType = "search" | "favorites" | "library" | "stats" | "settings";

export interface ApiError {
  error: string;
  message: string;
  code?: number;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form types
export interface AddSourceForm {
  name: string;
  url: string;
  type: "git" | "reddit_wiki" | "hn5000";
  description?: string;
}

export interface UpdateSourceForm extends Partial<AddSourceForm> {
  id: string;
  enabled?: boolean;
}

// UI Component types
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

// PWA types
export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface ServiceWorkerUpdateAvailable {
  waiting: ServiceWorker;
  skipWaiting: () => void;
}

// Theme types
export type ThemeMode = "light" | "dark" | "system";

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

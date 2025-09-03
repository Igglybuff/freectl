import React, { useState } from "react";
import {
  Heart,
  Search,
  X,
  ExternalLink,
  Tag,
  Clock,
  Filter,
  Grid,
  List,
} from "lucide-react";
import { useFavorites } from "../../hooks";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import SearchResultCard from "../ui/SearchResultCard";
import { cn } from "../../utils/cn";

const FavoritesTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "alphabetical">(
    "newest",
  );

  const {
    data: favorites = [],
    isLoading,
    isError,
    error,
    removeFavorite,
    isFavorite,
  } = useFavorites();

  // Filter and sort favorites
  const filteredFavorites = React.useMemo(() => {
    if (!favorites) return [];

    let filtered = favorites.filter((favorite) => {
      const matchesSearch =
        !searchQuery ||
        favorite.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        favorite.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        !selectedCategory || favorite.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    // Sort favorites
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case "oldest":
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case "alphabetical":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [favorites, searchQuery, selectedCategory, sortBy]);

  // Get unique categories
  const categories = React.useMemo(() => {
    if (!favorites) return [];
    const uniqueCategories = [
      ...new Set(favorites.map((f) => f.category).filter(Boolean)),
    ];
    return uniqueCategories.sort();
  }, [favorites]);

  const handleRemoveFavorite = (favoriteId: string) => {
    if (removeFavorite?.mutate) {
      removeFavorite.mutate(favoriteId);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <X className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to load favorites
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {error?.message ||
            "Something went wrong while loading your favorites."}
        </p>
      </div>
    );
  }

  const hasFavorites = favorites && favorites.length > 0;
  const hasFilteredResults = filteredFavorites.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Search - Fixed at top */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30">
              <Heart className="w-3 h-3 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Favorites
              </h2>
            </div>
          </div>

          {hasFavorites && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your favorites..."
                  className="w-full pl-10 pr-10 py-2 text-base rounded-lg border transition-colors duration-200
                    bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                    placeholder-gray-500 dark:placeholder-gray-400
                    border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500
                    focus:ring-2 focus:ring-opacity-50 focus:bg-white dark:focus:bg-gray-800"
                />
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Clear search and filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filters and Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Filters */}
                <div className="flex items-center space-x-4">
                  {/* Category Filter */}
                  {categories.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All categories</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="alphabetical">A-Z</option>
                  </select>
                </div>

                {/* View Mode and Count */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {hasFilteredResults ? filteredFavorites.length : 0} of{" "}
                    {favorites?.length || 0} favorites
                  </span>

                  {/* View Mode Toggle */}
                  <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 text-sm transition-colors duration-200",
                        viewMode === "grid"
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                      )}
                      title="Grid view"
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 text-sm border-l border-gray-300 dark:border-gray-600 transition-colors duration-200",
                        viewMode === "list"
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700",
                      )}
                      title="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {!hasFavorites ? (
          <div className="h-full flex items-center justify-center p-6">
            <EmptyState
              icon={<Heart className="w-12 h-12" />}
              title="No favorites yet"
              description="Start exploring and add items to your favorites by clicking the heart icon on search results."
              action={{
                label: "Go to Search",
                onClick: () => {
                  window.location.hash = "search";
                },
              }}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-6 py-4">
            {/* Favorites List */}
            {!hasFilteredResults ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={<Search className="w-12 h-12" />}
                  title="No matching favorites"
                  description={
                    searchQuery || selectedCategory
                      ? "No favorites match your current search or filter criteria."
                      : "You don't have any favorites yet."
                  }
                  action={
                    searchQuery || selectedCategory
                      ? {
                          label: "Clear filters",
                          onClick: handleClearSearch,
                          variant: "secondary",
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid gap-4 grid-cols-1 lg:grid-cols-2"
                      : "space-y-4",
                  )}
                >
                  {filteredFavorites.map((favorite) => (
                    <SearchResultCard
                      key={favorite.id}
                      result={{
                        id: favorite.id,
                        title: favorite.title,
                        description: favorite.description,
                        url: favorite.url,
                        category: favorite.category,
                        source: favorite.source,
                        sourceType: "git", // Default, could be enhanced
                        isFavorite: true,
                        createdAt: favorite.addedAt,
                        updatedAt: favorite.addedAt,
                      }}
                      isFavorite={true}
                      onToggleFavorite={() => handleRemoveFavorite(favorite.id)}
                      compact={viewMode === "list"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesTab;

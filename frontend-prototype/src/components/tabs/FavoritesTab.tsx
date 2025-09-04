import React, { useState } from "react";
import { Heart, Search, X } from "lucide-react";
import { useFavorites } from "../../hooks";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import SearchResultCard from "../ui/SearchResultCard";

const FavoritesTab: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: favorites = [],
    isLoading,
    isError,
    error,
    removeFavorite,
  } = useFavorites();

  // Filter favorites
  const filteredFavorites = React.useMemo(() => {
    if (!favorites) return [];

    let filtered = favorites.filter((favorite) => {
      const matchesSearch =
        !searchQuery ||
        favorite.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        favorite.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });

    // Sort by newest first
    filtered.sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return filtered;
  }, [favorites, searchQuery]);

  // Get unique categories

  const handleRemoveFavorite = (favoriteUrl: string) => {
    if (removeFavorite?.mutate) {
      removeFavorite.mutate(favoriteUrl);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
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
      {/* Header - Fixed at top */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30">
            <Heart className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Your Favorites
          </h2>
        </div>

        {hasFavorites && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasFavorites ? (
          <div className="h-full flex items-center justify-center">
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
        ) : !hasFilteredResults ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<Search className="w-12 h-12" />}
              title="No matching favorites"
              description="No favorites match your search criteria."
              action={{
                label: "Clear search",
                onClick: handleClearSearch,
                variant: "secondary" as const,
              }}
            />
          </div>
        ) : (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Found {filteredFavorites.length} favorite
                {filteredFavorites.length === 1 ? "" : "s"}
                {searchQuery && (
                  <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                    searching: "{searchQuery}"
                  </span>
                )}
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-4">
              {filteredFavorites.map((favorite) => (
                <SearchResultCard
                  key={favorite.id}
                  result={{
                    id: favorite.id,
                    title: favorite.title || "Untitled",
                    description:
                      favorite.description || "No description available",
                    url: favorite.url,
                    category: favorite.category || "Uncategorized",
                    source: favorite.source || "Unknown",
                    sourceType: "git" as const,
                    isFavorite: true,
                    createdAt: favorite.addedAt,
                    updatedAt: favorite.addedAt,
                  }}
                  isFavorite={true}
                  onToggleFavorite={() => handleRemoveFavorite(favorite.url)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesTab;

import React, { useState } from "react";
import { Heart, Search, X, Filter, Star } from "lucide-react";
import { useFavorites } from "../../hooks";
import LoadingSpinner from "../ui/LoadingSpinner";
import SearchResultCard from "../ui/SearchResultCard";
import SearchInput from "../ui/SearchInput";
import {
  PageLayout,
  PageHeader,
  PageContent,
  WelcomeState,
} from "../ui/PageLayout";

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
      <PageLayout>
        <PageHeader
          icon={Heart}
          title="Your Favorites"
          subtitle="Your saved resources and tools"
          colorTheme="red"
        />
        <PageContent className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading your favorites...
            </p>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  if (isError) {
    return (
      <PageLayout>
        <PageHeader
          icon={Heart}
          title="Your Favorites"
          subtitle="Your saved resources and tools"
          colorTheme="red"
        />
        <PageContent>
          <WelcomeState
            icon={X}
            title="Failed to load favorites"
            description={
              error?.message ||
              "Something went wrong while loading your favorites. Please try again later."
            }
            colorTheme="red"
          />
        </PageContent>
      </PageLayout>
    );
  }

  const hasFavorites = favorites && favorites.length > 0;
  const hasFilteredResults = filteredFavorites.length > 0;

  return (
    <PageLayout>
      <PageHeader
        icon={Heart}
        title="Your Favorites"
        subtitle={`${favorites?.length || 0} saved items`}
        colorTheme="red"
        actions={
          hasFavorites && (
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {hasFilteredResults ? filteredFavorites.length : 0} of{" "}
                {favorites.length} shown
              </div>
            </div>
          )
        }
      />

      {hasFavorites && (
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search your favorites..."
                hasError={false}
                onClear={handleClearSearch}
                autoFocus={false}
              />
            </div>
            {searchQuery && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Filter className="w-4 h-4" />
                <span>Filtered</span>
              </div>
            )}
          </div>
        </div>
      )}

      <PageContent>
        {!hasFavorites ? (
          <WelcomeState
            icon={Star}
            title="No favorites yet"
            description="Start exploring and save your favorite tools and resources. They'll appear here for quick access."
            colorTheme="red"
            suggestions={[
              {
                label: "Start Searching",
                onClick: () => {
                  window.location.hash = "search";
                },
              },
            ]}
          />
        ) : !hasFilteredResults ? (
          <WelcomeState
            icon={Search}
            title="No matching favorites"
            description={`No favorites match "${searchQuery}". Try adjusting your search terms.`}
            colorTheme="red"
            actions={
              <button
                onClick={handleClearSearch}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg font-medium transition-colors duration-200"
              >
                Clear Search
              </button>
            }
          />
        ) : (
          <>
            {/* Enhanced Results Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50/50 to-pink-50/50 dark:from-red-900/10 dark:to-pink-900/10 rounded-xl border border-red-100/50 dark:border-red-800/30 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-red-400 to-red-500 shadow-sm shadow-red-500/25"></div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {filteredFavorites.length}
                    </span>{" "}
                    favorite{filteredFavorites.length !== 1 ? "s" : ""}
                    {searchQuery && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {" "}
                        matching "{searchQuery}"
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Sorted by newest first
                </div>
              </div>
            </div>

            {/* Enhanced Results Grid */}
            <div className="space-y-4">
              {filteredFavorites.map((favorite) => (
                <SearchResultCard
                  key={favorite.url}
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
      </PageContent>
    </PageLayout>
  );
};

export default FavoritesTab;

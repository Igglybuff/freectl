import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  X,
  ExternalLink,
  Heart,
  MoreVertical,
  Plus,
} from "lucide-react";
import { useSearch, useFavorites, useDebounce } from "../../hooks";
import { useSettingsStore } from "../../stores/appStore";
import LoadingSpinner from "../ui/LoadingSpinner";
import Pagination from "../ui/Pagination";
import CategoryFilter from "../ui/CategoryFilter";
import EmptyState from "../ui/EmptyState";
import SearchResultCard from "../ui/SearchResultCard";

const SearchTab: React.FC = () => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const { settings } = useSettingsStore();

  const debouncedQuery = useDebounce(query, settings.queryDelay);
  const { toggleFavorite, isFavorite } = useFavorites();

  const {
    data: searchResults,
    isLoading,
    isError,
    error,
    searchParams,
    updateSearchParams,
    validateQuery,
  } = useSearch();

  // Update search params when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      const validationError = validateQuery(debouncedQuery);
      if (!validationError) {
        updateSearchParams({
          query: debouncedQuery,
          page: 1,
          category: selectedCategory || undefined,
        });
      }
    }
  }, [debouncedQuery, selectedCategory, updateSearchParams, validateQuery]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handlePageChange = (page: number) => {
    updateSearchParams({ page });
  };

  const handleClearSearch = () => {
    setQuery("");
    setSelectedCategory("");
    updateSearchParams({ query: "", page: 1, category: undefined });
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    updateSearchParams({ category: category || undefined, page: 1 });
  };

  const hasResults = searchResults?.results && searchResults.results.length > 0;
  const showResults = debouncedQuery && (hasResults || !isLoading);
  const validationError = query ? validateQuery(query) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Search Input - Fixed at top */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>

          <input
            type="text"
            data-testid="search-input"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search for tools, libraries, resources..."
            className={`
              w-full pl-10 pr-10 py-2 text-base rounded-lg border transition-colors duration-200
              bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
              placeholder-gray-500 dark:placeholder-gray-400
              ${
                validationError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
              }
              focus:ring-2 focus:ring-opacity-50 focus:bg-white dark:focus:bg-gray-800
            `}
            autoFocus
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Validation Error */}
        {validationError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {validationError}
          </p>
        )}

        {/* Filters */}
        {debouncedQuery &&
          searchResults?.categories &&
          searchResults.categories.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>

                {selectedCategory && (
                  <button
                    onClick={() => handleCategoryChange("")}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {showFilters && (
                <CategoryFilter
                  categories={searchResults.categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                />
              )}
            </div>
          )}
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {/* Search Results */}
        {showResults && (
          <div className="h-full overflow-y-auto px-6 py-4">
            {isLoading && (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            )}

            {isError && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Search Error
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {error?.message ||
                    "Something went wrong while searching. Please try again."}
                </p>
              </div>
            )}

            {!isLoading && !isError && !hasResults && (
              <EmptyState
                icon={<Search className="w-12 h-12" />}
                title="No results found"
                description={`No results found for "${debouncedQuery}". Try adjusting your search terms or removing filters.`}
              />
            )}

            {!isLoading && !isError && hasResults && (
              <>
                {/* Results Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Found {searchResults.totalResults.toLocaleString()} results
                    in {searchResults.executionTime}ms
                    {selectedCategory && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {selectedCategory}
                      </span>
                    )}
                  </div>
                </div>

                {/* Results Grid */}
                <div className="space-y-4">
                  {searchResults.results.map((result) => (
                    <SearchResultCard
                      key={result.id}
                      result={result}
                      isFavorite={isFavorite(result.id)}
                      onToggleFavorite={() => toggleFavorite(result)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {searchResults.totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={searchResults.currentPage}
                      totalPages={searchResults.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Welcome State */}
        {!debouncedQuery && (
          <div className="h-full flex items-center justify-center px-6 py-4">
            <div className="text-left space-y-6 max-w-2xl">
              <div className="text-6xl">🔍</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Start searching
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Enter a search query above to find tools, libraries, and
                  resources from awesome lists.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Try searching for:
                </span>
                {[
                  "React",
                  "Python",
                  "Machine Learning",
                  "DevOps",
                  "Design",
                ].map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchTab;

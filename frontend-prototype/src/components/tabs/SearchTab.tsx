import React, { useState, useEffect } from "react";
import { Search, Filter, X } from "lucide-react";
import { useSearch, useFavorites, useDebounce } from "../../hooks";
import SearchResultCard from "../ui/SearchResultCard";
import SearchInput from "../ui/SearchInput";
import LoadingSpinner from "../ui/LoadingSpinner";
import Pagination from "../ui/Pagination";
import CategoryFilter from "../ui/CategoryFilter";
import {
  PageLayout,
  PageHeader,
  PageContent,
  WelcomeState,
} from "../ui/PageLayout";
import { useSettingsStore } from "../../stores/appStore";

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
    <PageLayout>
      <PageHeader
        icon={Search}
        title="Search"
        subtitle="Find tools, libraries, and resources from awesome lists"
        colorTheme="blue"
        actions={
          settings?.usePreprocessedSearch && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                Fast Search Enabled
              </span>
            </div>
          )
        }
      />

      {/* Search Input Section */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search for tools, libraries, resources..."
          hasError={!!validationError}
          onClear={handleClearSearch}
          autoFocus
          data-testid="search-input"
        />

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

      <PageContent>
        {/* Search Results */}
        {showResults && (
          <>
            {isLoading && (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            )}

            {isError && (
              <WelcomeState
                icon={X}
                title="Search Error"
                description={
                  error?.message ||
                  "Something went wrong while searching. Please try again."
                }
                colorTheme="red"
              />
            )}

            {!isLoading && !isError && !hasResults && (
              <WelcomeState
                icon={Search}
                title="No results found"
                description={`No results found for "${debouncedQuery}". Try adjusting your search terms or removing filters.`}
                colorTheme="blue"
              />
            )}

            {!isLoading && !isError && hasResults && (
              <>
                {/* Enhanced Results Header */}
                <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/30 backdrop-blur-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-green-500 shadow-sm shadow-green-500/25"></div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Found{" "}
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {searchResults.totalResults.toLocaleString()}
                      </span>{" "}
                      results
                      <span className="text-gray-500 dark:text-gray-400">
                        {" "}
                        in {searchResults.executionTime}ms
                      </span>
                    </div>
                    {selectedCategory && (
                      <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full border border-indigo-200/50 dark:border-indigo-700/50 shadow-sm">
                        {selectedCategory}
                      </span>
                    )}
                  </div>
                </div>

                {/* Enhanced Results Grid */}
                <div className="space-y-4">
                  {searchResults.results.map((result) => (
                    <SearchResultCard
                      key={result.id}
                      result={result}
                      isFavorite={isFavorite(result.url)}
                      onToggleFavorite={() => toggleFavorite(result)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {searchResults.totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={searchResults.currentPage}
                      totalPages={searchResults.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Enhanced Welcome State */}
        {!debouncedQuery && (
          <WelcomeState
            icon={Search}
            title="Start searching"
            description="Enter a search query above to find tools, libraries, and resources from awesome lists."
            colorTheme="blue"
            suggestions={[
              { label: "React", onClick: () => setQuery("React") },
              { label: "Python", onClick: () => setQuery("Python") },
              {
                label: "Machine Learning",
                onClick: () => setQuery("Machine Learning"),
              },
              { label: "DevOps", onClick: () => setQuery("DevOps") },
              { label: "Design", onClick: () => setQuery("Design") },
            ]}
          />
        )}
      </PageContent>
    </PageLayout>
  );
};

export default SearchTab;

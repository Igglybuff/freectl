import React from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Database,
  Zap,
  Search,
  Activity,
  Globe,
  Star,
} from "lucide-react";
import { useStats } from "../../hooks";
import LoadingSpinner from "../ui/LoadingSpinner";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatsCard,
  EnhancedCard,
  ProgressBar,
  WelcomeState,
} from "../ui/PageLayout";
import { cn } from "../../utils/cn";

const StatsTab: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useStats();

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader
          icon={BarChart3}
          title="Statistics"
          subtitle="Overview of your data sources, searches, and usage patterns"
          colorTheme="purple"
        />
        <PageContent className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading statistics...
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
          icon={BarChart3}
          title="Statistics"
          subtitle="Overview of your data sources, searches, and usage patterns"
          colorTheme="purple"
        />
        <PageContent>
          <WelcomeState
            icon={BarChart3}
            title="Failed to load statistics"
            description={
              error?.message ||
              "Something went wrong while loading statistics. Please try again later."
            }
            colorTheme="red"
          />
        </PageContent>
      </PageLayout>
    );
  }

  if (!stats) {
    return (
      <PageLayout>
        <PageHeader
          icon={BarChart3}
          title="Statistics"
          subtitle="Overview of your data sources, searches, and usage patterns"
          colorTheme="purple"
        />
        <PageContent>
          <WelcomeState
            icon={Activity}
            title="No statistics available"
            description="Start using the application to see your usage statistics and insights here."
            colorTheme="purple"
          />
        </PageContent>
      </PageLayout>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <PageLayout>
      <PageHeader
        icon={BarChart3}
        title="Statistics"
        subtitle="Overview of your data sources, searches, and usage patterns"
        colorTheme="purple"
        actions={
          <div className="flex items-center space-x-2">
            {stats?.lastUpdated && (
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Updated {formatDate(stats.lastUpdated)}
              </div>
            )}
          </div>
        }
      />

      <PageContent>
        <div className="space-y-8">
          {/* Overview Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              icon={Database}
              title="Total Sources"
              value={stats?.totalSources || 0}
              subtitle="Active data sources"
              colorTheme="blue"
            />

            <StatsCard
              icon={Zap}
              title="Total Items"
              value={stats?.totalItems?.toLocaleString() || 0}
              subtitle="Indexed resources"
              colorTheme="green"
            />

            <StatsCard
              icon={Star}
              title="Favorites"
              value={stats?.totalFavorites || 0}
              subtitle="Saved items"
              colorTheme="red"
            />

            <StatsCard
              icon={Search}
              title="Total Searches"
              value={stats?.searchStats?.totalSearches?.toLocaleString() || 0}
              subtitle="Queries performed"
              colorTheme="purple"
            />
          </div>

          {/* Enhanced Results Section */}
          {(stats?.searchStats?.totalSearches || 0) > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Search Performance */}
              <div className="lg:col-span-4">
                <EnhancedCard title="Search Performance">
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200/50 dark:border-purple-700/50 mb-4">
                        <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        N/A ms
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Average response time
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Recent Activity
                      </h4>
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No recent searches available
                        </p>
                      </div>
                    </div>
                  </div>
                </EnhancedCard>
              </div>

              {/* Top Categories Chart */}
              <div className="lg:col-span-8">
                <EnhancedCard
                  title="Top Categories"
                  subtitle={`${stats?.topCategories?.length || 0} categories with content`}
                >
                  {stats?.topCategories && stats.topCategories.length > 0 ? (
                    <div className="space-y-4">
                      {stats.topCategories
                        .slice(0, 8)
                        .map((category, index) => {
                          const maxCount = Math.max(
                            ...stats.topCategories.map((c) => c.count),
                          );

                          return (
                            <div
                              key={category.name}
                              className="flex items-center space-x-4"
                            >
                              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {category.name}
                                  </span>
                                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                    {category.count.toLocaleString()}
                                  </span>
                                </div>
                                <ProgressBar
                                  value={category.count}
                                  max={maxCount}
                                  colorTheme="purple"
                                  size="sm"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Globe className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No category data available yet
                      </p>
                    </div>
                  )}
                </EnhancedCard>
              </div>
            </div>
          )}

          {/* Popular Searches */}
          {stats?.searchStats?.popularQueries &&
            stats.searchStats.popularQueries.length > 0 && (
              <EnhancedCard
                title="Popular Search Queries"
                subtitle={`Top ${stats.searchStats.popularQueries.length} most searched terms`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {stats.searchStats.popularQueries
                    .slice(0, 10)
                    .map((query, index) => {
                      const maxCount = Math.max(
                        ...stats.searchStats.popularQueries.map((q) => q.count),
                      );

                      return (
                        <div
                          key={query.query}
                          className="flex items-center space-x-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border border-gray-200/50 dark:border-gray-600/50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center text-sm font-bold text-green-600 dark:text-green-400">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                "{query.query}"
                              </span>
                              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                                {query.count}
                              </span>
                            </div>
                            <ProgressBar
                              value={query.count}
                              max={maxCount}
                              colorTheme="green"
                              size="sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </EnhancedCard>
            )}

          {/* Source Performance Table */}
          {stats?.sourceStats && stats.sourceStats.length > 0 && (
            <EnhancedCard
              title="Data Source Performance"
              subtitle="Status and performance metrics for all configured sources"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {stats.sourceStats.map((source) => (
                      <tr
                        key={source.name}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {source.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-mono text-gray-900 dark:text-white">
                              {source.itemCount.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              items
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full",
                              source.status === "active"
                                ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-400 border border-green-200 dark:border-green-700"
                                : source.status === "error"
                                  ? "bg-gradient-to-r from-red-100 to-pink-100 text-red-800 dark:from-red-900/30 dark:to-pink-900/30 dark:text-red-400 border border-red-200 dark:border-red-700"
                                  : "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 dark:from-gray-800 dark:to-slate-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600",
                            )}
                          >
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mr-2",
                                source.status === "active"
                                  ? "bg-green-500"
                                  : source.status === "error"
                                    ? "bg-red-500"
                                    : "bg-gray-400",
                              )}
                            />
                            {source.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {formatDate(source.lastUpdated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </EnhancedCard>
          )}

          {/* Summary Footer */}
          <div className="text-center py-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400">
              <Activity className="w-4 h-4" />
              <span className="text-sm">
                Statistics automatically update as you use the application
              </span>
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
};

export default StatsTab;

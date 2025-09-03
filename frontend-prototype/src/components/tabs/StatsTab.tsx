import React from 'react';
import { BarChart3, TrendingUp, Users, Clock, Database, Zap } from 'lucide-react';
import { useStats } from '../../hooks';
import LoadingSpinner from '../ui/LoadingSpinner';
import { cn } from '../../utils/cn';

const StatsTab: React.FC = () => {
  const { data: stats, isLoading, isError, error } = useStats();

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
          <BarChart3 className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to load stats
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {error?.message || 'Something went wrong while loading statistics.'}
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
          <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Statistics
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Overview of your data sources, searches, and usage patterns.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sources</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalSources || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalItems?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Favorites</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalFavorites || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Searches</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.searchStats?.totalSearches?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Categories
          </h3>
          {stats?.topCategories && stats.topCategories.length > 0 ? (
            <div className="space-y-3">
              {stats.topCategories.slice(0, 10).map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-6">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full"
                        style={{
                          width: `${Math.max(5, (category.count / Math.max(...stats.topCategories.map(c => c.count))) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                      {category.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No category data available yet.
            </p>
          )}
        </div>

        {/* Popular Queries */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Popular Searches
          </h3>
          {stats?.searchStats?.popularQueries && stats.searchStats.popularQueries.length > 0 ? (
            <div className="space-y-3">
              {stats.searchStats.popularQueries.slice(0, 10).map((query, index) => (
                <div key={query.query} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-6">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      "{query.query}"
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 dark:bg-green-400 h-2 rounded-full"
                        style={{
                          width: `${Math.max(5, (query.count / Math.max(...stats.searchStats.popularQueries.map(q => q.count))) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                      {query.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No search data available yet.
            </p>
          )}
        </div>
      </div>

      {/* Source Stats */}
      {stats?.sourceStats && stats.sourceStats.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Source Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.sourceStats.map((source) => (
                    <tr key={source.name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {source.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {source.itemCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                          source.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : source.status === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        )}>
                          {source.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(source.lastUpdated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {stats?.lastUpdated && (
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center">
            <Clock className="w-4 h-4 mr-2" />
            Statistics last updated: {formatDate(stats.lastUpdated)}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsTab;

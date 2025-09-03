import React, { useState } from "react";
import {
  Library,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useSources } from "../../hooks";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import { cn } from "../../utils/cn";
import type { DataSource } from "../../types";

const LibraryTab: React.FC = () => {
  const [showAddSource, setShowAddSource] = useState(false);
  const {
    data: sources = [],
    isLoading,
    isError,
    error,
    addSource,
    updateSource,
    deleteSource,
  } = useSources();

  const getStatusIcon = (status: DataSource["status"]) => {
    switch (status) {
      case "active":
        return (
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        );
      case "updating":
        return (
          <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
        );
      case "error":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "disabled":
        return <Pause className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      default:
        return (
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
        );
    }
  };

  const getStatusColor = (status: DataSource["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "updating":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "disabled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

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
          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to load library
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {error?.message ||
            "Something went wrong while loading your data sources."}
        </p>
      </div>
    );
  }

  const hasSources = sources && sources.length > 0;
  const activeSources = sources?.filter((s) => s.status === "active") || [];
  const totalItems =
    sources?.reduce((sum, source) => sum + source.itemCount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
          <Library className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Data Sources
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Manage your data sources and keep them up to date.
        </p>
      </div>

      {/* Stats */}
      {hasSources && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {sources.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Sources
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {activeSources.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Active Sources
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalItems.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Items
            </div>
          </div>
        </div>
      )}

      {!hasSources ? (
        <EmptyState
          icon={<Library className="w-12 h-12" />}
          title="No data sources"
          description="Add your first data source to start searching through awesome lists and other repositories."
          action={{
            label: "Add Data Source",
            onClick: () => setShowAddSource(true),
          }}
        />
      ) : (
        <>
          {/* Add Source Button */}
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Data Sources
            </h3>
            <button
              onClick={() => setShowAddSource(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </button>
          </div>

          {/* Sources List */}
          <div className="max-w-4xl mx-auto space-y-4">
            {sources.map((source) => (
              <div
                key={source.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {source.name ||
                          source.url.split("/").pop() ||
                          "Unknown Source"}
                      </h4>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          getStatusColor(source.status),
                        )}
                      >
                        {getStatusIcon(source.status)}
                        <span className="ml-1 capitalize">{source.status}</span>
                      </span>
                    </div>

                    {/* URL */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {source.url}
                      </a>
                    </div>

                    {/* Description */}
                    {source.description && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        {source.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{source.itemCount.toLocaleString()} items</span>
                      <span>•</span>
                      <span>Updated {formatDate(source.lastUpdated)}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {source.type.replace("_", " ")}
                      </span>
                    </div>

                    {/* Categories */}
                    {source.categories && source.categories.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {source.categories.slice(0, 3).map((category) => (
                          <span
                            key={category}
                            className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {category}
                          </span>
                        ))}
                        {source.categories.length > 3 && (
                          <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                            +{source.categories.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => console.log("Toggle source:", source.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={
                        source.enabled ? "Disable source" : "Enable source"
                      }
                    >
                      {source.enabled ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => console.log("Update source:", source.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Update source"
                      disabled={source.status === "updating"}
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4",
                          source.status === "updating" && "animate-spin",
                        )}
                      />
                    </button>

                    <button
                      onClick={() => console.log("Edit source:", source.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Edit source"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => console.log("Delete source:", source.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Delete source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Source Modal Placeholder */}
      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Data Source
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This feature is coming soon! You'll be able to add GitHub
              repositories, Reddit wikis, and other data sources.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAddSource(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryTab;

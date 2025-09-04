import React, { useState, useEffect } from "react";
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
  Search,
  Filter,
  X,
  ExternalLink,
} from "lucide-react";
import { useSources } from "../../hooks";
import { apiClient, sourceUtils } from "../../utils/api";
import LoadingSpinner from "../ui/LoadingSpinner";
import EmptyState from "../ui/EmptyState";
import SearchInput from "../ui/SearchInput";
import { cn } from "../../utils/cn";
import { useToastStore } from "../../stores/appStore";

const LibraryTab: React.FC = () => {
  const [showAddSource, setShowAddSource] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"installed" | "browse">(
    "installed",
  );
  const [libraryData, setLibraryData] = useState<{
    recommendedSources: Record<
      string,
      Array<{
        name: string;
        url: string;
        type: string;
        description: string;
        category: string;
        id: string;
      }>
    >;
    existingSources: string[];
  } | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Add Source form state
  const [addSourceForm, setAddSourceForm] = useState({
    name: "",
    url: "",
    type: "git" as "git" | "reddit_wiki" | "hn5000",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<{
    name: string;
    description: string;
    url: string;
    type: string;
  } | null>(null);

  const {
    data: sources = [],
    isLoading,
    isError,
    error,
    addSource,
    updateSource,
    deleteSource,
    toggleSource,
  } = useSources();

  const addToast = useToastStore((state) => state.addToast);

  // Load library data for browse tab
  useEffect(() => {
    const loadLibraryData = async () => {
      if (activeTab === "browse") {
        setLibraryLoading(true);
        try {
          const data = await apiClient.getLibrary();
          setLibraryData(data);
        } catch (error) {
          console.error("Failed to load library data:", error);
        } finally {
          setLibraryLoading(false);
        }
      }
    };

    loadLibraryData();
  }, [activeTab]);

  // Reload library data when sources change
  useEffect(() => {
    if (activeTab === "browse" && sources.length > 0) {
      const reloadLibraryData = async () => {
        try {
          const data = await apiClient.getLibrary();
          setLibraryData(data);
        } catch (error) {
          console.error("Failed to reload library data:", error);
        }
      };
      reloadLibraryData();
    }
  }, [sources, activeTab]);

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
  // Filter sources based on search and filters
  const filteredSources = sources.filter((source) => {
    const matchesSearch =
      !searchQuery ||
      source.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !filterStatus || source.status === filterStatus;
    const matchesType = !filterType || source.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const activeSources = sources?.filter((s) => s.status === "active") || [];
  const totalItems =
    sources?.reduce((sum, source) => sum + source.itemCount, 0) || 0;

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterType("");
  };

  const handleToggleSource = async (sourceName: string) => {
    try {
      await toggleSource.mutateAsync(sourceName);
    } catch (error) {
      console.error("Failed to toggle source:", error);
    }
  };

  const handleUpdateSource = async (sourceName: string) => {
    try {
      await updateSource.mutateAsync(sourceName);
    } catch (error) {
      console.error("Failed to update source:", error);
    }
  };

  const handleDeleteSource = async (sourceName: string) => {
    if (window.confirm("Are you sure you want to delete this source?")) {
      try {
        deleteSource.mutate(sourceName);
      } catch (error) {
        console.error("Failed to delete source:", error);
      }
    }
  };

  const handleAddRecommendedSource = async (source: {
    name: string;
    url: string;
    type: string;
    description: string;
    id: string;
  }) => {
    setAddingSourceId(source.id);
    try {
      await addSource.mutateAsync({
        name: source.name,
        url: source.url,
        type: source.type as "git" | "reddit_wiki" | "hn5000",
        description: source.description,
      });
    } catch (error) {
      console.error("Failed to add recommended source:", error);
    } finally {
      setAddingSourceId(null);
    }
  };

  const validateAddSourceForm = () => {
    const errors: Record<string, string> = {};

    if (!addSourceForm.name.trim()) {
      errors.name = "Source name is required";
    }

    if (addSourceForm.type === "hn5000") {
      // HackerNews sources don't need a URL - they're fetched from the API
      if (addSourceForm.url.trim()) {
        errors.url =
          "HackerNews sources automatically fetch data - leave URL empty";
      }
    } else {
      if (!addSourceForm.url.trim()) {
        errors.url = "Source URL is required";
      } else {
        try {
          const urlObj = new URL(addSourceForm.url);
          if (addSourceForm.type === "git") {
            if (
              !urlObj.hostname.includes("github.com") &&
              !urlObj.hostname.includes("gitlab.com") &&
              !urlObj.hostname.includes("gitea.com")
            ) {
              errors.url = "Git sources must be from GitHub, GitLab, or Gitea";
            }
          } else if (addSourceForm.type === "reddit_wiki") {
            if (
              !urlObj.hostname.includes("reddit.com") ||
              !urlObj.pathname.includes("/wiki/")
            ) {
              errors.url =
                "Reddit wiki sources must be from reddit.com and include /wiki/ in the path";
            }
          }
        } catch {
          errors.url = "Please enter a valid URL";
        }
      }
    }

    return errors;
  };

  const handleAddCustomSource = async () => {
    const errors = validateAddSourceForm();
    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      try {
        // Normalize the URL before sending to backend
        const normalizedUrl = sourceUtils.normalizeGitUrl(
          addSourceForm.url,
          addSourceForm.type,
        );

        await addSource.mutateAsync({
          name: addSourceForm.name,
          url: normalizedUrl,
          type: addSourceForm.type,
          description: addSourceForm.description,
        });
        setShowAddSource(false);
        setAddSourceForm({
          name: "",
          url: "",
          type: "git",
          description: "",
        });
        setFormErrors({});
      } catch (error) {
        console.error("Failed to add custom source:", error);
      }
    }
  };

  /**
   * Opens the edit form modal with the selected source's current data
   * @param source - The source object to edit
   */
  const handleEditSource = (source: any) => {
    setEditingSource({
      name: source.name,
      description: source.description || "",
      url: source.url,
      type: source.type,
    });
  };

  /**
   * Handles form submission for editing a source
   * Currently shows an info toast as the backend API doesn't support editing yet
   * TODO: Implement actual API call when backend supports source metadata editing
   */
  const handleEditSourceSubmit = async () => {
    if (!editingSource) return;

    // Validate form
    const errors: Record<string, string> = {};

    if (!editingSource.name.trim()) {
      errors.name = "Source name is required";
    }

    if (!editingSource.url.trim() && editingSource.type !== "hn5000") {
      errors.url = "Source URL is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      // For now, show a message that this feature needs backend support
      // Once backend API supports editing source metadata, we can implement the actual update
      console.log("Would update source with:", editingSource);

      // TODO: Implement actual API call when backend supports it
      // await apiClient.editSource(editingSource.name, {
      //   name: editingSource.name,
      //   url: editingSource.url,
      //   type: editingSource.type,
      //   description: editingSource.description,
      // });

      setEditingSource(null);
      setFormErrors({});

      // Show info toast for now
      addToast({
        type: "info",
        title: "Feature coming soon",
        message:
          "Source editing will be available once backend API supports it",
      });
    } catch (error) {
      console.error("Failed to update source:", error);
      setFormErrors({ submit: "Failed to update source" });
    }
  };

  /**
   * Cancels the edit operation and closes the edit form modal
   */
  const handleCancelEdit = () => {
    setEditingSource(null);
    setFormErrors({});
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs - Fixed at top */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Library className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Data Sources
              </h2>
            </div>

            {activeTab === "installed" && hasSources && (
              <button
                onClick={() => setShowAddSource(true)}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Source
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab("installed")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                activeTab === "installed"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              Installed Sources ({sources.length})
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                activeTab === "browse"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              Browse Sources
            </button>
          </div>

          {activeTab === "installed" && hasSources && (
            <div className="space-y-3">
              {/* Search Bar */}
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search sources..."
              />

              {/* Clear Filters Button */}
              {(searchQuery || filterStatus || filterType) && (
                <div className="flex justify-end">
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    title="Clear filters"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="updating">Updating</option>
                    <option value="error">Error</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All types</option>
                  <option value="git">Git Repository</option>
                  <option value="reddit_wiki">Reddit Wiki</option>
                </select>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredSources.length} of {sources.length} sources
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {isError && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to load library
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Something went wrong while loading your data sources.
              </p>
            </div>
          </div>
        )}

        {/* Installed Sources Tab */}
        {activeTab === "installed" && !isLoading && !isError && !hasSources && (
          <div className="h-full flex items-center justify-center p-6">
            <EmptyState
              icon={<Library className="w-12 h-12" />}
              title="No data sources"
              description="Add your first data source to start searching through awesome lists and other repositories."
              action={{
                label: "Browse Sources",
                onClick: () => setActiveTab("browse"),
              }}
            />
          </div>
        )}

        {activeTab === "installed" && !isLoading && !isError && hasSources && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Stats Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Found {filteredSources.length} source
                {filteredSources.length === 1 ? "" : "s"}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="w-3 h-3 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full mr-2"></div>
                  <div className="text-sm">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {sources.length}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-1">
                      Total
                    </span>
                  </div>
                </div>
                <div className="flex items-center px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mr-2"></div>
                  <div className="text-sm">
                    <span className="font-bold text-green-700 dark:text-green-400">
                      {activeSources.length}
                    </span>
                    <span className="text-green-600 dark:text-green-500 ml-1">
                      Active
                    </span>
                  </div>
                </div>
                <div className="flex items-center px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mr-2"></div>
                  <div className="text-sm">
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      {totalItems.toLocaleString()}
                    </span>
                    <span className="text-blue-600 dark:text-blue-500 ml-1">
                      Items
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sources List */}
            {filteredSources.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No matching sources
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No sources match your current search or filter criteria.
                  </p>
                  <button
                    onClick={handleClearFilters}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSources.map((source) => (
                  <div
                    key={source.id}
                    className="group bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60 p-6 hover:border-blue-300/60 dark:hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full shadow-sm",
                                source.status === "active"
                                  ? "bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/25"
                                  : source.status === "updating"
                                    ? "bg-gradient-to-r from-blue-400 to-blue-500 animate-pulse shadow-blue-500/25"
                                    : source.status === "error"
                                      ? "bg-gradient-to-r from-red-400 to-red-500 shadow-red-500/25"
                                      : "bg-gradient-to-r from-gray-400 to-gray-500",
                              )}
                            ></div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent line-clamp-1">
                              {source.name ||
                                source.url.split("/").pop() ||
                                "Unknown Source"}
                            </h3>
                          </div>

                          <span
                            className={cn(
                              "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-sm",
                              source.status === "active"
                                ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200/50 dark:from-green-900/20 dark:to-emerald-900/20 dark:text-green-400 dark:border-green-700/50"
                                : source.status === "updating"
                                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200/50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-400 dark:border-blue-700/50"
                                  : source.status === "error"
                                    ? "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200/50 dark:from-red-900/20 dark:to-rose-900/20 dark:text-red-400 dark:border-red-700/50"
                                    : "bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700 border-gray-200/50 dark:from-gray-800 dark:to-slate-800 dark:text-gray-300 dark:border-gray-600/50",
                            )}
                          >
                            <span className="capitalize">{source.status}</span>
                          </span>
                        </div>

                        {/* URL with modern styling */}
                        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link"
                          >
                            <span className="truncate max-w-md">
                              {source.url}
                            </span>
                            <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                        </div>

                        {/* Compact Metadata Tags */}
                        <div className="flex items-center flex-wrap gap-2 text-sm mb-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium">
                            {source.itemCount > 0
                              ? source.itemCount.toLocaleString()
                              : "0"}{" "}
                            items
                          </span>

                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                            {source.type === "git"
                              ? "Git"
                              : source.type === "reddit_wiki"
                                ? "Wiki"
                                : source.type === "hn5000"
                                  ? "HN5K"
                                  : source.type}
                          </span>

                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                            updated{" "}
                            {formatDate(source.lastUpdated).split(",")[0]}
                          </span>

                          {source.categories &&
                            source.categories.length > 0 && (
                              <>
                                {source.categories
                                  .slice(0, 3)
                                  .map((category) => (
                                    <span
                                      key={category}
                                      className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-medium"
                                    >
                                      {category}
                                    </span>
                                  ))}
                                {source.categories.length > 3 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium">
                                    +{source.categories.length - 3} more
                                  </span>
                                )}
                              </>
                            )}
                        </div>
                      </div>

                      {/* Enhanced Action buttons */}
                      <div className="flex flex-col space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={() => handleToggleSource(source.name)}
                          className={cn(
                            "p-3 rounded-xl transition-all duration-200 backdrop-blur-sm border shadow-sm",
                            source.enabled
                              ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-600 dark:text-green-400 border-green-200/50 dark:border-green-700/50 hover:shadow-green-500/20"
                              : "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-gray-600/50 hover:shadow-gray-500/20",
                          )}
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
                          onClick={() => handleUpdateSource(source.name)}
                          className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200/50 dark:border-blue-700/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 backdrop-blur-sm"
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
                          onClick={() => handleEditSource(source)}
                          className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200/50 dark:border-purple-700/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 backdrop-blur-sm"
                          title="Edit source details"
                        >
                          <Settings className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSource(source.name)}
                          className="p-3 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200/50 dark:border-red-700/50 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-200 backdrop-blur-sm"
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Browse Sources Tab */}
        {activeTab === "browse" && (
          <div className="h-full overflow-y-auto">
            {libraryLoading && (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-700/50 shadow-lg mb-6">
                    <LoadingSpinner size="lg" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-3">
                    Loading Library
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                    Fetching recommended sources and curated collections...
                  </p>
                </div>
              </div>
            )}

            {!libraryLoading && libraryData && (
              <div className="p-6">
                <div>
                  <div className="mb-8 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/30 backdrop-blur-sm">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 shadow-sm shadow-blue-500/25"></div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                        Recommended Sources
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                      Browse and add popular awesome lists and other curated
                      resources to expand your data collection
                    </p>
                  </div>

                  {Object.entries(libraryData.recommendedSources).map(
                    ([category, sources]) => (
                      <div key={category} className="mb-10">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 shadow-sm shadow-indigo-500/25"></div>
                          <h4 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-purple-700 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
                            {category}
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {sources.map((source) => {
                            const isInstalled =
                              libraryData.existingSources.includes(source.name);
                            return (
                              <div
                                key={source.id}
                                className="group bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60 p-5 hover:border-blue-300/60 dark:hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 backdrop-blur-sm flex flex-col h-full"
                              >
                                <div className="flex-1 flex flex-col">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-3">
                                      <div
                                        className={cn(
                                          "w-2.5 h-2.5 rounded-full shadow-sm",
                                          isInstalled
                                            ? "bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/25"
                                            : "bg-gradient-to-r from-blue-400 to-blue-500 shadow-blue-500/25",
                                        )}
                                      ></div>
                                      <h5 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent line-clamp-2 leading-tight">
                                        {source.name}
                                      </h5>
                                    </div>

                                    {source.description && (
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-3">
                                        {source.description}
                                      </p>
                                    )}

                                    {/* URL Container */}
                                    <div className="mb-3 p-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-100/50 dark:border-blue-800/30 overflow-hidden">
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link min-w-0"
                                      >
                                        <span className="truncate flex-1 min-w-0">
                                          {source.url}
                                        </span>
                                        <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                                      </a>
                                    </div>

                                    {/* Compact Metadata Tags */}
                                    <div className="flex items-center flex-wrap gap-1.5 text-sm mb-4">
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                                        {source.type === "git"
                                          ? "Git"
                                          : source.type === "reddit_wiki"
                                            ? "Wiki"
                                            : source.type}
                                      </span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-medium">
                                        {source.category}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-end mt-auto pt-2">
                                  {isInstalled ? (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-700/50 shadow-sm text-xs font-semibold backdrop-blur-sm">
                                      <CheckCircle className="w-3 h-3 mr-1.5" />
                                      Installed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleAddRecommendedSource(source)
                                      }
                                      disabled={addingSourceId === source.id}
                                      className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white text-xs font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                    >
                                      {addingSourceId === source.id ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                                          Adding...
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3 h-3 mr-1.5" />
                                          Add Source
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {!libraryLoading && !libraryData && (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border border-red-200/50 dark:border-red-700/50 shadow-lg mb-6">
                    <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-3">
                    Failed to load library
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
                    Unable to load the recommended sources library. Please try
                    refreshing the page.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Data Source
              </h3>
              <button
                onClick={() => setShowAddSource(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCustomSource();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Name
                </label>
                <input
                  type="text"
                  value={addSourceForm.name}
                  onChange={(e) =>
                    setAddSourceForm({ ...addSourceForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a name for this source"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source URL
                </label>
                <input
                  type="url"
                  value={addSourceForm.url}
                  onChange={(e) =>
                    setAddSourceForm({ ...addSourceForm, url: e.target.value })
                  }
                  disabled={addSourceForm.type === "hn5000"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400"
                  placeholder={
                    addSourceForm.type === "hn5000"
                      ? "Automatically fetched from HackerNews API"
                      : "https://github.com/user/repo or reddit wiki URL"
                  }
                />
                {addSourceForm.type === "git" &&
                  addSourceForm.url &&
                  !addSourceForm.url.endsWith(".git") && (
                    <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                      💡 URL will be automatically normalized to include .git
                      suffix
                    </p>
                  )}
                {formErrors.url && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.url}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Type
                </label>
                <select
                  value={addSourceForm.type}
                  onChange={(e) => {
                    const newType = e.target.value as
                      | "git"
                      | "reddit_wiki"
                      | "hn5000";
                    setAddSourceForm({
                      ...addSourceForm,
                      type: newType,
                      url: newType === "hn5000" ? "" : addSourceForm.url,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="git">Git Repository</option>
                  <option value="reddit_wiki">Reddit Wiki</option>
                  <option value="hn5000">HackerNews Top 5000</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={addSourceForm.description}
                  onChange={(e) =>
                    setAddSourceForm({
                      ...addSourceForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Optional description for this source"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSource.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200 inline-flex items-center"
                >
                  {addSource.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Source
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*
        Edit Source Modal - Complete Implementation Summary:

        ✅ IMPLEMENTED FEATURES:
        - Modal form with proper styling and dark mode support
        - Form validation for required fields (name, URL)
        - All source types supported (git, reddit_wiki, hn5000)
        - Automatic URL handling for HN5000 sources
        - Git URL normalization hints
        - Form state management and error handling
        - Proper TypeScript typing
        - Toast notifications for user feedback
        - Responsive design and accessibility
        - Cancel/submit flow with proper state cleanup

        📋 CURRENT STATUS:
        - Form collects and validates all required data
        - Shows informational message about backend API status
        - Ready to integrate with backend API when available

        🔧 TODO (Backend Integration):
        - Implement PUT/PATCH endpoint for source metadata editing
        - Update apiClient.editSource() method
        - Remove info message and enable actual save functionality

        Edit Source Modal - Complete form implementation with validation and UI feedback
      */}
      {editingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Data Source
              </h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSourceSubmit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Name
                </label>
                <input
                  type="text"
                  value={editingSource.name}
                  onChange={(e) =>
                    setEditingSource({ ...editingSource, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a name for this source"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source URL
                </label>
                <input
                  type="url"
                  value={editingSource.url}
                  onChange={(e) =>
                    setEditingSource({ ...editingSource, url: e.target.value })
                  }
                  disabled={editingSource.type === "hn5000"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400"
                  placeholder={
                    editingSource.type === "hn5000"
                      ? "Automatically fetched from HackerNews API"
                      : "https://github.com/user/repo or reddit wiki URL"
                  }
                />
                {editingSource.type === "git" &&
                  editingSource.url &&
                  !editingSource.url.endsWith(".git") && (
                    <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                      💡 URL will be automatically normalized to include .git
                      suffix
                    </p>
                  )}
                {formErrors.url && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.url}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Type
                </label>
                <select
                  value={editingSource.type}
                  onChange={(e) => {
                    const newType = e.target.value as
                      | "git"
                      | "reddit_wiki"
                      | "hn5000";
                    setEditingSource({
                      ...editingSource,
                      type: newType,
                      url: newType === "hn5000" ? "" : editingSource.url,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="git">Git Repository</option>
                  <option value="reddit_wiki">Reddit Wiki</option>
                  <option value="hn5000">HackerNews Top 5000</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={editingSource.description}
                  onChange={(e) =>
                    setEditingSource({
                      ...editingSource,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Optional description for this source"
                />
              </div>

              {/* Backend API Status Info - Remove this when edit API is implemented */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Feature in Development</p>
                    <p>
                      Source editing is currently being implemented. For now,
                      you can view and modify the form, but changes won't be
                      saved until the backend API supports this feature.
                    </p>
                  </div>
                </div>
              </div>

              {formErrors.submit && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formErrors.submit}
                </p>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 inline-flex items-center"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryTab;

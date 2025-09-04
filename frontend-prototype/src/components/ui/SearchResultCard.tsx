import React, { useState } from "react";
import { ExternalLink, Heart, Copy, Plus, X, RefreshCw } from "lucide-react";
import { cn } from "../../utils/cn";
import { useSources } from "../../hooks";
import { sourceUtils } from "../../utils/api";
import type { SearchResult } from "../../types";

interface SearchResultCardProps {
  result: SearchResult;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  isFavorite,
  onToggleFavorite,
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [addSourceForm, setAddSourceForm] = useState({
    name: "",
    url: "",
    type: "git" as "git" | "reddit_wiki" | "hn5000",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { addSource } = useSources();

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Failed to copy URL:", error);
    }
  };

  const handleAddAsSource = () => {
    // Extract suggested name from URL
    const urlParts = result.url.split("/");
    const suggestedName =
      urlParts[urlParts.length - 1] ||
      urlParts[urlParts.length - 2] ||
      result.title;

    // Pre-fill form with data from search result
    setAddSourceForm({
      name: suggestedName,
      url: result.url,
      type: result.sourceType || "git",
      description: result.description,
    });

    setFormErrors({});
    setShowAddSourceModal(true);
  };

  const validateAddSourceForm = () => {
    const errors: Record<string, string> = {};

    if (!addSourceForm.name.trim()) {
      errors.name = "Source name is required";
    }

    if (addSourceForm.type === "hn5000") {
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

  const handleSubmitAddSource = async () => {
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
        setShowAddSourceModal(false);
        setAddSourceForm({
          name: "",
          url: "",
          type: "git",
          description: "",
        });
        setFormErrors({});
      } catch (error) {
        console.error("Failed to add source:", error);
      }
    }
  };

  return (
    <>
      <div
        className={cn(
          "group bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60",
          "hover:border-blue-300/60 dark:hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10",
          "transition-all duration-300 backdrop-blur-sm",
          compact ? "p-4" : "p-6",
        )}
      >
        <div className="flex items-start">
          {/* Main content */}
          <div className="flex-1 min-w-0 pr-6">
            {/* Header with title and status */}
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-green-500 shadow-sm shadow-green-500/25"></div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent line-clamp-2">
                {result.title}
              </h3>
            </div>

            {/* URL with modern styling */}
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link"
              >
                <span className="truncate">{result.url}</span>
                <ExternalLink className="w-3 h-3 ml-2 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            </div>

            {/* Description */}
            {result.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed line-clamp-3">
                {result.description}
              </p>
            )}

            {/* Compact Metadata Tags */}
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                {result.sourceType === "git"
                  ? "Git"
                  : result.sourceType === "reddit_wiki"
                    ? "Wiki"
                    : "Unknown"}
              </span>

              <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium">
                from {result.source || "Unknown"}
              </span>

              {result.category && (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-medium">
                  {result.category}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons column */}
          <div className="flex flex-col space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-3 rounded-xl transition-all duration-200 backdrop-blur-sm border shadow-sm",
                isFavorite
                  ? "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-700/50 hover:shadow-lg hover:shadow-red-500/20 opacity-100"
                  : "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-gray-600/50 hover:text-red-500 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 dark:hover:from-red-900/20 dark:hover:to-rose-900/20 hover:border-red-200/50 dark:hover:border-red-700/50 hover:shadow-lg hover:shadow-red-500/20",
              )}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </button>

            <button
              onClick={handleCopyUrl}
              className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200/50 dark:border-blue-700/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 backdrop-blur-sm"
              title={copied ? "Copied!" : "Copy URL"}
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={handleAddAsSource}
              className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200/50 dark:border-purple-700/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 backdrop-blur-sm"
              title="Add as source"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add as Data Source
              </h3>
              <button
                onClick={() => setShowAddSourceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitAddSource();
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
                  onClick={() => setShowAddSourceModal(false)}
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
    </>
  );
};

export default SearchResultCard;

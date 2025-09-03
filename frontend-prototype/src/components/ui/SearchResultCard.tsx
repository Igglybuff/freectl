import React, { useState } from "react";
import {
  ExternalLink,
  Heart,
  MoreVertical,
  Copy,
  Plus,
  Tag,
  Clock,
} from "lucide-react";
import { cn } from "../../utils/cn";
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
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

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
    // This would trigger a modal or navigation to add source
    // For now, just log the action
    console.log("Add as source:", result.url);
    setShowMenu(false);
  };

  const getSourceColor = (sourceType: string) => {
    switch (sourceType) {
      case "git":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "reddit_wiki":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={cn(
        "group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700",
        "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md",
        "transition-all duration-200",
        compact ? "p-4" : "p-6",
      )}
    >
      <div className="flex items-start justify-between">
        {/* Main content */}
        <div className="flex-1 min-w-0 pr-4">
          {/* Title and URL */}
          <div className="flex items-start space-x-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                {result.title}
              </h3>

              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link"
              >
                <span className="truncate max-w-md">{result.url}</span>
                <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            </div>

            {/* Favorite button */}
            <button
              onClick={onToggleFavorite}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 flex-shrink-0",
                isFavorite
                  ? "text-red-500 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"
                  : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30",
              )}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </button>
          </div>

          {/* Description */}
          {result.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
              {result.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center flex-wrap gap-2 text-sm">
            {/* Category */}
            {result.category && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                <Tag className="w-3 h-3 mr-1" />
                {result.category}
              </span>
            )}

            {/* Source */}
            <span
              className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                getSourceColor(result.sourceType),
              )}
            >
              {result.source}
            </span>

            {/* Updated date */}
            {result.updatedAt && (
              <span className="inline-flex items-center text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3 mr-1" />
                {formatDate(result.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                <button
                  onClick={handleCopyUrl}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copied ? "Copied!" : "Copy URL"}</span>
                </button>

                <button
                  onClick={handleAddAsSource}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add as source</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;

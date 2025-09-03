import React from "react";
import { Tag, X } from "lucide-react";
import { cn } from "../../utils/cn";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  maxVisible?: number;
  className?: string;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  maxVisible = 10,
  className,
}) => {
  const [showAll, setShowAll] = React.useState(false);

  if (!categories || categories.length === 0) return null;

  const visibleCategories = showAll
    ? categories
    : categories.slice(0, maxVisible);
  const hasMore = categories.length > maxVisible;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {visibleCategories.map((category) => (
          <button
            key={category}
            onClick={() =>
              onCategoryChange(category === selectedCategory ? "" : category)
            }
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              "border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900",
              selectedCategory === category
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500",
            )}
          >
            <Tag className="w-3 h-3 mr-1.5" />
            <span>{category}</span>
            {selectedCategory === category && <X className="w-3 h-3 ml-1.5" />}
          </button>
        ))}

        {/* Show more/less button */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200"
          >
            {showAll ? "Show less" : `+${categories.length - maxVisible} more`}
          </button>
        )}
      </div>

      {/* Selected category info */}
      {selectedCategory && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
            <Tag className="w-4 h-4 mr-2" />
            <span>
              Filtered by:{" "}
              <span className="font-medium">{selectedCategory}</span>
            </span>
          </div>
          <button
            onClick={() => onCategoryChange("")}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            title="Clear filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;

import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../utils/cn";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  hasError?: boolean;
  onClear?: () => void;
  className?: string;
  "data-testid"?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  autoFocus = false,
  hasError = false,
  onClear,
  className,
  "data-testid": testId,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>

      <input
        type="text"
        data-testid={testId}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          // Base styles
          "w-full pl-10 pr-10 py-3 text-base rounded-lg border transition-colors duration-200",
          // Background and text colors
          "bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white",
          "placeholder-gray-500 dark:placeholder-gray-400",
          // Focus styles
          "focus:ring-2 focus:ring-opacity-50 focus:bg-white dark:focus:bg-gray-800",
          // Conditional border colors
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500",
        )}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Clear search"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;

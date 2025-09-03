import React from "react";
import { cn } from "../../utils/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn("text-center py-12", className)}>
      {/* Icon */}
      {icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-6">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
          {description}
        </p>
      )}

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900",
            action.variant === "secondary"
              ? "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500"
              : "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

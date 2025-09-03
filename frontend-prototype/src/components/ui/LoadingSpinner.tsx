import React from "react";
import { cn } from "../../utils/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: "primary" | "white" | "gray";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const colorClasses = {
  primary: "text-blue-600 dark:text-blue-400",
  white: "text-white",
  gray: "text-gray-600 dark:text-gray-400",
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  className,
  color = "primary",
}) => {
  return (
    <div
      className={cn(
        "animate-spin inline-block border-2 border-current border-t-transparent rounded-full",
        sizeClasses[size],
        colorClasses[color],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;

import React from "react";
import { LucideIcon } from "lucide-react";

interface PageLayoutProps {
  children: React.ReactNode;
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  colorTheme?:
    | "blue"
    | "red"
    | "green"
    | "purple"
    | "orange"
    | "indigo"
    | "gray";
}

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

interface StatsCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  colorTheme?:
    | "blue"
    | "red"
    | "green"
    | "purple"
    | "orange"
    | "indigo"
    | "gray";
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

interface EnhancedCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

// Color theme configurations
const colorThemes = {
  blue: {
    iconBg:
      "bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleGradient:
      "from-blue-900 to-indigo-700 dark:from-blue-100 dark:to-indigo-200",
    accent: "blue-600 dark:blue-400",
  },
  red: {
    iconBg:
      "bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    titleGradient:
      "from-red-900 to-pink-700 dark:from-red-100 dark:to-pink-200",
    accent: "red-600 dark:red-400",
  },
  green: {
    iconBg:
      "bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30",
    iconColor: "text-green-600 dark:text-green-400",
    titleGradient:
      "from-green-900 to-emerald-700 dark:from-green-100 dark:to-emerald-200",
    accent: "green-600 dark:green-400",
  },
  purple: {
    iconBg:
      "bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleGradient:
      "from-purple-900 to-violet-700 dark:from-purple-100 dark:to-violet-200",
    accent: "purple-600 dark:purple-400",
  },
  orange: {
    iconBg:
      "bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    titleGradient:
      "from-orange-900 to-amber-700 dark:from-orange-100 dark:to-amber-200",
    accent: "orange-600 dark:orange-400",
  },
  indigo: {
    iconBg:
      "bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    titleGradient:
      "from-indigo-900 to-purple-700 dark:from-indigo-100 dark:to-purple-200",
    accent: "indigo-600 dark:indigo-400",
  },
  gray: {
    iconBg:
      "bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800",
    iconColor: "text-gray-600 dark:text-gray-400",
    titleGradient:
      "from-gray-900 to-slate-700 dark:from-gray-100 dark:to-slate-200",
    accent: "gray-600 dark:gray-400",
  },
};

// Main page layout wrapper
export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return <div className="h-full flex flex-col">{children}</div>;
};

// Consistent page header component
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  actions,
  colorTheme = "blue",
}) => {
  const theme = colorThemes[colorTheme];

  return (
    <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${theme.iconBg}`}
          >
            <Icon className={`w-4 h-4 ${theme.iconColor}`} />
          </div>
          <div>
            <h2
              className={`text-xl font-semibold bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-2">{actions}</div>
        )}
      </div>
    </div>
  );
};

// Scrollable content area
export const PageContent: React.FC<PageContentProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`flex-1 overflow-y-auto px-6 py-6 ${className}`}>
      {children}
    </div>
  );
};

// Enhanced stats card component
export const StatsCard: React.FC<StatsCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  colorTheme = "blue",
  trend,
}) => {
  const theme = colorThemes[colorTheme];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-xl ${theme.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}
          >
            <Icon className={`w-6 h-6 ${theme.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {title}
            </p>
            <div className="mt-1">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {trend && (
          <div
            className={`text-right text-sm font-medium ${
              trend.isPositive
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced card component for content sections
export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  title,
  subtitle,
  className = "",
  headerActions,
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}
    >
      {(title || subtitle || headerActions) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center space-x-2">{headerActions}</div>
            )}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

// Progress bar component for charts and stats
interface ProgressBarProps {
  value: number;
  max: number;
  colorTheme?:
    | "blue"
    | "red"
    | "green"
    | "purple"
    | "orange"
    | "indigo"
    | "gray";
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  colorTheme = "blue",
  size = "md",
  showValue = false,
  className = "",
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 5), 100);

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const colorClasses = {
    blue: "bg-gradient-to-r from-blue-500 to-indigo-500",
    red: "bg-gradient-to-r from-red-500 to-pink-500",
    green: "bg-gradient-to-r from-green-500 to-emerald-500",
    purple: "bg-gradient-to-r from-purple-500 to-violet-500",
    orange: "bg-gradient-to-r from-orange-500 to-amber-500",
    indigo: "bg-gradient-to-r from-indigo-500 to-purple-500",
    gray: "bg-gradient-to-r from-gray-500 to-slate-500",
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div
        className={`flex-1 bg-gray-200 dark:bg-gray-700 rounded-full ${sizeClasses[size]} overflow-hidden`}
      >
        <div
          className={`${sizeClasses[size]} rounded-full ${colorClasses[colorTheme]} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium min-w-8 text-right">
          {value}
        </span>
      )}
    </div>
  );
};

// Welcome/Empty state component for consistent empty states
interface WelcomeStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
  suggestions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  colorTheme?:
    | "blue"
    | "red"
    | "green"
    | "purple"
    | "orange"
    | "indigo"
    | "gray";
}

export const WelcomeState: React.FC<WelcomeStateProps> = ({
  icon: Icon,
  title,
  description,
  actions,
  suggestions,
  colorTheme = "blue",
}) => {
  const theme = colorThemes[colorTheme];

  return (
    <div className="h-full flex items-center justify-center px-6 py-6">
      <div className="text-center space-y-8 max-w-2xl">
        <div
          className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl ${theme.iconBg} shadow-lg`}
        >
          <Icon className={`w-12 h-12 ${theme.iconColor}`} />
        </div>

        <div>
          <h3
            className={`text-2xl font-bold bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent mb-3`}
          >
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
            {description}
          </p>
        </div>

        {actions && (
          <div className="flex flex-col items-center gap-4">{actions}</div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Quick actions:
            </span>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={suggestion.onClick}
                  className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-gray-200/50 dark:border-gray-600/50"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

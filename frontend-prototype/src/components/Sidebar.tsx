import React from "react";
import {
  Search,
  Heart,
  Library,
  BarChart3,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  Github,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import type { TabType } from "../types";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  {
    id: "search",
    label: "Search",
    icon: <Search className="w-5 h-5" />,
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: <Heart className="w-5 h-5" />,
  },
  {
    id: "library",
    label: "Library",
    icon: <Library className="w-5 h-5" />,
  },
  {
    id: "stats",
    label: "Stats",
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="w-5 h-5" />,
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  theme: string;
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
}) => {
  const { currentTab, setCurrentTab } = useAppStore();

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out z-40 flex flex-col
        ${isCollapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">f</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                freectl
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5">
                find cool stuff
              </p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-xs">f</span>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <Menu className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-0.5">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative group">
              <button
                onClick={() => setCurrentTab(tab.id)}
                className={`
                  w-full flex items-center px-2 py-2 text-sm font-medium rounded
                  transition-all duration-200 relative
                  ${
                    currentTab === tab.id
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
                  }
                  ${isCollapsed ? "justify-center" : "justify-start"}
                `}
              >
                <span className="flex-shrink-0">{tab.icon}</span>

                {!isCollapsed && (
                  <span className="ml-2 truncate text-sm">{tab.label}</span>
                )}

                {/* Active indicator for collapsed state */}
                {isCollapsed && currentTab === tab.id && (
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full"></div>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                  {tab.label}
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-1 h-1 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom Controls */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <div className="space-y-0.5">
          {/* GitHub Link */}
          <a
            href="https://github.com/Igglybuff/freectl"
            target="_blank"
            rel="noopener noreferrer"
            className={`
              w-full flex items-center px-2 py-2 text-sm font-medium rounded
              text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white
              transition-colors duration-200 group
              ${isCollapsed ? "justify-center" : "justify-start"}
            `}
            title="View on GitHub"
          >
            <Github className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="ml-2 truncate text-sm">GitHub</span>
            )}

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                GitHub
                <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-1 h-1 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </a>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className={`
              w-full flex items-center px-2 py-2 text-sm font-medium rounded
              text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white
              transition-colors duration-200 group relative
              ${isCollapsed ? "justify-center" : "justify-start"}
            `}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Sun className="w-5 h-5 flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span className="ml-2 truncate text-sm">
                {theme === "light" ? "Dark" : "Light"} mode
              </span>
            )}

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                {theme === "light" ? "Dark" : "Light"} mode
                <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-1 h-1 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

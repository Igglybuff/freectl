import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  RotateCcw,
  Moon,
  Sun,
  Monitor,
  Zap,
  Layout,
  AlertTriangle,
  Beaker,
  Play,
  RefreshCw,
} from "lucide-react";
import { useTheme, useDebounce, useCustomHeader } from "../../hooks";
import { useSettingsStore, useToastStore } from "../../stores/appStore";
import { apiClient } from "../../utils/api";
import { cn } from "../../utils/cn";
import {
  PageLayout,
  PageHeader,
  PageContent,
  EnhancedCard,
} from "../ui/PageLayout";

const SettingsTab: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const {
    settings,
    updateSettings,
    resetSettings,
    loadSettings,
    isLoading,
    error,
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState("appearance");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const { customHeader, setLocalHeader } = useCustomHeader();

  // Debounce custom header updates
  const debouncedCustomHeader = useDebounce(customHeader, 500);

  // Load settings from API on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update backend settings when debounced value changes
  useEffect(() => {
    if (
      debouncedCustomHeader !== settings.customHeader &&
      settings.customHeader !== undefined
    ) {
      updateSettings({ customHeader: debouncedCustomHeader });
    }
  }, [debouncedCustomHeader, settings.customHeader, updateSettings]);

  const handleSettingChange = async (key: string, value: any) => {
    try {
      // Store current scroll position
      const scrollTop = scrollContainerRef.current?.scrollTop || 0;

      await updateSettings({ [key]: value });

      // Restore scroll position after state update
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollTop;
        }
      });
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  };

  const handleResetSettings = () => {
    if (
      confirm(
        "Are you sure you want to reset all settings to defaults? This cannot be undone.",
      )
    ) {
      resetSettings();
      // Settings are auto-saved
    }
  };

  const handleProcessAllSources = async () => {
    setIsProcessing(true);
    setProcessingStatus("Initializing processing...");

    addToast({
      type: "info",
      title: "Processing Started",
      message: "Data source processing has been initiated...",
    });

    try {
      const response = await apiClient.processAllSources();

      if (response.success) {
        setProcessingStatus("Processing completed successfully!");
        setTimeout(() => setProcessingStatus(""), 3000);

        addToast({
          type: "success",
          title: "Processing Complete",
          message: "All data sources have been processed successfully!",
        });
      } else {
        setProcessingStatus("Processing failed: " + response.message);
        setTimeout(() => setProcessingStatus(""), 5000);

        addToast({
          type: "error",
          title: "Processing Failed",
          message: response.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Processing error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setProcessingStatus("Processing failed: " + errorMessage);
      setTimeout(() => setProcessingStatus(""), 5000);

      addToast({
        type: "error",
        title: "Processing Error",
        message: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const settingSections = [
    { id: "appearance", label: "Appearance", icon: Layout },
    { id: "search", label: "Search", icon: Zap },
    { id: "advanced", label: "Advanced", icon: Settings },
    { id: "experimental", label: "Experimental", icon: Beaker },
  ];

  return (
    <PageLayout>
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Configure your preferences and customize the application"
        colorTheme="gray"
      />

      <PageContent>
        <div className="flex overflow-hidden h-full">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  Loading settings...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400 mb-2">
                  Failed to load settings
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {error}
                </p>
                <button
                  onClick={() => loadSettings()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Settings Navigation */}
              <div className="w-64 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-4">
                  <nav className="space-y-1">
                    {settingSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group",
                          activeSection === section.id
                            ? "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-900 dark:text-white shadow-sm border border-gray-300 dark:border-gray-500"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
                        )}
                      >
                        <section.icon className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform duration-200" />
                        {section.label}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Settings Content */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6"
              >
                {activeSection === "appearance" && (
                  <div className="max-w-2xl space-y-6">
                    <EnhancedCard
                      title="Appearance"
                      subtitle="Customize the look and feel of the application"
                    >
                      {/* Theme Selection */}
                      <div className="space-y-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                          Theme
                        </label>
                        <div className="grid grid-cols-3 gap-3 max-w-md">
                          {[
                            { value: "light", label: "Light", icon: Sun },
                            { value: "dark", label: "Dark", icon: Moon },
                            { value: "system", label: "System", icon: Monitor },
                          ].map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              onClick={() => setTheme(value as any)}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center space-y-2 hover:shadow-md",
                                theme === value
                                  ? "border-gray-500 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-900 dark:text-white shadow-md"
                                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                              )}
                            >
                              <Icon className="w-6 h-6" />
                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Custom Header"
                      subtitle="Personalize your header text"
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Header Text
                          </label>
                          <input
                            type="text"
                            value={customHeader}
                            onChange={(e) => setLocalHeader(e.target.value)}
                            placeholder="find cool stuff"
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Custom header text to display at the top of the page
                          </p>
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Interface Options"
                      subtitle="Additional customization features"
                    >
                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
                        <div className="flex items-start space-x-3">
                          <Layout className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                              Coming Soon!
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              More interface customization options: compact
                              mode, animations, and layout options.
                            </p>
                          </div>
                        </div>
                      </div>
                    </EnhancedCard>
                  </div>
                )}

                {activeSection === "search" && (
                  <div className="max-w-2xl space-y-6">
                    <EnhancedCard
                      title="Search Configuration"
                      subtitle="Configure search behavior and performance"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Minimum query length:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={settings.minQueryLength}
                            onChange={(e) =>
                              handleSettingChange(
                                "minQueryLength",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Minimum number of characters required for a search
                            query
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Maximum query length:
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="10000"
                            value={settings.maxQueryLength}
                            onChange={(e) =>
                              handleSettingChange(
                                "maxQueryLength",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Maximum number of characters allowed in a search
                            query
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Search delay (ms):
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="2000"
                            step="100"
                            value={settings.queryDelay}
                            onChange={(e) =>
                              handleSettingChange(
                                "queryDelay",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Delay before performing search after typing
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Results per page:
                          </label>
                          <select
                            value={settings.resultsPerPage}
                            onChange={(e) =>
                              handleSettingChange(
                                "resultsPerPage",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Number of search results to display per page
                          </p>
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Performance"
                      subtitle="Optimize search performance and concurrency"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Search concurrency:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={settings.searchConcurrency || 1}
                            onChange={(e) =>
                              handleSettingChange(
                                "searchConcurrency",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Number of sources to search simultaneously. Higher
                            values may improve performance on multi-core
                            systems.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={settings.usePreprocessedSearch || false}
                              onChange={(e) =>
                                handleSettingChange(
                                  "usePreprocessedSearch",
                                  e.target.checked,
                                )
                              }
                              className="mt-1 w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Use preprocessed search
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Use preprocessed search data for faster results.
                                Requires running 'freectl process' first.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Display Options"
                      subtitle="Customize how search results are displayed"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={settings.showScores || false}
                            onChange={(e) =>
                              handleSettingChange(
                                "showScores",
                                e.target.checked,
                              )
                            }
                            className="mt-1 w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Show scores
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Display relevance scores for search results
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={settings.truncateTitles || false}
                            onChange={(e) =>
                              handleSettingChange(
                                "truncateTitles",
                                e.target.checked,
                              )
                            }
                            className="mt-1 w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Truncate long titles
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Truncate long link titles to improve readability
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Maximum title length:
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="500"
                            value={settings.maxTitleLength || 100}
                            onChange={(e) =>
                              handleSettingChange(
                                "maxTitleLength",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Maximum number of characters to show in link titles
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Minimum fuzzy score:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={settings.minFuzzyScore || 0}
                            onChange={(e) =>
                              handleSettingChange(
                                "minFuzzyScore",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Lower values allow more lenient matches. Higher
                            values require more exact matches.
                          </p>
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Data Sources"
                      subtitle="Configure data source behavior and caching"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Cache directory:
                          </label>
                          <input
                            type="text"
                            value={settings.cacheDir || ""}
                            onChange={(e) =>
                              handleSettingChange("cacheDir", e.target.value)
                            }
                            placeholder="/Users/username/.local/cache/freectl"
                            className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors duration-200"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Directory where data sources are cached
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              checked={settings.autoUpdateSources || false}
                              onChange={(e) =>
                                handleSettingChange(
                                  "autoUpdateSources",
                                  e.target.checked,
                                )
                              }
                              className="mt-1 w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Auto update
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Automatically update the cache when it's older
                                than a week
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </EnhancedCard>
                  </div>
                )}

                {activeSection === "advanced" && (
                  <div className="max-w-2xl space-y-6">
                    <EnhancedCard
                      title="Danger Zone"
                      subtitle="Advanced operations that cannot be undone"
                    >
                      <div className="p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-700">
                        <div className="flex items-start space-x-4">
                          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                              Reset All Settings
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                              This will reset all settings to their default
                              values. This action cannot be undone.
                            </p>
                            <button
                              onClick={handleResetSettings}
                              className="inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset All Settings
                            </button>
                          </div>
                        </div>
                      </div>
                    </EnhancedCard>
                  </div>
                )}

                {activeSection === "experimental" && (
                  <div className="max-w-2xl space-y-6">
                    <EnhancedCard
                      title="Data Processing"
                      subtitle="Experimental preprocessing and indexing features"
                    >
                      <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                        <div className="flex items-start space-x-4">
                          <Beaker className="w-6 h-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                              Data Source Processing
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                              Process all enabled data sources to extract and
                              index their content. This operation analyzes
                              markdown files, extracts links, and creates
                              searchable indexes for better search performance.
                            </p>

                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3 mb-4">
                              <strong>⚠️ Experimental:</strong> This feature
                              uses advanced preprocessing algorithms to parse
                              and index content. Processing time varies based on
                              source size and may take several minutes for large
                              repositories.
                            </div>

                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                              <strong className="text-gray-900 dark:text-gray-100">
                                Processing includes:
                              </strong>
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>
                                  Markdown file analysis and link extraction
                                </li>
                                <li>
                                  Content categorization and metadata enrichment
                                </li>
                                <li>Duplicate detection and deduplication</li>
                                <li>
                                  Search index generation for improved
                                  performance
                                </li>
                                <li>URL validation and normalization</li>
                              </ul>
                            </div>

                            {processingStatus && (
                              <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    processingStatus.includes("success")
                                      ? "text-green-600 dark:text-green-400"
                                      : processingStatus.includes("failed")
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-blue-600 dark:text-blue-400",
                                  )}
                                >
                                  {processingStatus}
                                </p>
                              </div>
                            )}

                            <button
                              onClick={handleProcessAllSources}
                              disabled={isProcessing}
                              className={cn(
                                "inline-flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                                isProcessing
                                  ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40",
                              )}
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Process All Sources
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </EnhancedCard>

                    <EnhancedCard
                      title="Coming Soon"
                      subtitle="Future experimental features in development"
                    >
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800 mb-4">
                          <Beaker className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          More Experimental Features
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                          Advanced search indexing, AI-powered categorization,
                          and content analysis tools will be available here
                          soon.
                        </p>
                      </div>
                    </EnhancedCard>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PageContent>

      {/* Auto-save indicator */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-medium">Settings are automatically saved</span>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsTab;

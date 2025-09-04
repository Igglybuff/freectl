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
              <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-4">
                  <nav className="space-y-1">
                    {settingSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                          activeSection === section.id
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                        )}
                      >
                        <section.icon className="w-4 h-4 mr-3" />
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
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Appearance
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Customize the look and feel of the application
                      </p>
                    </div>

                    {/* Theme Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-3">
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
                              "p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center space-y-2",
                              theme === value
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300",
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Header */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Custom Header
                      </h4>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Header Text
                        </label>
                        <input
                          type="text"
                          value={customHeader}
                          onChange={(e) => setLocalHeader(e.target.value)}
                          placeholder="find cool stuff"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Custom header text to display at the top of the page
                        </p>
                      </div>
                    </div>

                    {/* UI Preferences Coming Soon */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Additional Interface Options
                      </h4>

                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          💡 More interface customization options are coming
                          soon! Compact mode, animations, and layout options.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "search" && (
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Search Settings
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Configure search behavior and performance
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Minimum number of characters required for a search
                          query
                        </p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Maximum number of characters allowed in a search query
                        </p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Delay before performing search after typing
                        </p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Number of search results to display per page
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Number of sources to search simultaneously. Higher
                          values may improve performance on multi-core systems.
                        </p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={settings.usePreprocessedSearch || false}
                          onChange={(e) =>
                            handleSettingChange(
                              "usePreprocessedSearch",
                              e.target.checked,
                            )
                          }
                          className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <div>
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

                    {/* Display Options Section */}
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Display options
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={settings.showScores || false}
                            onChange={(e) =>
                              handleSettingChange(
                                "showScores",
                                e.target.checked,
                              )
                            }
                            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={settings.truncateTitles || false}
                            onChange={(e) =>
                              handleSettingChange(
                                "truncateTitles",
                                e.target.checked,
                              )
                            }
                            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Maximum number of characters to show in link titles
                          </p>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Lower values allow more lenient matches. Higher
                            values require more exact matches.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Data Source Settings Section */}
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Data source settings
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Cache directory:
                          </label>
                          <input
                            type="text"
                            value={settings.cacheDir || ""}
                            onChange={(e) =>
                              handleSettingChange("cacheDir", e.target.value)
                            }
                            placeholder="/Users/username/.local/cache/freectl"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Directory where data sources are cached
                          </p>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={settings.autoUpdateSources || false}
                            onChange={(e) =>
                              handleSettingChange(
                                "autoUpdateSources",
                                e.target.checked,
                              )
                            }
                            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <div>
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
                  </div>
                )}

                {activeSection === "advanced" && (
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Advanced Settings
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Advanced configuration options
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                              Reset Settings
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                              This will reset all settings to their default
                              values. This action cannot be undone.
                            </p>
                            <button
                              onClick={handleResetSettings}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors duration-200"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset All Settings
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "experimental" && (
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Experimental Features
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        These features are experimental and may not work as
                        expected
                      </p>
                    </div>

                    {/* Data Processing Section */}
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start space-x-3">
                          <Beaker className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                              Data Source Processing
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                              Process all enabled data sources to extract and
                              index their content. This operation analyzes
                              markdown files, extracts links, and creates
                              searchable indexes for better search performance.
                            </p>

                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded p-2 mb-4">
                              <strong>⚠️ Experimental:</strong> This feature
                              uses advanced preprocessing algorithms to parse
                              and index content. Processing time varies based on
                              source size and may take several minutes for large
                              repositories.
                            </div>

                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                              <strong>Processing includes:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1">
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
                              <div className="mb-3 p-2 bg-white dark:bg-gray-800 rounded border">
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
                                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
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

                      {/* Additional Experimental Features Placeholder */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-center">
                          <Beaker className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            More Experimental Features Coming Soon
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Advanced search indexing, AI-powered categorization,
                            and content analysis tools will be available here
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PageContent>

      {/* Auto-save indicator */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💾 Settings are automatically saved
        </p>
      </div>
    </PageLayout>
  );
};

export default SettingsTab;

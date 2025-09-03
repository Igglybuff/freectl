import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Moon, Sun, Monitor, Bell, BellOff, Zap, Layout } from 'lucide-react';
import { useTheme } from '../../hooks';
import { useSettingsStore } from '../../stores/appStore';
import { cn } from '../../utils/cn';

const SettingsTab: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSettingChange = (key: string, value: any) => {
    updateSettings({ [key]: value });
    setHasUnsavedChanges(false); // Auto-save in this implementation
  };

  const handleNestedSettingChange = (parentKey: string, childKey: string, value: any) => {
    updateSettings({
      [parentKey]: {
        ...settings[parentKey as keyof typeof settings],
        [childKey]: value,
      },
    });
    setHasUnsavedChanges(false);
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetSettings();
      setHasUnsavedChanges(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <Settings className="w-8 h-8 text-gray-600 dark:text-gray-400" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Customize your freectl experience and manage your preferences.
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Layout className="w-5 h-5 mr-2" />
            Appearance
          </h3>

          <div className="space-y-4">
            {/* Theme Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-3">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value as any)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center space-y-2',
                      theme === value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* UI Preferences */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Interface Options
              </h4>

              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Compact mode</span>
                  <input
                    type="checkbox"
                    checked={settings.ui.compactMode}
                    onChange={(e) => handleNestedSettingChange('ui', 'compactMode', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Show categories in results</span>
                  <input
                    type="checkbox"
                    checked={settings.ui.showCategories}
                    onChange={(e) => handleNestedSettingChange('ui', 'showCategories', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Show descriptions in results</span>
                  <input
                    type="checkbox"
                    checked={settings.ui.showDescriptions}
                    onChange={(e) => handleNestedSettingChange('ui', 'showDescriptions', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Enable animations</span>
                  <input
                    type="checkbox"
                    checked={settings.ui.animationsEnabled}
                    onChange={(e) => handleNestedSettingChange('ui', 'animationsEnabled', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Search Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Search Settings
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Min Query Length */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Minimum query length
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.minQueryLength}
                  onChange={(e) => handleSettingChange('minQueryLength', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum characters required before search starts
                </p>
              </div>

              {/* Max Query Length */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Maximum query length
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={settings.maxQueryLength}
                  onChange={(e) => handleSettingChange('maxQueryLength', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum characters allowed in search query
                </p>
              </div>

              {/* Results Per Page */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Results per page
                </label>
                <select
                  value={settings.resultsPerPage}
                  onChange={(e) => handleSettingChange('resultsPerPage', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                  <option value={100}>100 results</option>
                </select>
              </div>

              {/* Query Delay */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Search delay (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="100"
                  value={settings.queryDelay}
                  onChange={(e) => handleSettingChange('queryDelay', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Delay before search starts after typing stops
                </p>
              </div>
            </div>

            {/* Auto Update Sources */}
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-update sources
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically update data sources in the background
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoUpdateSources}
                onChange={(e) => handleSettingChange('autoUpdateSources', e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Notifications
          </h3>

          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable notifications
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Allow the app to show notifications
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.enabled}
                onChange={(e) => handleNestedSettingChange('notifications', 'enabled', e.target.checked)}
                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

            {settings.notifications.enabled && (
              <div className="ml-4 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">New sources added</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newSources}
                    onChange={(e) => handleNestedSettingChange('notifications', 'newSources', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Source updates completed</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.updates}
                    onChange={(e) => handleNestedSettingChange('notifications', 'updates', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Reset Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Reset Settings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Reset all settings to their default values. This cannot be undone.
          </p>
          <button
            onClick={handleResetSettings}
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Auto-save indicator */}
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💾 Settings are automatically saved
        </p>
      </div>
    </div>
  );
};

export default SettingsTab;

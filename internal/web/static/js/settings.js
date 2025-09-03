import { showToast } from "./ui.js";
import { updateHeaderText } from "./ui.js";

let currentSettings = null;

// Initialize current settings with defaults
export function loadSettings() {
  return fetch("/settings")
    .then((response) => response.json())
    .then((settings) => {
      // Ensure we have valid settings before updating the UI
      if (!settings) {
        throw new Error("No settings received from server");
      }

      // Set default values for any undefined settings
      const defaults = {
        minQueryLength: 2,
        maxQueryLength: 1000,
        searchDelay: 300,
        showScores: true,
        resultsPerPage: 10,
        usePreprocessedSearch: false,
        autoUpdate: true,
        truncateTitles: true,
        maxTitleLength: 100,
        customHeader: "find cool stuff",
        minFuzzyScore: 0,
        searchConcurrency: 1,
      };

      // Merge settings with defaults
      settings = { ...defaults, ...settings };

      // Update UI with settings
      document.getElementById("minQueryLength").value = settings.minQueryLength;
      document.getElementById("maxQueryLength").value = settings.maxQueryLength;
      document.getElementById("searchDelay").value = settings.searchDelay;
      document.getElementById("showScores").checked = settings.showScores;
      document.getElementById("resultsPerPage").value = settings.resultsPerPage;
      document.getElementById("usePreprocessedSearch").checked =
        settings.usePreprocessedSearch;
      document.getElementById("cacheDir").value = settings.cache_dir;
      document.getElementById("autoUpdate").checked = settings.autoUpdate;
      document.getElementById("truncateTitles").checked =
        settings.truncateTitles;
      document.getElementById("maxTitleLength").value = settings.maxTitleLength;
      document.getElementById("customHeader").value = settings.customHeader;
      document.getElementById("minFuzzyScore").value = settings.minFuzzyScore;
      document.getElementById("searchConcurrency").value =
        settings.searchConcurrency;
      updateHeaderText(settings.customHeader);
      currentSettings = settings;
      return settings;
    })
    .catch((error) => {
      console.error("Error loading settings:", error);
      showToast("Failed to load settings", "error");
      throw error;
    });
}

// Save settings
export function saveSettings() {
  // Get current settings to preserve sources
  const existingSettings = getCurrentSettings();
  if (!existingSettings) {
    showToast("Failed to save settings: No current settings found", "error");
    return Promise.reject(new Error("No current settings found"));
  }

  const settings = {
    minQueryLength: parseInt(document.getElementById("minQueryLength").value),
    maxQueryLength: parseInt(document.getElementById("maxQueryLength").value),
    searchDelay: parseInt(document.getElementById("searchDelay").value),
    showScores: document.getElementById("showScores").checked,
    resultsPerPage: parseInt(document.getElementById("resultsPerPage").value),
    usePreprocessedSearch: document.getElementById("usePreprocessedSearch")
      .checked,
    cache_dir: document.getElementById("cacheDir").value,
    autoUpdate: document.getElementById("autoUpdate").checked,
    truncateTitles: document.getElementById("truncateTitles").checked,
    maxTitleLength: parseInt(document.getElementById("maxTitleLength").value),
    customHeader: document.getElementById("customHeader").value,
    minFuzzyScore: parseInt(document.getElementById("minFuzzyScore").value),
    searchConcurrency: parseInt(
      document.getElementById("searchConcurrency").value,
    ),
    sources: existingSettings.sources || [], // Preserve the sources array
  };

  return fetch("/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  })
    .then((response) => response.json())
    .then((savedSettings) => {
      currentSettings = savedSettings; // This updates the module-level variable
      updateHeaderText(savedSettings.customHeader);
      showToast("Settings saved successfully");
      return savedSettings;
    })
    .catch((error) => {
      console.error("Error saving settings:", error);
      showToast("Failed to save settings", "error");
      throw error;
    });
}

// Reset settings
export function resetSettings() {
  fetch("/settings")
    .then((response) => response.json())
    .then((settings) => {
      // Update UI with current settings
      document.getElementById("minQueryLength").value = settings.minQueryLength;
      document.getElementById("maxQueryLength").value = settings.maxQueryLength;
      document.getElementById("searchDelay").value = settings.searchDelay;
      document.getElementById("showScores").checked = settings.showScores;
      document.getElementById("resultsPerPage").value = settings.resultsPerPage;
      document.getElementById("usePreprocessedSearch").checked =
        settings.usePreprocessedSearch;
      document.getElementById("cacheDir").value = settings.cache_dir;
      document.getElementById("autoUpdate").checked = settings.autoUpdate;
      document.getElementById("truncateTitles").checked =
        settings.truncateTitles;
      document.getElementById("maxTitleLength").value = settings.maxTitleLength;
      document.getElementById("customHeader").value = settings.customHeader;
      document.getElementById("minFuzzyScore").value = settings.minFuzzyScore;
      document.getElementById("searchConcurrency").value =
        settings.searchConcurrency;
      updateHeaderText(settings.customHeader);

      // Save current settings
      fetch("/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })
        .then((response) => response.json())
        .then((savedSettings) => {
          currentSettings = savedSettings;
          showToast("Settings reset to defaults");
        })
        .catch((error) => {
          console.error("Error saving default settings:", error);
          showToast("Failed to save default settings", "error");
        });
    })
    .catch((error) => {
      console.error("Error resetting settings:", error);
      showToast("Failed to reset settings", "error");
    });
}

// Get current settings
export function getCurrentSettings() {
  return currentSettings;
}

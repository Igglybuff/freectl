package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"freectl/internal/config"

	"github.com/charmbracelet/log"
)

// RepositoryState represents the state of a cached repository
type RepositoryState struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
}

// Settings represents the user settings
type Settings struct {
	MinQueryLength int               `json:"minQueryLength"`
	MaxQueryLength int               `json:"maxQueryLength"`
	SearchDelay    int               `json:"searchDelay"`
	ShowScores     bool              `json:"showScores"`
	ResultsPerPage int               `json:"resultsPerPage"`
	CacheDir       string            `json:"cache_dir"`
	AutoUpdate     bool              `json:"auto_update"`
	TruncateTitles bool              `json:"truncateTitles"`
	MaxTitleLength int               `json:"maxTitleLength"`
	CustomHeader   string            `json:"customHeader"`
	Repositories   []RepositoryState `json:"repositories"`
}

// DefaultSettings returns the default settings
func DefaultSettings() Settings {
	return Settings{
		MinQueryLength: 2,
		MaxQueryLength: 1000,
		SearchDelay:    300,
		ShowScores:     true,
		ResultsPerPage: 10,
		CacheDir:       config.CacheDir,
		AutoUpdate:     true,
		TruncateTitles: true,
		MaxTitleLength: 100,
		CustomHeader:   "Repository Search",
		Repositories:   []RepositoryState{},
	}
}

// GetSettingsPath returns the path to the settings file
func GetSettingsPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Error("Failed to get home directory", "error", err)
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".config", "freectl")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Error("Failed to create config directory", "path", configDir, "error", err)
		return "", fmt.Errorf("failed to create config directory: %w", err)
	}

	return filepath.Join(configDir, "config.json"), nil
}

// LoadSettings loads settings from the config file
func LoadSettings() (Settings, error) {
	path, err := GetSettingsPath()
	if err != nil {
		log.Error("Failed to get settings path", "error", err)
		return DefaultSettings(), nil
	}

	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// If file doesn't exist, create it with default settings
			defaultSettings := DefaultSettings()
			if err := SaveSettings(defaultSettings); err != nil {
				log.Error("Failed to create default settings file", "error", err)
				return defaultSettings, nil
			}
			return defaultSettings, nil
		}
		// For any other error, return default settings but log the error
		log.Error("Failed to read settings file", "path", path, "error", err)
		return DefaultSettings(), nil
	}

	var settings Settings
	if err := json.Unmarshal(content, &settings); err != nil {
		// If JSON parsing fails, return default settings but log the error
		log.Error("Failed to parse settings file", "error", err)
		return DefaultSettings(), nil
	}

	return settings, nil
}

// SaveSettings saves settings to the config file
func SaveSettings(settings Settings) error {
	path, err := GetSettingsPath()
	if err != nil {
		log.Error("Failed to get settings path", "error", err)
		return err
	}

	content, err := json.MarshalIndent(settings, "", "    ")
	if err != nil {
		log.Error("Failed to marshal settings", "error", err)
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		log.Error("Failed to write settings file", "path", path, "error", err)
		return fmt.Errorf("failed to write settings file: %w", err)
	}

	return nil
}

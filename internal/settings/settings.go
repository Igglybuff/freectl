package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"freectl/internal/sources"

	"github.com/charmbracelet/log"
)

// Settings represents the user settings
type Settings struct {
	MinQueryLength int              `json:"minQueryLength"`
	MaxQueryLength int              `json:"maxQueryLength"`
	SearchDelay    int              `json:"searchDelay"`
	ShowScores     bool             `json:"showScores"`
	ResultsPerPage int              `json:"resultsPerPage"`
	CacheDir       string           `json:"cache_dir"`
	AutoUpdate     bool             `json:"auto_update"`
	TruncateTitles bool             `json:"truncateTitles"`
	MaxTitleLength int              `json:"maxTitleLength"`
	CustomHeader   string           `json:"customHeader"`
	MinFuzzyScore  int              `json:"minFuzzyScore"`
	Sources        []sources.Source `json:"sources"`
}

// DefaultSettings returns the default settings
func DefaultSettings() Settings {
	return Settings{
		MinQueryLength: 2,
		MaxQueryLength: 1000,
		SearchDelay:    300,
		ShowScores:     true,
		ResultsPerPage: 10,
		CacheDir:       "~/.local/cache/freectl",
		AutoUpdate:     true,
		TruncateTitles: true,
		MaxTitleLength: 100,
		CustomHeader:   "find cool stuff",
		MinFuzzyScore:  0, // Default minimum score
		Sources:        []sources.Source{},
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

// AddSource adds a new source to the settings and initializes it
func AddSource(url, name, sourceType string) error {
	// Load current settings
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Check if source type is implemented
	if !sources.IsImplemented(sources.SourceType(sourceType)) {
		log.Warn("Unsupported source type for update", "name", name, "type", sourceType)
		return fmt.Errorf("unsupported source type: %s", sourceType)
	}

	// Check if source with this name already exists
	for _, source := range settings.Sources {
		if source.Name == name {
			return fmt.Errorf("source '%s' already exists", name)
		}
	}

	// Create initial source
	source := sources.Source{
		Name:    name,
		Path:    filepath.Join(settings.CacheDir, name),
		URL:     url,
		Enabled: true,
		Type:    sources.SourceType(sourceType),
	}

	// Add to settings first
	settings.Sources = append(settings.Sources, source)
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	// Now perform the actual add operation
	if err := sources.Add(settings.CacheDir, url, name, sourceType); err != nil {
		// If add fails, revert the settings change
		newSources := make([]sources.Source, 0)
		for _, s := range settings.Sources {
			if s.Name != name {
				newSources = append(newSources, s)
			}
		}
		settings.Sources = newSources
		if revertErr := SaveSettings(settings); revertErr != nil {
			log.Error("Failed to revert settings after add failure", "error", revertErr)
		}
		return fmt.Errorf("failed to add source: %w", err)
	}

	// Get the size of the source after adding
	size, err := sources.GetSourceSize(source.Path)
	if err != nil {
		log.Warn("Failed to get source size", "name", name, "error", err)
	}

	// Update the source in settings with metadata
	for i := range settings.Sources {
		if settings.Sources[i].Name == name {
			settings.Sources[i].Size = size
			settings.Sources[i].LastUpdated = time.Now().Format(time.RFC3339)
			break
		}
	}

	// Save the updated settings with metadata
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	return nil
}

// DeleteSource removes a source from settings
func DeleteSource(name string, force bool) error {
	// Load current settings
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Find the source in settings
	found := false
	newSources := make([]sources.Source, 0)
	for _, source := range settings.Sources {
		if source.Name != name {
			newSources = append(newSources, source)
		} else {
			found = true
		}
	}

	if !found {
		return fmt.Errorf("source '%s' not found", name)
	}

	// Update settings with the source removed
	settings.Sources = newSources

	// Save updated settings
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	return nil
}

// ListSources returns all sources from settings
func ListSources() ([]sources.Source, error) {
	settings, err := LoadSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	// Sort sources alphabetically by name
	sort.Slice(settings.Sources, func(i, j int) bool {
		return settings.Sources[i].Name < settings.Sources[j].Name
	})

	return settings.Sources, nil
}

// ToggleSourceEnabled toggles the enabled state of a source
func ToggleSourceEnabled(name string) error {
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Find and toggle the source
	found := false
	for i := range settings.Sources {
		if settings.Sources[i].Name == name {
			settings.Sources[i].Enabled = !settings.Sources[i].Enabled
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("source '%s' not found in settings", name)
	}

	// Save updated settings
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	return nil
}

// RenameSource renames a source in the settings
func RenameSource(oldName, newName string) error {
	// Load current settings
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Check if new name already exists
	for _, source := range settings.Sources {
		if source.Name == newName {
			return fmt.Errorf("source '%s' already exists", newName)
		}
	}

	// Find and rename the source
	found := false
	for i := range settings.Sources {
		if settings.Sources[i].Name == oldName {
			settings.Sources[i].Name = newName
			settings.Sources[i].Path = filepath.Join(filepath.Dir(settings.Sources[i].Path), newName)
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("source '%s' not found", oldName)
	}

	// Save updated settings
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	return nil
}

// IsSourceEnabled checks if a source is enabled
func IsSourceEnabled(name string) (bool, error) {
	settings, err := LoadSettings()
	if err != nil {
		return false, fmt.Errorf("failed to load settings: %w", err)
	}

	for _, source := range settings.Sources {
		if source.Name == name {
			return source.Enabled, nil
		}
	}

	return false, fmt.Errorf("source '%s' not found in settings", name)
}

// UpdateSource updates the specified sources and stores their metadata
func UpdateSource(name string) error {
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Find the source
	var sourceToUpdate *sources.Source
	for i := range settings.Sources {
		if settings.Sources[i].Name == name {
			sourceToUpdate = &settings.Sources[i]
			break
		}
	}

	if sourceToUpdate == nil {
		return fmt.Errorf("source '%s' not found", name)
	}

	// Update the source
	duration, err := sources.Update(settings.CacheDir, []sources.Source{*sourceToUpdate})
	if err != nil {
		return fmt.Errorf("failed to update source: %w", err)
	}

	// Get updated source size
	size, err := sources.GetSourceSize(sourceToUpdate.Path)
	if err != nil {
		log.Error("Failed to get source size", "name", name, "error", err)
		// Don't return error here as the update was successful
	}

	// Update source metadata
	sourceToUpdate.Size = size
	sourceToUpdate.LastUpdated = time.Now().Format(time.RFC3339)

	// Save updated settings
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	log.Info("Source updated successfully",
		"name", name,
		"duration", duration,
		"size", size,
		"lastUpdated", sourceToUpdate.LastUpdated)

	return nil
}

// UpdateAllSources updates all enabled sources and stores their metadata
func UpdateAllSources() error {
	settings, err := LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Filter enabled sources
	var enabledSources []sources.Source
	for _, source := range settings.Sources {
		if source.Enabled {
			enabledSources = append(enabledSources, source)
		}
	}

	if len(enabledSources) == 0 {
		log.Info("No enabled sources to update")
		return nil
	}

	// Update all enabled sources
	duration, err := sources.Update(settings.CacheDir, enabledSources)
	if err != nil {
		return fmt.Errorf("failed to update sources: %w", err)
	}

	// Update metadata for all sources
	for i := range settings.Sources {
		if settings.Sources[i].Enabled {
			// Get updated source size
			size, err := sources.GetSourceSize(settings.Sources[i].Path)
			if err != nil {
				log.Error("Failed to get source size",
					"name", settings.Sources[i].Name,
					"error", err)
				continue
			}

			// Update source metadata
			settings.Sources[i].Size = size
			settings.Sources[i].LastUpdated = time.Now().Format(time.RFC3339)
		}
	}

	// Save updated settings
	if err := SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	log.Info("All sources updated successfully",
		"duration", duration,
		"count", len(enabledSources))

	return nil
}

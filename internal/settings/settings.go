package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
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
	homeDir := os.Getenv("HOME")
	if homeDir == "" {
		// Fallback to os.UserHomeDir() if HOME is not set
		var err error
		homeDir, err = os.UserHomeDir()
		if err != nil {
			log.Error("Failed to get home directory", "error", err)
			homeDir = "~" // Fallback to "~" if both methods fail
		}
	}

	return Settings{
		MinQueryLength: 2,
		MaxQueryLength: 1000,
		SearchDelay:    300,
		ShowScores:     true,
		ResultsPerPage: 10,
		CacheDir:       filepath.Join(homeDir, ".local", "cache", "freectl"),
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

// SourceOperation represents a pending source operation
type SourceOperation struct {
	Type       string // "add" or "update"
	URL        string
	Name       string
	SourceType string
	Response   chan error
}

// SourceManager handles concurrent source operations
type SourceManager struct {
	operations chan SourceOperation
}

var (
	manager     *SourceManager
	managerOnce sync.Once
)

// getSourceManager returns the singleton SourceManager instance
func getSourceManager() *SourceManager {
	managerOnce.Do(func() {
		manager = &SourceManager{
			operations: make(chan SourceOperation),
		}
		go manager.run()
	})
	return manager
}

// run processes source operations sequentially
func (sm *SourceManager) run() {
	for op := range sm.operations {
		var err error
		switch op.Type {
		case "add":
			// First add the source to settings
			err = sm.addSourceInternal(op.URL, op.Name, op.SourceType)
			if err == nil {
				// Then ensure it's fully updated
				err = sm.updateSourceInternal(op.Name)
			}
		case "update":
			err = sm.updateSourceInternal(op.Name)
		}
		op.Response <- err
	}
}

// addSourceInternal is the internal implementation of AddSource
func (sm *SourceManager) addSourceInternal(url, name, sourceType string) error {
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

	// Create initial source with original name for display
	source := sources.Source{
		Name:    name,
		Path:    filepath.Join(settings.CacheDir, sources.SanitizePath(name)),
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

	return nil
}

// updateSourceInternal is the internal implementation of UpdateSource
func (sm *SourceManager) updateSourceInternal(name string) error {
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

// AddSource queues a source addition operation
func AddSource(url, name, sourceType string) error {
	responseChan := make(chan error)
	getSourceManager().operations <- SourceOperation{
		Type:       "add",
		URL:        url,
		Name:       name,
		SourceType: sourceType,
		Response:   responseChan,
	}
	return <-responseChan
}

// UpdateSource queues a source update operation
func UpdateSource(name string) error {
	responseChan := make(chan error)
	getSourceManager().operations <- SourceOperation{
		Type:     "update",
		Name:     name,
		Response: responseChan,
	}
	return <-responseChan
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
			// Don't modify the Path field - keep the original filesystem path
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

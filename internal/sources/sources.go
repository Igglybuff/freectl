package sources

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/charmbracelet/log"
)

// Source represents a data source
type Source struct {
	Name    string     `json:"name"`
	Path    string     `json:"path"`
	URL     string     `json:"url"`
	Enabled bool       `json:"enabled"`
	Type    SourceType `json:"type"`
}

// SourceType represents the type of a data source
type SourceType string

// Allowed source types
const (
	SourceTypeGit        SourceType = "git"
	SourceTypeRedditWiki SourceType = "reddit_wiki"

	// not implemented yet
	SourceTypeOPML      SourceType = "opml"
	SourceTypeBookmarks SourceType = "bookmarks"
	SourceTypeHN500     SourceType = "hn500"
	SourceTypeObsidian  SourceType = "obsidian"
)

// Add adds a new source by calling source-specific Add functions
func (s Source) Add(cacheDir string) error {
	switch s.Type {
	case SourceTypeGit:
		return AddGitRepo(cacheDir, s)
	case SourceTypeRedditWiki:
		return AddRedditWiki(cacheDir, s)
	case SourceTypeOPML:
		return AddOPML(cacheDir, s)
	case SourceTypeBookmarks:
		return AddBookmarks(cacheDir, s)
	case SourceTypeHN500:
		return AddHN500(cacheDir, s)
	case SourceTypeObsidian:
		return AddObsidian(cacheDir, s)
	default:
		return fmt.Errorf("unsupported source type: %s", s.Type)
	}
}

// GetSourcePath returns the path to a source
func GetSourcePath(cacheDir, sourceName string) string {
	// Expand the ~ to the user's home directory
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get home directory", "error", err)
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	sourcePath := filepath.Join(cacheDir, sourceName)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		log.Fatal("Source not found. Please run 'freectl update' first")
	}

	return sourcePath
}

// Add adds a new source to the cache
func Add(cacheDir string, url string, name string, sourceType string) error {
	if url == "" {
		return fmt.Errorf("source URL is required")
	}

	// If no name is provided, derive it from the URL
	if name == "" {
		name = DeriveNameFromURL(url)
	}

	// If no type is provided, default to git
	if sourceType == "" {
		sourceType = string(SourceTypeGit)
	}

	// Create a source object
	source := Source{
		Name: name,
		URL:  url,
		Type: SourceType(sourceType),
	}

	// Add the source using the appropriate handler
	if err := source.Add(cacheDir); err != nil {
		return fmt.Errorf("failed to add source: %w", err)
	}

	log.Info("Source added successfully", "name", name, "type", sourceType)
	return nil
}

// List returns all sources in the cache directory
func List(cacheDir string) ([]Source, error) {
	log.Debug("Starting source.List", "cacheDir", cacheDir)

	// The cache directory is already the sources directory
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Debug("Sources directory does not exist, returning empty list")
			return []Source{}, nil
		}
		log.Error("Failed to read sources directory", "error", err)
		return nil, fmt.Errorf("failed to read sources directory: %w", err)
	}
	log.Debug("Read directory entries", "count", len(entries))

	var sources []Source
	for _, entry := range entries {
		if !entry.IsDir() {
			log.Debug("Skipping non-directory entry", "name", entry.Name())
			continue
		}

		sourcePath := filepath.Join(cacheDir, entry.Name())
		log.Debug("Processing source", "name", entry.Name(), "path", sourcePath)

		// Get the remote URL (currently only Git sources are supported)
		url, err := GetGitRemoteURL(sourcePath)
		if err != nil {
			log.Error("Failed to get source URL", "name", entry.Name(), "error", err)
		}
		log.Debug("Got source URL", "name", entry.Name(), "url", url)

		sources = append(sources, Source{
			Name:    entry.Name(),
			Path:    sourcePath,
			URL:     url,
			Enabled: true,          // Default to enabled
			Type:    SourceTypeGit, // Default to git
		})
		log.Debug("Added source to list", "name", entry.Name())
	}

	log.Debug("Completed source listing", "total", len(sources))
	return sources, nil
}

// Delete removes a source from the cache
func Delete(cacheDir string, name string) error {
	// Find the source path
	sourcePath := filepath.Join(cacheDir, name)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return fmt.Errorf("source '%s' not found", name)
	}

	// Delete the source directory
	if err := DeleteGitRepo(sourcePath); err != nil {
		return fmt.Errorf("failed to delete source: %w", err)
	}

	log.Info("Source deleted successfully", "name", name)
	return nil
}

// Update updates all sources in the specified cache directory.
// It returns the duration of the operation and any error that occurred.
func Update(cacheDir string) (time.Duration, error) {
	startTime := time.Now()

	// Get list of sources
	sources, err := List(cacheDir)
	if err != nil {
		return 0, err
	}

	if len(sources) == 0 {
		log.Info("No sources found. Please add a source using 'freectl add'")
		return time.Since(startTime), nil
	}

	// Update each source
	for _, source := range sources {
		log.Info("Updating source", "name", source.Name)

		// Update existing source based on type
		switch source.Type {
		case SourceTypeGit:
			if err := UpdateGitRepo(source.Path); err != nil {
				log.Error("Failed to update source", "name", source.Name, "error", err)
				continue
			}
		default:
			log.Warn("Unsupported source type for update", "name", source.Name, "type", source.Type)
		}
		log.Info("Source updated successfully", "name", source.Name)
	}

	return time.Since(startTime), nil
}

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

	// Check if source type is implemented
	if !IsImplemented(SourceType(sourceType)) {
		log.Warn("Unsupported source type for update", "name", name, "type", sourceType)
		return fmt.Errorf("unsupported source type: %s", sourceType)
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

// Delete removes a source from disk
func Delete(cacheDir string, name string, force bool) error {
	sourcePath := filepath.Join(cacheDir, name)
	if _, err := os.Stat(sourcePath); err == nil {
		// Source exists in cache, try to delete it
		if err := os.RemoveAll(sourcePath); err != nil {
			log.Error("Failed to delete source from cache", "name", name, "error", err)
			if !force {
				return fmt.Errorf("failed to delete source from cache: %w", err)
			}
			// If force is true, continue even if cache deletion fails
			log.Info("Force flag used, continuing despite cache deletion failure")
		} else {
			log.Info("Successfully deleted source from cache", "name", name)
		}
	} else if !os.IsNotExist(err) {
		// Error other than "not exists"
		log.Error("Error checking source path", "name", name, "error", err)
		if !force {
			return fmt.Errorf("error checking source path: %w", err)
		}
		// If force is true, continue even if there's an error checking the path
		log.Info("Force flag used, continuing despite path check error")
	}

	return nil
}

// Update updates the specified sources.
// It returns the duration of the operation and any error that occurred.
func Update(cacheDir string, sources []Source) (time.Duration, error) {
	startTime := time.Now()

	if len(sources) == 0 {
		log.Info("No sources to update")
		return time.Since(startTime), nil
	}

	// Update each source
	for _, source := range sources {
		log.Info("Updating source", "name", source.Name, "type", source.Type)

		var err error
		switch source.Type {
		case SourceTypeGit:
			err = UpdateGitRepo(source.Path)
		case SourceTypeRedditWiki:
			err = UpdateRedditWiki(cacheDir, source)
		default:
			err = fmt.Errorf("unsupported source type: %s", source.Type)
		}

		if err != nil {
			log.Error("Failed to update source", "name", source.Name, "type", source.Type, "error", err)
			continue
		}

		log.Info("Source updated successfully", "name", source.Name, "type", source.Type)
	}

	return time.Since(startTime), nil
}

// IsImplemented returns true if the source type is implemented
func IsImplemented(sourceType SourceType) bool {
	return sourceType == SourceTypeGit || sourceType == SourceTypeRedditWiki
}

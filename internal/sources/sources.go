package sources

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/log"
)

// Source represents a data source
type Source struct {
	Name        string     `json:"name"`
	Path        string     `json:"path"`
	URL         string     `json:"url"`
	Enabled     bool       `json:"enabled"`
	Type        SourceType `json:"type"`
	Size        string     `json:"size"`
	LastUpdated string     `json:"last_updated"`
	ID          string     `json:"id"`
}

// SourceType represents the type of a data source
type SourceType string

// Allowed source types
const (
	SourceTypeGit        SourceType = "git"
	SourceTypeRedditWiki SourceType = "reddit_wiki"
	SourceTypeHN5000     SourceType = "hn5000"

	// not implemented yet
	SourceTypeOPML      SourceType = "opml"
	SourceTypeBookmarks SourceType = "bookmarks"
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
	case SourceTypeHN5000:
		return AddHN5000(cacheDir, s)
	case SourceTypeObsidian:
		return AddObsidian(cacheDir, s)
	default:
		return fmt.Errorf("unsupported source type: %s", s.Type)
	}
}

// ExpandCacheDir expands the cache directory path, handling "~" expansion
func ExpandCacheDir(cacheDir string) (string, error) {
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get home directory: %w", err)
		}
		return filepath.Join(home, cacheDir[2:]), nil
	}
	return cacheDir, nil
}

// SanitizePath sanitizes a name to be safe for filesystem operations.
// It removes any path separators and other potentially dangerous characters.
func SanitizePath(name string) string {
	// Replace any path separators with underscores
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")

	// Remove any other potentially dangerous characters
	name = strings.Map(func(r rune) rune {
		if r == '.' || r == '_' || r == '-' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return '_'
	}, name)

	// Ensure the name isn't empty after sanitization
	if name == "" {
		name = "unnamed_source"
	}

	return name
}

// GetSourcePath returns the path to a source
func GetSourcePath(cacheDir, sourceName string) string {
	// Expand the cache directory path
	expandedCacheDir, err := ExpandCacheDir(cacheDir)
	if err != nil {
		log.Fatal("Failed to expand cache directory", "error", err)
	}

	// Sanitize the source name only when used in the filesystem path
	sanitizedName := SanitizePath(sourceName)
	sourcePath := filepath.Join(expandedCacheDir, sanitizedName)
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

	// Expand the cache directory path
	expandedCacheDir, err := ExpandCacheDir(cacheDir)
	if err != nil {
		return fmt.Errorf("failed to expand cache directory: %w", err)
	}

	// Create a source object with sanitized name for filesystem operations
	source := Source{
		Name: name,                                                // Keep original name for display
		Path: filepath.Join(expandedCacheDir, SanitizePath(name)), // Use sanitized name for filesystem
		URL:  url,
		Type: SourceType(sourceType),
	}

	// Add the source using the appropriate handler
	if err := source.Add(expandedCacheDir); err != nil {
		return fmt.Errorf("failed to add source: %w", err)
	}

	log.Info("Source added successfully", "name", name, "type", sourceType)
	return nil
}

// Delete removes a source from disk
func Delete(cacheDir string, name string, force bool) error {
	// Expand the cache directory path
	expandedCacheDir, err := ExpandCacheDir(cacheDir)
	if err != nil {
		return fmt.Errorf("failed to expand cache directory: %w", err)
	}

	// Use sanitized name for filesystem operations
	sanitizedName := SanitizePath(name)
	sourcePath := filepath.Join(expandedCacheDir, sanitizedName)
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
		return time.Since(startTime).Round(100 * time.Millisecond), nil
	}

	// Expand the cache directory path
	expandedCacheDir, err := ExpandCacheDir(cacheDir)
	if err != nil {
		return 0, fmt.Errorf("failed to expand cache directory: %w", err)
	}

	// Update each source
	for _, source := range sources {
		log.Info("Updating source", "name", source.Name, "type", source.Type)

		var err error
		switch source.Type {
		case SourceTypeGit:
			err = UpdateGitRepo(source.Path)
		case SourceTypeRedditWiki:
			err = UpdateRedditWiki(expandedCacheDir, source)
		case SourceTypeHN5000:
			err = UpdateHN5000(expandedCacheDir, source)
		default:
			err = fmt.Errorf("unsupported source type: %s", source.Type)
		}

		if err != nil {
			log.Error("Failed to update source", "name", source.Name, "type", source.Type, "error", err)
			continue
		}

		log.Info("Source updated successfully", "name", source.Name, "type", source.Type)
	}

	return time.Since(startTime).Round(100 * time.Millisecond), nil
}

// IsImplemented returns true if the source type is implemented
func IsImplemented(sourceType SourceType) bool {
	return sourceType == SourceTypeGit ||
		sourceType == SourceTypeRedditWiki ||
		sourceType == SourceTypeHN5000
}

// GetSourceSize returns the size of a source in human-readable format
func GetSourceSize(sourcePath string) (string, error) {
	_, err := os.Stat(sourcePath)
	if os.IsNotExist(err) {
		return "0 B", fmt.Errorf("source path does not exist: %s", sourcePath)
	}

	size, err := getDirSize(sourcePath)
	if err != nil {
		return "0 B", err
	}

	return formatBytes(size), nil
}

// formatBytes converts bytes to human-readable format
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	// Use one decimal place for sizes >= 1KB
	if exp > 0 {
		return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp-1])
	}
	return fmt.Sprintf("%d B", bytes)
}

// getDirSize returns the size of a directory in bytes
func getDirSize(dirPath string) (int64, error) {
	var size int64

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, fmt.Errorf("failed to get directory size: %w", err)
	}

	return size, nil
}

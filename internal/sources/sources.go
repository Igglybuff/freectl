package sources

import (
	"fmt"
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
	SourceTypeOPML       SourceType = "opml"
	SourceTypeBookmarks  SourceType = "bookmarks"
	SourceTypeHN500      SourceType = "hn500"
	SourceTypeObsidian   SourceType = "obsidian"
)

// Adds a new source by calling source-specific Add functions
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

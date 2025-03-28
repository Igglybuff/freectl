package repository

import (
	"time"

	"freectl/internal/sources"
)

// Repository represents a Git repository
type Repository struct {
	Name    string             `json:"name"`
	Path    string             `json:"path"`
	URL     string             `json:"url"`
	Enabled bool               `json:"enabled"`
	Type    sources.SourceType `json:"type"`
}

// AddRepositoryRequest represents a request to add a new repository
type AddRepositoryRequest struct {
	Name string
	URL  string
	Type string
}

// GetRepoPath returns the path to a repository
func GetRepoPath(cacheDir, name string) string {
	return sources.GetSourcePath(cacheDir, name)
}

// AddRepository adds a new repository to the cache
func AddRepository(cacheDir string, req AddRepositoryRequest) error {
	return sources.Add(cacheDir, req.URL, req.Name, req.Type)
}

// List returns all repositories in the cache directory
func List(cacheDir string) ([]Repository, error) {
	sources, err := sources.List(cacheDir)
	if err != nil {
		return nil, err
	}

	var repos []Repository
	for _, source := range sources {
		repos = append(repos, Repository{
			Name:    source.Name,
			Path:    source.Path,
			URL:     source.URL,
			Enabled: source.Enabled,
			Type:    source.Type,
		})
	}

	return repos, nil
}

// Delete removes a repository from the cache
func Delete(cacheDir string, name string) error {
	return sources.Delete(cacheDir, name)
}

// ToggleEnabled enables or disables a repository
func ToggleEnabled(cacheDir string, name string) error {
	return sources.ToggleEnabled(cacheDir, name)
}

// IsEnabled checks if a repository is enabled
func IsEnabled(cacheDir string, name string) (bool, error) {
	return sources.IsEnabled(cacheDir, name)
}

// UpdateRepo updates a repository
func UpdateRepo(cacheDir string) (time.Duration, error) {
	return sources.Update(cacheDir)
}

package repository

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
)

// Repository represents a cached repository
type Repository struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
}

// List returns all repositories in the cache directory
func List(cacheDir string) ([]Repository, error) {
	repos, err := common.ListRepositories(cacheDir)
	if err != nil {
		return nil, fmt.Errorf("failed to list repositories: %w", err)
	}

	// Convert to our repository type with additional fields
	result := make([]Repository, len(repos))
	for i, repo := range repos {
		enabled, err := IsEnabled(cacheDir, repo.Name)
		if err != nil {
			log.Error("Failed to check repository status", "name", repo.Name, "error", err)
			enabled = true // Default to enabled if we can't check
		}
		result[i] = Repository{
			Name:    repo.Name,
			Path:    repo.Path,
			URL:     "", // TODO: Get from git remote
			Enabled: enabled,
		}
	}

	return result, nil
}

// Delete removes a repository from the cache
func Delete(cacheDir string, name string) error {
	// Get list of repositories
	repos, err := common.ListRepositories(cacheDir)
	if err != nil {
		return fmt.Errorf("failed to get repositories: %w", err)
	}

	// Find the repository
	var repo common.Repository
	var found bool
	for _, r := range repos {
		if r.Name == name {
			repo = r
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("repository '%s' not found", name)
	}

	// Delete the repository directory
	if err := os.RemoveAll(repo.Path); err != nil {
		return fmt.Errorf("failed to delete repository: %w", err)
	}

	log.Info("Repository deleted successfully", "name", name)
	return nil
}

// Add adds a new repository to the cache
func Add(cacheDir string, url string, name string) error {
	if url == "" {
		return fmt.Errorf("repository URL is required")
	}

	// If no name is provided, derive it from the URL
	if name == "" {
		name = filepath.Base(url)
		// Remove .git extension if present
		name = strings.TrimSuffix(name, ".git")
	}

	// Get the repository path using the common function
	repoPath := common.GetRepositoryPath(cacheDir, name)

	// Check if repository already exists
	if _, err := os.Stat(repoPath); !os.IsNotExist(err) {
		return fmt.Errorf("repository %s already exists", name)
	}

	// Clone the repository
	log.Info("Cloning repository", "url", url, "name", name)
	cmd := exec.Command("git", "clone", "--depth", "1", url, repoPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to clone repository: %s", string(output))
	}

	log.Info("Repository added successfully", "name", name)
	return nil
}

// ToggleEnabled enables or disables a repository
func ToggleEnabled(cacheDir string, name string) error {
	// Get list of repositories
	repos, err := common.ListRepositories(cacheDir)
	if err != nil {
		return fmt.Errorf("failed to get repositories: %w", err)
	}

	// Find the repository
	var repo common.Repository
	var found bool
	for _, r := range repos {
		if r.Name == name {
			repo = r
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("repository '%s' not found", name)
	}

	// Create a .disabled file in the repository directory to mark it as disabled
	disabledFile := filepath.Join(repo.Path, ".disabled")
	if _, err := os.Stat(disabledFile); os.IsNotExist(err) {
		// Create .disabled file to disable the repository
		if err := os.WriteFile(disabledFile, []byte{}, 0644); err != nil {
			return fmt.Errorf("failed to disable repository: %w", err)
		}
		log.Info("Repository disabled successfully", "name", name)
	} else {
		// Remove .disabled file to enable the repository
		if err := os.Remove(disabledFile); err != nil {
			return fmt.Errorf("failed to enable repository: %w", err)
		}
		log.Info("Repository enabled successfully", "name", name)
	}

	return nil
}

// IsEnabled checks if a repository is enabled
func IsEnabled(cacheDir string, name string) (bool, error) {
	// Get list of repositories
	repos, err := common.ListRepositories(cacheDir)
	if err != nil {
		return false, fmt.Errorf("failed to get repositories: %w", err)
	}

	// Find the repository
	var repo common.Repository
	var found bool
	for _, r := range repos {
		if r.Name == name {
			repo = r
			found = true
			break
		}
	}

	if !found {
		return false, fmt.Errorf("repository '%s' not found", name)
	}

	// Check if .disabled file exists
	disabledFile := filepath.Join(repo.Path, ".disabled")
	_, err = os.Stat(disabledFile)
	if err == nil {
		return false, nil
	}
	if os.IsNotExist(err) {
		return true, nil
	}
	return false, fmt.Errorf("failed to check repository status: %w", err)
}

// DeriveNameFromURL extracts a repository name from a Git URL
func DeriveNameFromURL(url string) string {
	// Remove .git extension if present
	url = strings.TrimSuffix(url, ".git")

	// Get the last part of the URL
	name := filepath.Base(url)

	// If the name is empty (e.g., for URLs ending in /), try to get the parent directory
	if name == "" {
		url = strings.TrimSuffix(url, "/")
		name = filepath.Base(url)
	}

	return name
}

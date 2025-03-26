package repository

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"freectl/internal/settings"

	"github.com/charmbracelet/log"
)

// Repository represents a cached repository
type Repository struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
}

// AddRepositoryRequest represents the request to add a new repository
type AddRepositoryRequest struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

// GetRepoPath returns the path to a repository
func GetRepoPath(cacheDir, repoName string) string {
	// Expand the ~ to the user's home directory
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get home directory", "error", err)
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	repoPath := filepath.Join(cacheDir, repoName)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		log.Fatal("Repository not found. Please run 'freectl update' first")
	}

	return repoPath
}

// GetGitRemoteURL returns the remote URL of a Git repository
func GetGitRemoteURL(repoPath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "remote", "get-url", "origin")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to get remote URL: %s", string(output))
	}
	return strings.TrimSpace(string(output)), nil
}

// ValidateRepository checks if a repository exists and is valid
func ValidateRepository(cacheDir, name string) error {
	repoPath := filepath.Join(cacheDir, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository %s not found", name)
	}

	// Check if it's a valid Git repository
	if _, err := os.Stat(filepath.Join(repoPath, ".git")); os.IsNotExist(err) {
		return fmt.Errorf("repository %s is not a valid Git repository", name)
	}

	return nil
}

// AddRepository adds a new repository to the cache
func AddRepository(cacheDir string, url string, name string) error {
	if url == "" {
		return fmt.Errorf("repository URL is required")
	}

	// If no name is provided, derive it from the URL
	if name == "" {
		name = filepath.Base(url)
		// Remove .git extension if present
		name = strings.TrimSuffix(name, ".git")
	}

	// Get the repository path
	repoPath := filepath.Join(cacheDir, name)

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

// List returns all repositories in the cache directory
func List(cacheDir string) ([]Repository, error) {
	log.Debug("Starting repository.List", "cacheDir", cacheDir)

	// Load settings to get repository states
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}

	// The cache directory is already the repos directory
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Debug("Repos directory does not exist, returning empty list")
			return []Repository{}, nil
		}
		log.Error("Failed to read repositories directory", "error", err)
		return nil, fmt.Errorf("failed to read repositories directory: %w", err)
	}
	log.Debug("Read directory entries", "count", len(entries))

	var repos []Repository
	for _, entry := range entries {
		if !entry.IsDir() {
			log.Debug("Skipping non-directory entry", "name", entry.Name())
			continue
		}

		repoPath := filepath.Join(cacheDir, entry.Name())
		log.Debug("Processing repository", "name", entry.Name(), "path", repoPath)

		// Get the remote URL
		url, err := GetGitRemoteURL(repoPath)
		if err != nil {
			log.Error("Failed to get repository URL", "name", entry.Name(), "error", err)
		}
		log.Debug("Got repository URL", "name", entry.Name(), "url", url)

		// Check if we have state for this repository in settings
		enabled := true // Default to enabled
		for _, repoState := range s.Repositories {
			if repoState.Name == entry.Name() {
				enabled = repoState.Enabled
				break
			}
		}

		repos = append(repos, Repository{
			Name:    entry.Name(),
			Path:    repoPath,
			URL:     url,
			Enabled: enabled,
		})
		log.Debug("Added repository to list", "name", entry.Name())
	}

	log.Debug("Completed repository listing", "total", len(repos))
	return repos, nil
}

// Delete removes a repository from the cache
func Delete(cacheDir string, name string) error {
	// Load settings
	s, err := settings.LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Find the repository path
	repoPath := filepath.Join(cacheDir, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository '%s' not found", name)
	}

	// Delete the repository directory
	if err := os.RemoveAll(repoPath); err != nil {
		return fmt.Errorf("failed to delete repository: %w", err)
	}

	// Remove from settings
	newRepos := make([]settings.RepositoryState, 0)
	for _, repo := range s.Repositories {
		if repo.Name != name {
			newRepos = append(newRepos, repo)
		}
	}
	s.Repositories = newRepos

	// Save updated settings
	if err := settings.SaveSettings(s); err != nil {
		log.Error("Failed to save settings after repository deletion", "error", err)
	}

	log.Info("Repository deleted successfully", "name", name)
	return nil
}

// ToggleEnabled enables or disables a repository
func ToggleEnabled(cacheDir string, name string) error {
	// Load settings
	s, err := settings.LoadSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	// Find the repository path
	repoPath := filepath.Join(cacheDir, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository '%s' not found", name)
	}

	// Get the remote URL
	url, err := GetGitRemoteURL(repoPath)
	if err != nil {
		log.Error("Failed to get repository URL", "name", name, "error", err)
	}

	// Find or create repository state
	var found bool
	for i := range s.Repositories {
		if s.Repositories[i].Name == name {
			s.Repositories[i].Enabled = !s.Repositories[i].Enabled
			found = true
			break
		}
	}

	if !found {
		s.Repositories = append(s.Repositories, settings.RepositoryState{
			Name:    name,
			Path:    repoPath,
			URL:     url,
			Enabled: false, // Toggle from default enabled state
		})
	}

	// Save updated settings
	if err := settings.SaveSettings(s); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	status := "enabled"
	if !s.Repositories[len(s.Repositories)-1].Enabled {
		status = "disabled"
	}
	log.Info("Repository "+status+" successfully", "name", name)
	return nil
}

// IsEnabled checks if a repository is enabled
func IsEnabled(cacheDir string, name string) (bool, error) {
	log.Debug("Checking if repository is enabled", "name", name)

	// Load settings
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		return false, fmt.Errorf("failed to load settings: %w", err)
	}

	// Check repository state in settings
	for _, repo := range s.Repositories {
		if repo.Name == name {
			log.Debug("Found repository state in settings", "name", name, "enabled", repo.Enabled)
			return repo.Enabled, nil
		}
	}

	// If not found in settings, default to enabled
	log.Debug("Repository not found in settings, defaulting to enabled", "name", name)
	return true, nil
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

// UpdateRepo updates or clones all repositories in the specified cache directory.
// It returns the duration of the operation and any error that occurred.
func UpdateRepo(cacheDir string) (time.Duration, error) {
	startTime := time.Now()

	// Get list of repositories
	repos, err := List(cacheDir)
	if err != nil {
		return 0, err
	}

	if len(repos) == 0 {
		log.Info("No repositories found. Please add a repository using 'freectl add'")
		return time.Since(startTime), nil
	}

	// Update each repository
	for _, repo := range repos {
		log.Info("Updating repository", "name", repo.Name)

		// Update existing repository
		cmd := exec.Command("git", "-C", repo.Path, "pull")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			log.Error("Failed to update repository", "name", repo.Name, "error", err)
			continue
		}
		log.Info("Repository updated successfully", "name", repo.Name)
	}

	return time.Since(startTime), nil
}

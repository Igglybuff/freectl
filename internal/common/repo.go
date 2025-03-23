package common

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/log"
)

// Repository represents a cached Git repository
type Repository struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Path string `json:"path"`
}

// GetReposPath returns the path to the repositories directory
func GetReposPath(cacheDir string) string {
	// Expand the ~ to the user's home directory
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get home directory", "error", err)
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	return cacheDir
}

// GetRepositoryPath returns the path to a specific repository
func GetRepositoryPath(cacheDir, name string) string {
	return filepath.Join(GetReposPath(cacheDir), name)
}

// ListRepositories returns a list of all cached repositories
func ListRepositories(cacheDir string) ([]Repository, error) {
	reposPath := GetReposPath(cacheDir)
	entries, err := os.ReadDir(reposPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []Repository{}, nil
		}
		return nil, fmt.Errorf("failed to read repositories directory: %w", err)
	}

	var repos []Repository
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		repoPath := filepath.Join(reposPath, entry.Name())
		repo := Repository{
			Name: entry.Name(),
			Path: repoPath,
		}

		// Try to get the remote URL
		if url, err := GetGitRemoteURL(repoPath); err == nil {
			repo.URL = url
		}

		repos = append(repos, repo)
	}

	return repos, nil
}

// GetGitRemoteURL gets the remote URL of a Git repository
func GetGitRemoteURL(repoPath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "remote", "get-url", "origin")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

// ValidateRepository checks if a repository exists and is valid
func ValidateRepository(cacheDir, name string) error {
	repoPath := GetRepositoryPath(cacheDir, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository %s not found", name)
	}

	// Check if it's a valid Git repository
	if _, err := os.Stat(filepath.Join(repoPath, ".git")); os.IsNotExist(err) {
		return fmt.Errorf("repository %s is not a valid Git repository", name)
	}

	return nil
}

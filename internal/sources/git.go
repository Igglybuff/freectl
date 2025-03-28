package sources

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// GitRepo represents a Git repository
type GitRepo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
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

// ValidateGitRepo checks if a repository exists and is valid
func ValidateGitRepo(repoPath string) error {
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository %s not found", repoPath)
	}

	// Check if it's a valid Git repository
	if _, err := os.Stat(filepath.Join(repoPath, ".git")); os.IsNotExist(err) {
		return fmt.Errorf("repository %s is not a valid Git repository", repoPath)
	}

	return nil
}

// AddGitRepo adds a Git repository as a source
func AddGitRepo(cacheDir string, source Source) error {
	if source.URL == "" {
		return fmt.Errorf("git source requires a URL")
	}

	// Create a directory for the repository
	repoDir := filepath.Join(cacheDir, source.Name)
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		return fmt.Errorf("failed to create repository directory: %w", err)
	}

	// Check if the repository already exists
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err == nil {
		// Repository exists, pull latest changes
		cmd := exec.Command("git", "-C", repoDir, "pull")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to pull latest changes: %w", err)
		}
	} else {
		// Repository doesn't exist, clone it
		cmd := exec.Command("git", "clone", source.URL, repoDir)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to clone repository: %w", err)
		}
	}

	return nil
}

// UpdateGitRepo updates a Git repository by pulling the latest changes
func UpdateGitRepo(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "pull")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to update repository: %w", err)
	}
	return nil
}

// DeleteGitRepo removes a Git repository from disk
func DeleteGitRepo(repoPath string) error {
	if err := os.RemoveAll(repoPath); err != nil {
		return fmt.Errorf("failed to delete repository: %w", err)
	}
	return nil
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

// CheckRepoAge checks if the repository needs updating
func CheckRepoAge(repoPath string) (bool, error) {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%ct")
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to get last commit timestamp: %w", err)
	}

	var timestamp int64
	if _, err := fmt.Sscanf(string(output), "%d", &timestamp); err != nil {
		return false, fmt.Errorf("failed to parse timestamp: %w", err)
	}

	lastCommit := time.Unix(timestamp, 0)
	return time.Since(lastCommit) > 7*24*time.Hour, nil
}

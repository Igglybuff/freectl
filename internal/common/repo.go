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

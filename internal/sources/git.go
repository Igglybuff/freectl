package sources

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

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

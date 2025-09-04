package sources

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/log"
)

// createNonInteractiveGitCommand creates a git command with non-interactive settings
func createNonInteractiveGitCommand(ctx context.Context, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "git", args...)
	// Set environment to prevent interactive authentication
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0", // Disable terminal prompts
		"GIT_ASKPASS=echo",      // Make askpass fail immediately
		"SSH_ASKPASS=echo",      // Make SSH askpass fail immediately
		"GIT_SSH_COMMAND=ssh -o BatchMode=yes -o StrictHostKeyChecking=no", // Non-interactive SSH
	)
	return cmd
}

// handleGitError provides user-friendly error messages for common git failures
func handleGitError(err error, operation string, ctx context.Context) error {
	if ctx.Err() == context.DeadlineExceeded {
		return fmt.Errorf("git %s timed out - repository may require authentication or be unreachable", operation)
	}

	errStr := err.Error()
	if strings.Contains(errStr, "Authentication failed") ||
		strings.Contains(errStr, "Permission denied") ||
		strings.Contains(errStr, "could not read Username") ||
		strings.Contains(errStr, "terminal prompts disabled") {
		return fmt.Errorf("repository requires authentication - please use a public repository or configure SSH keys: %w", err)
	}

	return fmt.Errorf("failed to %s: %w", operation, err)
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

	// Create a directory for the repository using sanitized name
	repoDir := filepath.Join(cacheDir, SanitizePath(source.Name))
	if err := os.MkdirAll(repoDir, 0755); err != nil {
		return fmt.Errorf("failed to create repository directory: %w", err)
	}

	// Check if the repository already exists
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err == nil {
		// Repository exists, pull latest changes
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Info("Pulling latest changes for existing repository", "repo", source.Name, "dir", repoDir)
		cmd := createNonInteractiveGitCommand(ctx, "-C", repoDir, "pull")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			return handleGitError(err, "pull latest changes", ctx)
		}
	} else {
		// Repository doesn't exist, clone it
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		log.Info("Cloning new repository", "url", source.URL, "dir", repoDir)
		cmd := createNonInteractiveGitCommand(ctx, "clone", source.URL, repoDir)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			// Clean up failed clone directory
			os.RemoveAll(repoDir)
			return handleGitError(err, "clone repository", ctx)
		}
	}

	return nil
}

// UpdateGitRepo updates a Git repository by pulling the latest changes
func UpdateGitRepo(repoPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Info("Updating repository", "path", repoPath)
	cmd := createNonInteractiveGitCommand(ctx, "-C", repoPath, "pull")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return handleGitError(err, "update repository", ctx)
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

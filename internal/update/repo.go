package update

import (
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/charmbracelet/log"
)

// UpdateRepo updates or clones the FMHY repository in the specified cache directory.
// It returns the duration of the operation and any error that occurred.
func UpdateRepo(cacheDir string) (time.Duration, error) {
	startTime := time.Now()

	// Expand the ~ to the user's home directory
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			return 0, err
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	// Create cache directory if it doesn't exist
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return 0, err
	}

	repoPath := filepath.Join(cacheDir, "FMHY")
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		// Clone the repository
		log.Info("Cloning FMHY repository...")
		cmd := exec.Command("git", "clone", "https://github.com/fmhy/edit.git", repoPath)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return 0, err
		}
		log.Info("Repository cloned successfully")
	} else {
		// Update existing repository
		log.Info("Updating FMHY repository...")
		cmd := exec.Command("git", "-C", repoPath, "pull")
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return 0, err
		}
		log.Info("Repository updated successfully")
	}

	return time.Since(startTime), nil
}

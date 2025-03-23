package update

import (
	"os"
	"os/exec"
	"time"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
)

// UpdateRepo updates or clones all repositories in the specified cache directory.
// It returns the duration of the operation and any error that occurred.
func UpdateRepo(cacheDir string) (time.Duration, error) {
	startTime := time.Now()

	// Get list of repositories
	repos, err := common.ListRepositories(cacheDir)
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

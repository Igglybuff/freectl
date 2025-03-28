package update

import (
	"fmt"
	"time"

	"freectl/internal/config"
	"freectl/internal/repository"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var UpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update all cached repositories",
	Long:  `Updates all repositories that are currently cached locally by pulling the latest changes from their remote sources.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Debug("Starting update command")
		log.Debug("Using cache directory", "path", config.CacheDir)

		// Get list of repositories
		repos, err := repository.List(config.CacheDir)
		if err != nil {
			log.Error("Failed to list repositories", "error", err)
			return fmt.Errorf("failed to get repositories: %w", err)
		}

		log.Debug("Found repositories to update", "count", len(repos))

		if len(repos) == 0 {
			fmt.Println("No repositories found to update.")
			return nil
		}

		start := time.Now()
		updated := 0
		failed := 0

		for _, repo := range repos {
			if !repo.Enabled {
				log.Debug("Skipping disabled repository", "name", repo.Name)
				continue
			}

			log.Debug("Updating repository", "name", repo.Name)
			if err := sources.UpdateGitRepo(repo.Path); err != nil {
				log.Error("Failed to update repository", "name", repo.Name, "error", err)
				fmt.Printf("Failed to update %s: %v\n", repo.Name, err)
				failed++
				continue
			}
			log.Debug("Successfully updated repository", "name", repo.Name)
			updated++
		}

		duration := time.Since(start)
		log.Debug("Update command completed",
			"duration", duration,
			"updated", updated,
			"failed", failed)

		if failed > 0 {
			return fmt.Errorf("failed to update %d repositories", failed)
		}

		fmt.Printf("Updated %d repositories in %s\n", updated, duration)
		return nil
	},
}

func init() {
	// Add any flags specific to the update command here
}

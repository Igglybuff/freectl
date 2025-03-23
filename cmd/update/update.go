package update

import (
	"freectl/internal/update"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var UpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update all cached repositories",
	Long: `Update pulls the latest changes from all cached repositories.
The repositories are stored in ~/.local/cache/freectl by default.

This command will:
1. Find all repositories in the cache directory
2. Pull the latest changes from each repository
3. Skip any repositories that fail to update

Examples:
  # Update using default cache directory
  freectl update

  # Update using a custom cache directory
  freectl update --cache-dir /path/to/cache`,
	Run: func(cmd *cobra.Command, args []string) {
		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		duration, err := update.UpdateRepo(cacheDir)
		if err != nil {
			log.Fatal("Failed to update repositories", "error", err)
		}
		log.Info("Update completed", "duration", duration)
	},
}

func init() {
	// Add any flags specific to the update command here
}

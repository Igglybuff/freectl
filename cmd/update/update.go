package update

import (
	"freectl/internal/update"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var UpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update the local FMHY repository cache",
	Long: `Update downloads the FMHY repository to the local cache directory or updates it if it already exists.
The repository is stored in ~/.local/cache/freectl by default.

This command will:
1. Create the cache directory if it doesn't exist
2. Clone the repository if it's not already present
3. Pull the latest changes if the repository exists

Examples:
  # Update using default cache directory
  freectl update

  # Update using a custom cache directory
  freectl update --cache-dir /path/to/cache`,
	Run: func(cmd *cobra.Command, args []string) {
		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		duration, err := update.UpdateRepo(cacheDir)
		if err != nil {
			log.Fatal("Failed to update repository", "error", err)
		}
		log.Info("Update completed", "duration", duration)
	},
}

func init() {
	// Add any flags specific to the update command here
}

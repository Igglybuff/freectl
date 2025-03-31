package update

import (
	"fmt"
	"time"

	"freectl/internal/settings"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

// UpdateCmd represents the update command
var UpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update all sources",
	Long: `Update all sources in the cache directory. This will fetch the latest
content from each source.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		startTime := time.Now()

		// Get list of sources from settings
		sourceList, err := settings.ListSources()
		if err != nil {
			log.Error("Failed to list sources", "error", err)
			return fmt.Errorf("failed to list sources: %w", err)
		}

		if len(sourceList) == 0 {
			log.Info("No sources found. Please add a source using 'freectl add'")
			return nil
		}

		// Update all enabled sources using the wrapper function
		if err := settings.UpdateAllSources(); err != nil {
			log.Error("Failed to update sources", "error", err)
			return fmt.Errorf("failed to update sources: %w", err)
		}

		duration := time.Since(startTime).Round(100 * time.Millisecond)
		log.Info("Update completed", "duration", duration)
		return nil
	},
}

func init() {
	// Add any flags specific to the update command here
}

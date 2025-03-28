package update

import (
	"fmt"
	"time"

	"freectl/internal/config"
	"freectl/internal/sources"

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

		// Get list of sources
		sourceList, err := sources.List(config.CacheDir)
		if err != nil {
			log.Error("Failed to list sources", "error", err)
			return fmt.Errorf("failed to list sources: %w", err)
		}

		if len(sourceList) == 0 {
			log.Info("No sources found. Please add a source using 'freectl add'")
			return nil
		}

		// Update each source
		for _, source := range sourceList {
			log.Info("Updating source", "name", source.Name)

			// Update existing source based on type
			switch source.Type {
			case sources.SourceTypeGit:
				if err := sources.UpdateGitRepo(source.Path); err != nil {
					log.Error("Failed to update source", "name", source.Name, "error", err)
					continue
				}
			default:
				log.Warn("Unsupported source type for update", "name", source.Name, "type", source.Type)
			}
			log.Info("Source updated successfully", "name", source.Name)
		}

		duration := time.Since(startTime)
		log.Info("Update completed", "duration", duration)
		return nil
	},
}

func init() {
	// Add any flags specific to the update command here
}

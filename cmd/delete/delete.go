package delete

import (
	"fmt"

	"freectl/internal/settings"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	sourceName string
	force      bool
)

// DeleteCmd represents the delete command
var DeleteCmd = &cobra.Command{
	Use:   "delete [name]",
	Short: "Delete a source",
	Long: `Delete a source from the cache directory. This will remove the source
from disk and from the list of managed sources.

If the source has already been manually deleted from the cache directory,
use the --force flag to remove it from settings.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		sourceName = args[0]

		// Load settings to get cache directory
		s, err := settings.LoadSettings()
		if err != nil {
			log.Error("Failed to load settings", "error", err)
			return fmt.Errorf("failed to load settings: %w", err)
		}

		// List sources to verify the source exists in settings
		allSources, err := settings.ListSources()
		if err != nil {
			log.Error("Failed to list sources", "error", err)
			return fmt.Errorf("failed to list sources: %w", err)
		}

		found := false
		for _, source := range allSources {
			if source.Name == sourceName {
				found = true
				break
			}
		}

		if !found {
			log.Error("Source not found in settings", "name", sourceName)
			return fmt.Errorf("source '%s' not found in settings", sourceName)
		}

		// Try to delete from cache first
		if err := sources.Delete(s.CacheDir, sourceName, force); err != nil {
			log.Error("Failed to delete source from cache", "name", sourceName, "error", err)
			if !force {
				return fmt.Errorf("failed to delete source from cache: %w", err)
			}
			// If force is true, continue even if cache deletion fails
			log.Info("Force flag used, continuing despite cache deletion failure")
		}

		// Always try to remove from settings
		if err := settings.DeleteSource(sourceName, force); err != nil {
			log.Error("Failed to delete source from settings", "error", err)
			return fmt.Errorf("failed to delete source from settings: %w", err)
		}

		log.Info("Successfully deleted source", "name", sourceName)
		return nil
	},
}

func init() {
	DeleteCmd.Flags().BoolVarP(&force, "force", "f", false, "Force delete from settings even if source doesn't exist in cache")
}

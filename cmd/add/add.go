package add

import (
	"fmt"

	"freectl/internal/settings"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	name       string
	sourceType string
)

// AddCmd represents the add command
var AddCmd = &cobra.Command{
	Use:   "add [url]",
	Short: "Add a new source",
	Long: `Add a new source to the cache. The source will be initialized
and enabled by default.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]

		// Load settings to check for existing sources
		s, err := settings.LoadSettings()
		if err != nil {
			log.Error("Failed to load settings", "error", err)
			return fmt.Errorf("failed to load settings: %w", err)
		}

		// If name is not provided, derive it from URL
		if name == "" {
			name = sources.DeriveNameFromURL(url)
		}

		// Check if source type is implemented
		if !sources.IsImplemented(sources.SourceType(sourceType)) {
			log.Warn("Unsupported source type for update", "name", name, "type", sourceType)
			return fmt.Errorf("unsupported source type: %s", sourceType)
		}

		// Check if source with this name already exists
		for _, source := range s.Sources {
			if source.Name == name {
				log.Error("Source already exists", "name", name)
				return fmt.Errorf("source '%s' already exists", name)
			}
		}

		if err := settings.AddSource(url, name, sourceType); err != nil {
			log.Error("Failed to add source", "error", err)
			return fmt.Errorf("failed to add source: %w", err)
		}

		log.Info("Successfully added source", "name", name, "url", url)
		return nil
	},
}

func init() {
	AddCmd.Flags().StringVarP(&name, "name", "n", "", "Name for the source (default: derived from URL)")
	AddCmd.Flags().StringVarP(&sourceType, "type", "t", "git", "Type of source (default: git)")
}

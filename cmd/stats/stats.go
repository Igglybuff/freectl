package stats

import (
	"fmt"

	"freectl/internal/settings"
	"freectl/internal/stats"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var sourceName string

// StatsCmd represents the stats command
var StatsCmd = &cobra.Command{
	Use:   "stats [name]",
	Short: "Show source statistics",
	Long: `Show statistics for a source, including:
- Total size on disk
- Number of files
- Last update time
- Enabled status`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		sourceName = args[0]

		// Get source stats
		sourceStats, err := stats.GetSourceStats(sourceName)
		if err != nil {
			log.Error("Failed to get source stats", "error", err)
			return fmt.Errorf("failed to get source stats: %w", err)
		}

		// Get enabled status
		enabled, err := settings.IsSourceEnabled(sourceName)
		if err != nil {
			log.Error("Failed to get source status", "error", err)
			return fmt.Errorf("failed to get source status: %w", err)
		}

		// Print stats
		log.Info("Source statistics",
			"name", sourceName,
			"size", formatSize(sourceStats.TotalSize),
			"files", sourceStats.FileCount,
			"enabled", enabled)

		return nil
	},
}

// formatSize formats a size in bytes to a human-readable string
func formatSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}

	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}

func init() {
	// Add any flags specific to the stats command here
}

package list

import (
	"fmt"

	"freectl/internal/settings"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

// ListCmd represents the list command
var ListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all sources",
	Long: `List all sources in the cache directory. For each source, shows:
- Name
- URL
- Type
- Last update time
- Size on disk
- Enabled status

Example:
  freectl list`,
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Debug("Starting list command")

		sources, err := settings.ListSources()
		if err != nil {
			log.Error("Failed to list sources", "error", err)
			return fmt.Errorf("failed to list sources: %w", err)
		}

		log.Debug("Successfully retrieved sources", "count", len(sources))

		if len(sources) == 0 {
			fmt.Println("No sources found. Add one using 'freectl add'")
			return nil
		}

		// Calculate maximum widths
		maxName := len("NAME")
		maxURL := len("URL")
		maxType := len("TYPE")
		maxUpdate := len("LAST UPDATED")
		maxSize := len("SIZE")
		maxStatus := len("STATUS")

		// Collect all data first to calculate widths
		type sourceData struct {
			name       string
			url        string
			sourceType string
			lastUpdate string
			size       string
			status     string
		}
		sourceDataList := make([]sourceData, 0, len(sources))

		for _, source := range sources {
			// Get status
			status := "Enabled"
			if !source.Enabled {
				status = "Disabled"
			}

			// Store data and update max widths
			data := sourceData{
				name:       source.Name,
				url:        source.URL,
				sourceType: string(source.Type),
				lastUpdate: source.LastUpdated,
				size:       source.Size,
				status:     status,
			}
			sourceDataList = append(sourceDataList, data)

			if len(source.Name) > maxName {
				maxName = len(source.Name)
			}
			if len(source.URL) > maxURL {
				maxURL = len(source.URL)
			}
			if len(string(source.Type)) > maxType {
				maxType = len(string(source.Type))
			}
			if len(source.LastUpdated) > maxUpdate {
				maxUpdate = len(source.LastUpdated)
			}
			if len(source.Size) > maxSize {
				maxSize = len(source.Size)
			}
			if len(status) > maxStatus {
				maxStatus = len(status)
			}
		}

		// Add padding
		maxName += 3
		maxURL += 3
		maxType += 3
		maxUpdate += 3
		maxSize += 3
		maxStatus += 3

		// Print table header
		fmt.Printf("%-*s %-*s %-*s %-*s %-*s %-*s\n",
			maxName, "NAME",
			maxURL, "URL",
			maxType, "TYPE",
			maxUpdate, "LAST UPDATED",
			maxSize, "SIZE",
			maxStatus, "STATUS")

		// Print each source
		for _, data := range sourceDataList {
			fmt.Printf("%-*s %-*s %-*s %-*s %-*s %-*s\n",
				maxName, data.name,
				maxURL, data.url,
				maxType, data.sourceType,
				maxUpdate, data.lastUpdate,
				maxSize, data.size,
				maxStatus, data.status)
		}

		log.Debug("List command completed successfully")
		return nil
	},
}

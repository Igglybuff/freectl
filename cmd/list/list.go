package list

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"freectl/internal/config"
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
		log.Debug("Using cache directory", "path", config.CacheDir)

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
		maxUpdate := len("LAST UPDATE")
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
			// Get last commit time for Git sources
			lastUpdate := "unknown"
			if source.Type == "git" {
				cmd := exec.Command("git", "-C", source.Path, "log", "-1", "--format=%ct")
				if output, err := cmd.Output(); err == nil {
					if unix, err := strconv.ParseInt(strings.TrimSpace(string(output)), 10, 64); err == nil {
						lastUpdate = time.Unix(unix, 0).Format("2006-01-02 15:04:05")
					}
				}
			}

			// Get source size
			var size int64
			err := filepath.Walk(source.Path, func(_ string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if !info.IsDir() {
					size += info.Size()
				}
				return nil
			})
			if err != nil {
				log.Error("Error calculating source size", "source", source.Name, "error", err)
			}

			// Format size
			sizeStr := "unknown"
			if size > 0 {
				sizeStr = formatSize(size)
			}

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
				lastUpdate: lastUpdate,
				size:       sizeStr,
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
			if len(lastUpdate) > maxUpdate {
				maxUpdate = len(lastUpdate)
			}
			if len(sizeStr) > maxSize {
				maxSize = len(sizeStr)
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
			maxUpdate, "LAST UPDATE",
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

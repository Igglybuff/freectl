package list

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var ListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all cached repositories",
	Long: `List all repositories that are currently cached locally.
For each repository, shows:
- Name
- URL
- Last update time
- Size on disk

Example:
  freectl list`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cacheDir, _ := cmd.Flags().GetString("cache-dir")

		// Get list of repositories
		repos, err := common.ListRepositories(cacheDir)
		if err != nil {
			return fmt.Errorf("failed to get repositories: %w", err)
		}

		if len(repos) == 0 {
			fmt.Println("No repositories found. Add one using 'freectl add'")
			return nil
		}

		// Calculate maximum widths
		maxName := len("NAME")
		maxURL := len("URL")
		maxUpdate := len("LAST UPDATE")
		maxSize := len("SIZE")

		// Collect all data first to calculate widths
		type repoData struct {
			name       string
			url        string
			lastUpdate string
			size       string
		}
		repoDataList := make([]repoData, 0, len(repos))

		for _, repo := range repos {
			// Get last commit time
			lastUpdate := "unknown"
			cmd := exec.Command("git", "-C", repo.Path, "log", "-1", "--format=%ct")
			if output, err := cmd.Output(); err == nil {
				if unix, err := strconv.ParseInt(strings.TrimSpace(string(output)), 10, 64); err == nil {
					lastUpdate = time.Unix(unix, 0).Format("2006-01-02 15:04:05")
				}
			}

			// Get repository size
			var size int64
			err := filepath.Walk(repo.Path, func(_ string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if !info.IsDir() {
					size += info.Size()
				}
				return nil
			})
			if err != nil {
				log.Error("Error calculating repository size", "repository", repo.Name, "error", err)
			}

			// Format size
			sizeStr := "unknown"
			if size > 0 {
				sizeStr = formatSize(size)
			}

			// Store data and update max widths
			data := repoData{
				name:       repo.Name,
				url:        repo.URL,
				lastUpdate: lastUpdate,
				size:       sizeStr,
			}
			repoDataList = append(repoDataList, data)

			if len(repo.Name) > maxName {
				maxName = len(repo.Name)
			}
			if len(repo.URL) > maxURL {
				maxURL = len(repo.URL)
			}
			if len(lastUpdate) > maxUpdate {
				maxUpdate = len(lastUpdate)
			}
			if len(sizeStr) > maxSize {
				maxSize = len(sizeStr)
			}
		}

		// Add padding
		maxName += 3
		maxURL += 3
		maxUpdate += 3
		maxSize += 3

		// Print table header
		fmt.Printf("%-*s %-*s %-*s %-*s\n", maxName, "NAME", maxURL, "URL", maxUpdate, "LAST UPDATE", maxSize, "SIZE")

		// Print each repository
		for _, data := range repoDataList {
			fmt.Printf("%-*s %-*s %-*s %-*s\n",
				maxName, data.name,
				maxURL, data.url,
				maxUpdate, data.lastUpdate,
				maxSize, data.size)
		}

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

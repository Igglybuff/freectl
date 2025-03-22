package stats

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

type CategoryStats struct {
	Name      string
	LinkCount int
}

type Stats struct {
	TotalFiles    int
	TotalLinks    int
	TotalSize     int64
	Categories    []CategoryStats
	DomainsCount  map[string]int
	ProtocolStats map[string]int
	mu            sync.Mutex
}

var StatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show statistics about the FMHY repository",
	Long: `Display statistics about the FMHY repository content.
Shows information like:
- Total number of files
- Total number of links
- Size of the repository
- Links per category
- Most common domains
- Protocol usage (http vs https)

Example:
  freectl stats
  freectl stats --cache-dir /path/to/cache`,
	Run: func(cmd *cobra.Command, args []string) {
		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		repoPath := common.GetRepoPath(cacheDir)
		docsPath := filepath.Join(repoPath, "docs")

		stats := &Stats{
			DomainsCount:  make(map[string]int),
			ProtocolStats: make(map[string]int),
		}

		entries, err := os.ReadDir(docsPath)
		if err != nil {
			log.Fatal("Error reading docs directory", "error", err)
		}

		stats.TotalFiles = len(entries)
		var wg sync.WaitGroup

		// Process each file in parallel
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}

			wg.Add(1)
			go func(entry os.DirEntry) {
				defer wg.Done()
				path := filepath.Join(docsPath, entry.Name())
				processFile(path, stats)
			}(entry)
		}

		wg.Wait()
		sortAndPrintStats(stats)
	},
}

func processFile(path string, stats *Stats) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		return
	}

	stats.mu.Lock()
	stats.TotalSize += info.Size()
	stats.mu.Unlock()

	var currentCategory string
	lines := strings.Split(string(content), "\n")

	for _, line := range lines {
		// Track categories
		if strings.HasPrefix(line, "# ") {
			currentCategory = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
			continue
		}
		if strings.HasPrefix(line, "## ") {
			currentCategory = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
			continue
		}

		// Look for URLs
		if strings.Contains(line, "http") || strings.Contains(line, "www.") {
			if url := common.ExtractURL(line); url != "" {
				stats.mu.Lock()
				stats.TotalLinks++

				// Update category stats
				found := false
				for i := range stats.Categories {
					if stats.Categories[i].Name == currentCategory {
						stats.Categories[i].LinkCount++
						found = true
						break
					}
				}
				if !found {
					stats.Categories = append(stats.Categories, CategoryStats{
						Name:      currentCategory,
						LinkCount: 1,
					})
				}

				// Extract and count domains
				domain := common.ExtractDomain(url)
				if domain != "" {
					stats.DomainsCount[domain]++
				}

				// Count protocols
				if strings.HasPrefix(url, "https://") {
					stats.ProtocolStats["https"]++
				} else if strings.HasPrefix(url, "http://") {
					stats.ProtocolStats["http"]++
				}
				stats.mu.Unlock()
			}
		}
	}
}

func sortAndPrintStats(stats *Stats) {
	// Sort categories by link count
	sort.Slice(stats.Categories, func(i, j int) bool {
		return stats.Categories[i].LinkCount > stats.Categories[j].LinkCount
	})

	// Get top domains
	type domainCount struct {
		domain string
		count  int
	}
	domains := make([]domainCount, 0, len(stats.DomainsCount))
	for domain, count := range stats.DomainsCount {
		domains = append(domains, domainCount{domain, count})
	}
	sort.Slice(domains, func(i, j int) bool {
		return domains[i].count > domains[j].count
	})

	// Print statistics
	fmt.Printf("\n📊 FMHY Repository Statistics\n")
	fmt.Printf("===========================\n\n")

	fmt.Printf("📁 General Stats:\n")
	fmt.Printf("  • Total Files: %d\n", stats.TotalFiles)
	fmt.Printf("  • Total Links: %d\n", stats.TotalLinks)
	fmt.Printf("  • Repository Size: %.2f MB\n\n", float64(stats.TotalSize)/(1024*1024))

	fmt.Printf("🔗 Protocol Usage:\n")
	fmt.Printf("  • HTTPS: %d (%.1f%%)\n", stats.ProtocolStats["https"], float64(stats.ProtocolStats["https"])*100/float64(stats.TotalLinks))
	fmt.Printf("  • HTTP: %d (%.1f%%)\n\n", stats.ProtocolStats["http"], float64(stats.ProtocolStats["http"])*100/float64(stats.TotalLinks))

	fmt.Printf("📚 Top Categories:\n")
	for i, cat := range stats.Categories {
		if i >= 10 {
			break
		}
		fmt.Printf("  • %s: %d links\n", cat.Name, cat.LinkCount)
	}
	fmt.Printf("\n")

	fmt.Printf("🌐 Top Domains:\n")
	for i, d := range domains {
		if i >= 10 {
			break
		}
		fmt.Printf("  • %s: %d links\n", d.domain, d.count)
	}
	fmt.Printf("\n")
}

func init() {
	// Add any flags specific to the stats command here
}

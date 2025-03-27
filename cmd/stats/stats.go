package stats

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"freectl/internal/repository"
	internalStats "freectl/internal/stats"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var StatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show statistics about cached repositories",
	Long: `Display statistics about the cached repositories content.
This includes information about categories, links, and other metadata.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		repoName, _ := cmd.Flags().GetString("repo")
		if repoName == "" {
			return fmt.Errorf("repository name is required")
		}
		repoPath := repository.GetRepoPath(cacheDir, repoName)
		docsPath := filepath.Join(repoPath, "docs")

		s := &internalStats.Stats{
			DomainsCount:  make(map[string]int),
			ProtocolStats: make(map[string]int),
		}

		entries, err := os.ReadDir(docsPath)
		if err != nil {
			log.Fatal("Error reading docs directory", "error", err)
		}

		s.TotalFiles = len(entries)
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
				s.ProcessFile(path)
			}(entry)
		}

		wg.Wait()
		sortAndPrintStats(s)
		return nil
	},
}

func sortAndPrintStats(s *internalStats.Stats) {
	// Sort categories by link count
	sort.Slice(s.Categories, func(i, j int) bool {
		return s.Categories[i].LinkCount > s.Categories[j].LinkCount
	})

	// Get top domains
	type domainCount struct {
		domain string
		count  int
	}
	domains := make([]domainCount, 0, len(s.DomainsCount))
	for domain, count := range s.DomainsCount {
		domains = append(domains, domainCount{domain, count})
	}
	sort.Slice(domains, func(i, j int) bool {
		return domains[i].count > domains[j].count
	})

	// Print statistics
	fmt.Printf("\n📊 Repository Statistics\n")
	fmt.Printf("===========================\n\n")

	fmt.Printf("📁 General Stats:\n")
	fmt.Printf("  • Total Files: %d\n", s.TotalFiles)
	fmt.Printf("  • Total Links: %d\n", s.TotalLinks)
	fmt.Printf("  • Repository Size: %.2f MB\n\n", float64(s.TotalSize)/(1024*1024))

	fmt.Printf("🔗 Protocol Usage:\n")
	fmt.Printf("  • HTTPS: %d (%.1f%%)\n", s.ProtocolStats["https"], float64(s.ProtocolStats["https"])*100/float64(s.TotalLinks))
	fmt.Printf("  • HTTP: %d (%.1f%%)\n\n", s.ProtocolStats["http"], float64(s.ProtocolStats["http"])*100/float64(s.TotalLinks))

	fmt.Printf("📚 Top Categories:\n")
	for i, cat := range s.Categories {
		if i >= 12 {
			break
		}
		fmt.Printf("  • %s: %d links\n", cat.Name, cat.LinkCount)
	}
	fmt.Printf("\n")

	fmt.Printf("🌐 Top Domains:\n")
	for i, d := range domains {
		if i >= 12 {
			break
		}
		fmt.Printf("  • %s: %d links\n", d.domain, d.count)
	}
	fmt.Printf("\n")
}

func init() {
	// Add any flags specific to the stats command here
}

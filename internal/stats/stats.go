package stats

import (
	"os"
	"strings"
	"sync"

	"freectl/internal/common"
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

func (s *Stats) ProcessFile(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		return
	}

	s.mu.Lock()
	s.TotalSize += info.Size()
	s.mu.Unlock()

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
				s.mu.Lock()
				s.TotalLinks++

				// Update category stats
				found := false
				for i := range s.Categories {
					if s.Categories[i].Name == currentCategory {
						s.Categories[i].LinkCount++
						found = true
						break
					}
				}
				if !found {
					s.Categories = append(s.Categories, CategoryStats{
						Name:      currentCategory,
						LinkCount: 1,
					})
				}

				// Extract and count domains
				domain := common.ExtractDomain(url)
				if domain != "" {
					s.DomainsCount[domain]++
				}

				// Count protocols
				if strings.HasPrefix(url, "https://") {
					s.ProtocolStats["https"]++
				} else if strings.HasPrefix(url, "http://") {
					s.ProtocolStats["http"]++
				}
				s.mu.Unlock()
			}
		}
	}
}

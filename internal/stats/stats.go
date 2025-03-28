package stats

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"freectl/internal/common"
	"freectl/internal/settings"
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

// SourceStats represents basic statistics for a source
type SourceStats struct {
	TotalSize int64
	FileCount int64
}

// GetSourceStats returns basic statistics for a source
func GetSourceStats(name string) (*SourceStats, error) {
	settings, err := settings.LoadSettings()
	if err != nil {
		return nil, err
	}

	// Find the source in settings
	var sourcePath string
	for _, source := range settings.Sources {
		if source.Name == name {
			sourcePath = source.Path
			break
		}
	}

	if sourcePath == "" {
		return nil, fmt.Errorf("source '%s' not found in settings", name)
	}

	stats := &SourceStats{}
	err = filepath.Walk(sourcePath, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			stats.TotalSize += info.Size()
			stats.FileCount++
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to calculate source stats: %w", err)
	}

	return stats, nil
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
			category := common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
			if !common.IsInvalidCategory(category) {
				currentCategory = category
			}
			continue
		}
		if strings.HasPrefix(line, "## ") {
			category := common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
			if !common.IsInvalidCategory(category) {
				currentCategory = category
			}
			continue
		}

		// Look for URLs
		if strings.Contains(line, "http") || strings.Contains(line, "www.") {
			if url := common.ExtractURL(line); url != "" {
				s.mu.Lock()
				s.TotalLinks++

				// Update category stats
				if currentCategory != "" {
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

package search

import (
	"fmt"
	"sort"
	"strings"

	"freectl/internal/preprocessing"
	"freectl/internal/settings"

	"github.com/charmbracelet/log"
	"github.com/sahilm/fuzzy"
)

// SearchPreprocessed performs search on preprocessed JSON data instead of parsing markdown in real-time
func SearchPreprocessed(query string, sourceName string, s settings.Settings, limit int) ([]Result, error) {
	// Get storage for processed data
	storage := preprocessing.NewFileStorage(s.CacheDir + "/processed")

	// Get list of processed sources
	processedSources, err := storage.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list processed sources: %w", err)
	}

	if len(processedSources) == 0 {
		return nil, fmt.Errorf("no processed sources found. Run 'freectl process' first")
	}

	log.Info("Found processed sources", "count", len(processedSources))

	// Filter by source name if specified
	if sourceName != "" {
		var found bool
		for _, name := range processedSources {
			if name == sourceName || strings.EqualFold(name, sourceName) {
				processedSources = []string{name}
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("processed source '%s' not found", sourceName)
		}
	}

	// Load all requested sources
	var allItems []SearchableItem
	for _, sourceName := range processedSources {
		processed, err := storage.Load(sourceName)
		if err != nil {
			log.Error("Failed to load processed source", "name", sourceName, "error", err)
			continue
		}

		// Convert preprocessed items to searchable items
		for _, item := range processed.Items {
			searchableItem := SearchableItem{
				URL:         item.URL,
				Name:        item.Name,
				Description: item.Description,
				Category:    item.Category,
				Source:      processed.Source.Name,
				Tags:        item.Tags,
				RawText:     item.RawText,
			}
			allItems = append(allItems, searchableItem)
		}
	}

	if len(allItems) == 0 {
		return nil, fmt.Errorf("no items found in processed sources")
	}

	log.Info("Loaded items for search", "total", len(allItems))

	// Perform fuzzy search
	results := performFuzzySearch(query, allItems, s, limit)

	log.Info("Search completed", "query", query, "results", len(results))
	return results, nil
}

// SearchableItem represents an item that can be searched
type SearchableItem struct {
	URL         string   `json:"url"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Source      string   `json:"source"`
	Tags        []string `json:"tags"`
	RawText     string   `json:"raw_text"`
}

// performFuzzySearch executes fuzzy search on the items
func performFuzzySearch(query string, items []SearchableItem, s settings.Settings, limit int) []Result {
	// Create searchable strings for each item
	searchStrings := make([]string, len(items))
	for i, item := range items {
		// Combine name, description, and tags for searching
		searchText := fmt.Sprintf("%s %s %s", item.Name, item.Description, strings.Join(item.Tags, " "))
		searchStrings[i] = searchText
	}

	// Perform fuzzy search
	matches := fuzzy.Find(query, searchStrings)

	// Convert matches to results
	var results []Result
	for _, match := range matches {
		if match.Score < s.MinFuzzyScore {
			continue
		}

		item := items[match.Index]
		result := Result{
			URL:         item.URL,
			Name:        item.Name,
			Description: item.Description,
			Category:    item.Category,
			Source:      item.Source,
			Tags:        item.Tags,
			Score:       match.Score,
		}
		results = append(results, result)
	}

	// Sort results by score (highest first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	// Normalize scores to 0-100 scale
	if len(results) > 0 {
		maxScore := results[0].Score
		for i := range results {
			results[i].Score = int((float64(results[i].Score) / float64(maxScore)) * 100)
		}
	}

	// Apply limit from command line if specified, otherwise use settings
	if limit > 0 && len(results) > limit {
		results = results[:limit]
	} else if limit == 0 && s.ResultsPerPage > 0 && len(results) > s.ResultsPerPage {
		results = results[:s.ResultsPerPage]
	}

	return results
}

// SearchPreprocessedAdvanced performs advanced search with filters
func SearchPreprocessedAdvanced(query string, filters SearchFilters, s settings.Settings) ([]Result, error) {
	// Get storage for processed data
	storage := preprocessing.NewFileStorage(s.CacheDir + "/processed")

	// Get list of processed sources
	processedSources, err := storage.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list processed sources: %w", err)
	}

	if len(processedSources) == 0 {
		return nil, fmt.Errorf("no processed sources found. Run 'freectl process' first")
	}

	// Filter sources based on filters
	if len(filters.Sources) > 0 {
		var filteredSources []string
		for _, sourceName := range processedSources {
			for _, filterSource := range filters.Sources {
				if strings.EqualFold(sourceName, filterSource) {
					filteredSources = append(filteredSources, sourceName)
					break
				}
			}
		}
		processedSources = filteredSources
	}

	// Load and filter items
	var allItems []SearchableItem
	for _, sourceName := range processedSources {
		processed, err := storage.Load(sourceName)
		if err != nil {
			log.Error("Failed to load processed source", "name", sourceName, "error", err)
			continue
		}

		// Convert and filter preprocessed items
		for _, item := range processed.Items {
			// Apply category filter
			if len(filters.Categories) > 0 {
				matchesCategory := false
				for _, filterCategory := range filters.Categories {
					if strings.Contains(strings.ToLower(item.Category), strings.ToLower(filterCategory)) {
						matchesCategory = true
						break
					}
				}
				if !matchesCategory {
					continue
				}
			}

			// Apply tag filter
			if len(filters.Tags) > 0 {
				matchesTag := false
				for _, filterTag := range filters.Tags {
					for _, itemTag := range item.Tags {
						if strings.EqualFold(itemTag, filterTag) {
							matchesTag = true
							break
						}
					}
					if matchesTag {
						break
					}
				}
				if !matchesTag {
					continue
				}
			}

			searchableItem := SearchableItem{
				URL:         item.URL,
				Name:        item.Name,
				Description: item.Description,
				Category:    item.Category,
				Source:      processed.Source.Name,
				Tags:        item.Tags,
				RawText:     item.RawText,
			}
			allItems = append(allItems, searchableItem)
		}
	}

	if len(allItems) == 0 {
		return []Result{}, nil
	}

	// Perform fuzzy search (no limit for advanced search)
	results := performFuzzySearch(query, allItems, s, 0)

	return results, nil
}

// SearchFilters represents search filtering options
type SearchFilters struct {
	Sources    []string `json:"sources,omitempty"`
	Categories []string `json:"categories,omitempty"`
	Tags       []string `json:"tags,omitempty"`
	MinScore   int      `json:"min_score,omitempty"`
}

// GetProcessedSources returns a list of all processed source names
func GetProcessedSources(cacheDir string) ([]string, error) {
	storage := preprocessing.NewFileStorage(cacheDir + "/processed")
	return storage.List()
}

// GetSourceStatistics returns statistics about processed sources
func GetSourceStatistics(cacheDir string) (map[string]SourceStats, error) {
	storage := preprocessing.NewFileStorage(cacheDir + "/processed")

	processedSources, err := storage.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list processed sources: %w", err)
	}

	stats := make(map[string]SourceStats)

	for _, sourceName := range processedSources {
		processed, err := storage.Load(sourceName)
		if err != nil {
			log.Error("Failed to load processed source", "name", sourceName, "error", err)
			continue
		}

		// Count categories and tags
		categories := make(map[string]int)
		tags := make(map[string]int)

		for _, item := range processed.Items {
			if item.Category != "" {
				categories[item.Category]++
			}
			for _, tag := range item.Tags {
				tags[tag]++
			}
		}

		stats[sourceName] = SourceStats{
			Name:        processed.Source.Name,
			Type:        processed.Source.Type,
			ItemCount:   len(processed.Items),
			ProcessedAt: processed.Source.ProcessedAt,
			Categories:  categories,
			Tags:        tags,
			ErrorCount:  len(processed.Source.Errors),
		}
	}

	return stats, nil
}

// SourceStats represents statistics for a processed source
type SourceStats struct {
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	ItemCount   int            `json:"item_count"`
	ProcessedAt interface{}    `json:"processed_at"` // time.Time from preprocessing
	Categories  map[string]int `json:"categories"`
	Tags        map[string]int `json:"tags"`
	ErrorCount  int            `json:"error_count"`
}

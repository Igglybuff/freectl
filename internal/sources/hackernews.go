package sources

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/charmbracelet/log"
)

// Default URL for HackerNews data
var hnDataURL = "https://hn-popularity.cdn.refactoringenglish.com/hn-data.csv"
var hnMetaURL = "https://hn-popularity.cdn.refactoringenglish.com/domains-meta.csv"

type hnEntry struct {
	Domain string
	Score  int
}

type hnMeta struct {
	Domain string
	Author string
	Bio    string
	Topics string
}

// AddHN5000 adds the HackerNews top 5000 blogs as a data source
func AddHN5000(cacheDir string, source Source) error {
	// Create source directory
	sourceDir := filepath.Join(cacheDir, SanitizePath(source.Name))
	if err := os.MkdirAll(sourceDir, 0755); err != nil {
		return fmt.Errorf("failed to create source directory: %w", err)
	}

	// Fetch main CSV data
	resp, err := http.Get(hnDataURL)
	if err != nil {
		return fmt.Errorf("failed to fetch HN data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch HN data: HTTP %d", resp.StatusCode)
	}

	// Fetch metadata CSV
	metaResp, err := http.Get(hnMetaURL)
	if err != nil {
		return fmt.Errorf("failed to fetch HN metadata: %w", err)
	}
	defer metaResp.Body.Close()

	if metaResp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch HN metadata: HTTP %d", metaResp.StatusCode)
	}

	// Parse main CSV
	reader := csv.NewReader(resp.Body)
	reader.Read() // Skip header

	// Parse metadata CSV
	metaReader := csv.NewReader(metaResp.Body)
	metaReader.Read() // Skip header

	// Read all metadata entries
	metaMap := make(map[string]hnMeta)
	for {
		record, err := metaReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read metadata CSV: %w", err)
		}
		if len(record) >= 4 {
			metaMap[record[0]] = hnMeta{
				Domain: record[0],
				Author: record[1],
				Bio:    record[2],
				Topics: record[3],
			}
		}
	}

	// Read and process main CSV entries
	var entries []hnEntry
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read CSV: %w", err)
		}
		if len(record) >= 2 {
			score, err := strconv.Atoi(record[1])
			if err != nil {
				continue
			}
			entries = append(entries, hnEntry{
				Domain: record[0],
				Score:  score,
			})
		}
	}

	// Generate markdown content
	var content strings.Builder
	content.WriteString("# HackerNews Top 5000 Blogs\n\n")
	content.WriteString("This list contains the top 5000 most popular blogs and websites from HackerNews.\n\n")
	content.WriteString("## Sources\n\n")
	content.WriteString("- [HackerNews Top 5000](https://refactoringenglish.com/tools/hn-popularity/)\n\n")
	content.WriteString("## Links\n\n")

	// Write entries with metadata
	for _, entry := range entries {
		meta, hasMeta := metaMap[entry.Domain]
		url := fmt.Sprintf("https://%s", entry.Domain)

		if hasMeta {
			// Format description with metadata
			description := fmt.Sprintf("%s is %d on the top 5000 HackerNews blogs by %s. %s - %s",
				entry.Domain, entry.Score, meta.Author, meta.Bio, meta.Topics)
			content.WriteString(fmt.Sprintf("- [%s](%s) - %s\n", entry.Domain, url, description))
		} else {
			// Fallback to basic description if no metadata
			content.WriteString(fmt.Sprintf("- [%s](%s) - Ranked %d on the top 5000 HackerNews blogs\n",
				entry.Domain, url, entry.Score))
		}
	}

	// Write to file
	outputFile := filepath.Join(sourceDir, "hn5000.md")
	if err := os.WriteFile(outputFile, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("failed to write markdown file: %w", err)
	}

	log.Info("Added HackerNews top 5000 source", "entries", len(entries))
	return nil
}

// UpdateHN5000 updates the HackerNews top 5000 source
func UpdateHN5000(cacheDir string, source Source) error {
	return AddHN5000(cacheDir, source)
}

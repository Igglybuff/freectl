package sources

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/charmbracelet/log"
)

// AddRedditWiki adds a Reddit Wiki as a source
func AddRedditWiki(cacheDir string, source Source) error {
	if source.URL == "" {
		return fmt.Errorf("reddit wiki source requires a URL")
	}

	// Create a directory for the wiki content
	wikiDir := filepath.Join(cacheDir, source.Name)
	if err := os.MkdirAll(wikiDir, 0755); err != nil {
		return fmt.Errorf("failed to create wiki directory: %w", err)
	}

	// Ensure URL is using old.reddit.com
	url := source.URL
	if !strings.Contains(url, "old.reddit.com") {
		// Handle both www.reddit.com and reddit.com cases in one replacement
		url = strings.NewReplacer(
			"www.reddit.com", "old.reddit.com",
			"reddit.com", "old.reddit.com",
		).Replace(url)
		log.Debug("Converted URL to old.reddit.com", "original", source.URL, "converted", url)
	}

	// Create HTTP client and request
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set User-Agent to avoid 429 responses
	req.Header.Set("User-Agent", "freectl/1.0")

	// Fetch the wiki page
	log.Info("Fetching Reddit wiki", "url", url)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch wiki: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch wiki: HTTP %d", resp.StatusCode)
	}

	// Parse HTML
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to parse wiki HTML: %w", err)
	}

	// Find the markdown content
	var markdown string
	doc.Find("textarea.source").Each(func(i int, s *goquery.Selection) {
		markdown = s.Text()
	})

	if markdown == "" {
		return fmt.Errorf("no markdown content found in wiki")
	}

	// Save markdown to file
	outputPath := filepath.Join(wikiDir, "wiki.md")
	if err := os.WriteFile(outputPath, []byte(markdown), 0644); err != nil {
		return fmt.Errorf("failed to save wiki content: %w", err)
	}

	log.Info("Successfully saved Reddit wiki",
		"url", url,
		"path", outputPath,
		"size", len(markdown))

	return nil
}

// UpdateRedditWiki updates a Reddit Wiki source
func UpdateRedditWiki(cacheDir string, source Source) error {
	// For Reddit wikis, updating is the same as adding
	return AddRedditWiki(cacheDir, source)
}

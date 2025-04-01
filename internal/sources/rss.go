package sources

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/charmbracelet/log"
	"github.com/mmcdole/gofeed"
)

// AddRSS adds an RSS feed as a source
func AddRSS(cacheDir string, source Source) error {
	if source.URL == "" {
		return fmt.Errorf("RSS source requires a URL")
	}

	// Create source directory
	sourceDir := filepath.Join(cacheDir, SanitizePath(source.Name))
	if err := os.MkdirAll(sourceDir, 0755); err != nil {
		return fmt.Errorf("failed to create source directory: %w", err)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Fetch the RSS feed
	resp, err := client.Get(source.URL)
	if err != nil {
		return fmt.Errorf("failed to fetch RSS feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch RSS feed: HTTP %d", resp.StatusCode)
	}

	// Read the feed content
	feedData, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read RSS feed: %w", err)
	}

	// Parse the feed
	fp := gofeed.NewParser()
	feed, err := fp.ParseString(string(feedData))
	if err != nil {
		return fmt.Errorf("failed to parse RSS feed: %w", err)
	}

	// Generate markdown content
	var content strings.Builder
	content.WriteString(fmt.Sprintf("# %s\n\n", feed.Title))
	if feed.Description != "" {
		content.WriteString(fmt.Sprintf("%s\n\n", feed.Description))
	}

	// Add the feed's website as a result
	if feed.Link != "" {
		content.WriteString("## Feed Website\n\n")
		content.WriteString(fmt.Sprintf("- [%s](%s) - The website for this RSS feed\n\n", feed.Title, feed.Link))
	}

	// Add feed items
	content.WriteString("## Feed Items\n\n")
	for _, item := range feed.Items {
		// Add the item itself
		content.WriteString(fmt.Sprintf("### %s\n\n", item.Title))
		if item.Description != "" {
			content.WriteString(fmt.Sprintf("%s\n\n", item.Description))
		}
		if item.Link != "" {
			content.WriteString(fmt.Sprintf("- [Read full article](%s)\n", item.Link))
		}
		if item.Published != "" {
			content.WriteString(fmt.Sprintf("- Published: %s\n", item.Published))
		}
		content.WriteString("\n")

		// Extract and add links from the content
		if item.Content != "" {
			content.WriteString("#### Links from this item\n\n")
			// Use goquery to parse HTML content and extract links
			doc, err := goquery.NewDocumentFromReader(strings.NewReader(item.Content))
			if err == nil {
				doc.Find("a").Each(func(i int, s *goquery.Selection) {
					if href, exists := s.Attr("href"); exists {
						text := s.Text()
						if text == "" {
							text = href
						}
						content.WriteString(fmt.Sprintf("- [%s](%s)\n", text, href))
					}
				})
			}
			content.WriteString("\n")
		}
	}

	// Write to file
	outputFile := filepath.Join(sourceDir, "feed.md")
	if err := os.WriteFile(outputFile, []byte(content.String()), 0644); err != nil {
		return fmt.Errorf("failed to write markdown file: %w", err)
	}

	log.Info("Added RSS feed source", "title", feed.Title, "items", len(feed.Items))
	return nil
}

// UpdateRSS updates an RSS feed source
func UpdateRSS(cacheDir string, source Source) error {
	return AddRSS(cacheDir, source)
}

package sources

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	htmltomarkdown "github.com/JohannesKaufmann/html-to-markdown/v2"
	"github.com/charmbracelet/log"
)

// AddHTML adds an HTML page as a source
func AddHTML(cacheDir string, source Source) error {
	if source.URL == "" {
		return fmt.Errorf("html source requires a URL")
	}

	// Create a directory for the HTML content using sanitized name
	htmlDir := filepath.Join(cacheDir, SanitizePath(source.Name))
	if err := os.MkdirAll(htmlDir, 0755); err != nil {
		return fmt.Errorf("failed to create html directory: %w", err)
	}

	// Create HTTP client and request
	client := &http.Client{}
	req, err := http.NewRequest("GET", source.URL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set User-Agent to avoid 429 responses
	req.Header.Set("User-Agent", "freectl/1.0")

	// Fetch the HTML page
	log.Info("Fetching HTML page", "url", source.URL)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch HTML: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch HTML: HTTP %d", resp.StatusCode)
	}

	// Read HTML content
	html, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read HTML content: %w", err)
	}

	// Convert HTML to Markdown
	markdown, err := htmltomarkdown.ConvertString(string(html))
	if err != nil {
		return fmt.Errorf("failed to convert HTML to markdown: %w", err)
	}

	// Save markdown to file
	outputPath := filepath.Join(htmlDir, "content.md")
	if err := os.WriteFile(outputPath, []byte(markdown), 0644); err != nil {
		return fmt.Errorf("failed to save HTML content: %w", err)
	}

	log.Info("Successfully saved HTML content",
		"url", source.URL,
		"path", outputPath,
		"size", len(markdown))

	return nil
}

// UpdateHTML updates an HTML source
func UpdateHTML(cacheDir string, source Source) error {
	// For HTML pages, updating is the same as adding
	return AddHTML(cacheDir, source)
}

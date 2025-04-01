package sources

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAddRSS(t *testing.T) {
	// Create mock RSS server
	rssServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/rss+xml")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test RSS feed</description>
    <item>
      <title>Test Article 1</title>
      <link>https://example.com/article1</link>
      <description>This is a test article</description>
      <content:encoded><![CDATA[<p>This is the full content of the article with a <a href="https://example.com/link1">link</a>.</p>]]></content:encoded>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Test Article 2</title>
      <link>https://example.com/article2</link>
      <description>Another test article</description>
      <content:encoded><![CDATA[<p>This is another article with a <a href="https://example.com/link2">link</a>.</p>]]></content:encoded>
      <pubDate>Mon, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`))
	}))
	defer rssServer.Close()

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "rsstest")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test adding RSS source
	source := Source{
		Name: "test-rss",
		Type: "rss",
		URL:  rssServer.URL,
	}

	err = AddRSS(tempDir, source)
	if err != nil {
		t.Fatalf("AddRSS failed: %v", err)
	}

	// Check if file was created
	mdFile := filepath.Join(tempDir, "test-rss", "feed.md")
	content, err := os.ReadFile(mdFile)
	if err != nil {
		t.Fatalf("Failed to read markdown file: %v", err)
	}

	// Verify content
	contentStr := string(content)
	if !strings.Contains(contentStr, "# Test Feed") {
		t.Error("Feed title not found in markdown")
	}
	if !strings.Contains(contentStr, "A test RSS feed") {
		t.Error("Feed description not found in markdown")
	}
	if !strings.Contains(contentStr, "## Feed Website") {
		t.Error("Feed website section not found in markdown")
	}
	if !strings.Contains(contentStr, "## Feed Items") {
		t.Error("Feed items section not found in markdown")
	}
	if !strings.Contains(contentStr, "### Test Article 1") {
		t.Error("First article not found in markdown")
	}
	if !strings.Contains(contentStr, "### Test Article 2") {
		t.Error("Second article not found in markdown")
	}
	if !strings.Contains(contentStr, "https://example.com/link1") {
		t.Error("Link from first article not found in markdown")
	}
	if !strings.Contains(contentStr, "https://example.com/link2") {
		t.Error("Link from second article not found in markdown")
	}
}

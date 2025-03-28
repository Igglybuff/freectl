package sources

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAddRedditWiki(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "reddit-wiki-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	testCases := []struct {
		name        string
		url         string
		sourceName  string
		expectError bool
	}{
		{
			name:        "Valid wiki URL",
			url:         "https://www.reddit.com/r/Piracy/wiki/megathread",
			sourceName:  "piracy-mega",
			expectError: false,
		},
		{
			name:        "Already old.reddit URL",
			url:         "https://old.reddit.com/r/selfhosted/wiki/index",
			sourceName:  "selfhosted",
			expectError: false,
		},
		{
			name:        "Empty URL",
			url:         "",
			sourceName:  "empty",
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			source := Source{
				Name: tc.sourceName,
				URL:  tc.url,
				Type: "reddit",
			}

			err := AddRedditWiki(tempDir, source)
			if tc.expectError && err == nil {
				t.Errorf("Expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if err == nil {
				// Check if file was created
				wikiPath := filepath.Join(tempDir, tc.sourceName, "wiki.md")
				if _, err := os.Stat(wikiPath); os.IsNotExist(err) {
					t.Errorf("Expected wiki file at %s but it doesn't exist", wikiPath)
				}

				// Read content to verify it's not empty
				content, err := os.ReadFile(wikiPath)
				if err != nil {
					t.Errorf("Failed to read wiki file: %v", err)
				}
				if len(content) == 0 {
					t.Error("Wiki file is empty")
				}
			}
		})
	}
}

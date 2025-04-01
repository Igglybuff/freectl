package search

import (
	"os"
	"path/filepath"
	"testing"

	"freectl/internal/settings"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/stretchr/testify/assert"
)

func TestSearch(t *testing.T) {
	// Enable debug logging
	log.SetLevel(log.DebugLevel)
	log.Debug("Starting test")

	// Create a temporary test directory
	tmpDir := t.TempDir()
	testSource := sources.Source{
		Name:    "test",
		Path:    tmpDir,
		Enabled: true,
	}
	log.Debug("Created test source", "name", testSource.Name, "path", testSource.Path)

	// Create test markdown file with triple heading and list
	testContent := `### Koala
* [Koala](https://koala.com/)

#### Kangaroo
* [Kangaroo](https://kangaroo.com/)

## [Ostrich](https://ostrich.com/)
### [Tiger](https://tiger.com/)
* [Eagle](https://eagle.com/)
- [Falcon](https://falcon.com/)

## Penguin
* Penguin https://penguin.com/
`
	testFile := filepath.Join(tmpDir, "test.md")
	err := os.WriteFile(testFile, []byte(testContent), 0644)
	assert.NoError(t, err)
	log.Debug("Created test file", "path", testFile)

	// Create test settings
	testSettings := settings.Settings{
		Sources:       []sources.Source{testSource},
		MinFuzzyScore: 0,
	}
	log.Debug("Created test settings")

	// Test cases
	tests := []struct {
		name     string
		query    string
		expected []string
	}{
		{
			name:     "find markdown link under triple heading",
			query:    "koala",
			expected: []string{"https://koala.com/"},
		},
		{
			name:     "find markdown link under quadruple heading",
			query:    "kangaroo",
			expected: []string{"https://kangaroo.com/"},
		},
		{
			name:     "find links in double headings",
			query:    "ostrich",
			expected: []string{"https://ostrich.com/"},
		},
		{
			name:     "find links in triple headings",
			query:    "tiger",
			expected: []string{"https://tiger.com/"},
		},
		{
			name:     "find links in list items - asterisk",
			query:    "eagle",
			expected: []string{"https://eagle.com/"},
		},
		{
			name:     "find links in list items - dash",
			query:    "eagle",
			expected: []string{"https://eagle.com/"},
		},
		{
			name:     "find unformatted/plain text links",
			query:    "penguin",
			expected: []string{"https://penguin.com/"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log.Debug("Running test case", "name", tt.name, "query", tt.query)
			results, err := Search(tt.query, "test", testSettings)
			assert.NoError(t, err)
			assert.NotNil(t, results)

			// Extract URLs from results
			var urls []string
			for _, r := range results {
				urls = append(urls, r.URL)
				log.Debug("Found result", "url", r.URL, "name", r.Name, "score", r.Score)
			}

			// Check if all expected URLs are found
			for _, expected := range tt.expected {
				assert.Contains(t, urls, expected, "Expected URL %s not found in results", expected)
			}
			log.Debug("Test case completed", "name", tt.name, "found_urls", len(urls))
		})
	}
	log.Debug("All tests completed")
}

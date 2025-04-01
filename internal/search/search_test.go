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
	testContent := `### A companies
* [AdRoll](http://tech.adroll.com/blog/)
* [Advanced Web Machinery](https://advancedweb.hu/)

### B companies
* Bad Company https://badcompany.com/
* Better Company https://bettercompany.com/

## [C companies](https://ccompanies.com/)
### [D company](https://dcompany.com/)
* [E company](https://ecompany.com/)
- [F company](https://fcompany.com/)
`
	testFile := filepath.Join(tmpDir, "test.md")
	err := os.WriteFile(testFile, []byte(testContent), 0644)
	assert.NoError(t, err)
	log.Debug("Created test file", "path", testFile)

	// Create test settings
	testSettings := settings.Settings{
		Sources:               []sources.Source{testSource},
		MinFuzzyScore:         0,
		MaxConcurrentSearches: 4, // Set concurrent search limit
	}
	log.Debug("Created test settings", "max_concurrent", testSettings.MaxConcurrentSearches)

	// Test cases
	tests := []struct {
		name     string
		query    string
		expected []string
	}{
		{
			name:     "find markdown link under triple heading",
			query:    "adroll",
			expected: []string{"http://tech.adroll.com/blog/"},
		},
		{
			name:     "find markdown link under triple heading with company name",
			query:    "advanced web",
			expected: []string{"https://advancedweb.hu/"},
		},
		{
			name:     "find plain URL under triple heading",
			query:    "bad company",
			expected: []string{"https://badcompany.com/"},
		},
		{
			name:     "find multiple links under different triple headings",
			query:    "company",
			expected: []string{"https://badcompany.com/", "https://bettercompany.com/"},
		},
		{
			name:     "find links in headings",
			query:    "d company",
			expected: []string{"https://dcompany.com/"},
		},
		{
			name:     "find links in list items",
			query:    "f company",
			expected: []string{"https://fcompany.com/"},
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

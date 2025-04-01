package sources

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAddHTML(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "html-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	tests := []struct {
		name    string
		source  Source
		wantErr bool
	}{
		{
			name: "valid blogroll.org URL",
			source: Source{
				Name: "blogroll",
				URL:  "https://blogroll.org/",
			},
			wantErr: false,
		},
		{
			name: "empty URL",
			source: Source{
				Name: "empty",
				URL:  "",
			},
			wantErr: true,
		},
		{
			name: "invalid URL",
			source: Source{
				Name: "invalid",
				URL:  "not-a-url",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := AddHTML(tmpDir, tt.source)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Check that the markdown file was created
			expectedPath := filepath.Join(tmpDir, SanitizePath(tt.source.Name), "content.md")
			_, err = os.Stat(expectedPath)
			require.NoError(t, err)

			// Read the markdown content
			content, err := os.ReadFile(expectedPath)
			require.NoError(t, err)

			// Basic content checks
			assert.NotEmpty(t, content)
			assert.Contains(t, string(content), "#")    // Should contain headers
			assert.Contains(t, string(content), "http") // Should contain links
		})
	}
}

func TestUpdateHTML(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "html-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	source := Source{
		Name: "blogroll",
		URL:  "https://blogroll.org/",
	}

	// First add the source
	err = AddHTML(tmpDir, source)
	require.NoError(t, err)

	// Get the initial content
	initialPath := filepath.Join(tmpDir, SanitizePath(source.Name), "content.md")
	initialContent, err := os.ReadFile(initialPath)
	require.NoError(t, err)

	// Update the source
	err = UpdateHTML(tmpDir, source)
	require.NoError(t, err)

	// Get the updated content
	updatedContent, err := os.ReadFile(initialPath)
	require.NoError(t, err)

	// Content should be different (since blogroll.org updates regularly)
	assert.NotEqual(t, string(initialContent), string(updatedContent))
}

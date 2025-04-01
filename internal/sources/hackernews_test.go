package sources

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAddHN5000(t *testing.T) {
	// Create mock servers for both CSVs
	dataServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`domain,score,date
example.com,100,2024-03-31
test.org,90,2024-03-31
blog.dev,80,2024-03-31`))
	}))
	defer dataServer.Close()

	metaServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`domain,author name,bio,topics
example.com,John Doe,Software engineer and tech blogger,"Tech,Programming"
test.org,Jane Smith,Open source enthusiast,"Open Source,Linux"`))
	}))
	defer metaServer.Close()

	// Save original URLs and restore after test
	originalDataURL := hnDataURL
	originalMetaURL := hnMetaURL
	defer func() {
		hnDataURL = originalDataURL
		hnMetaURL = originalMetaURL
	}()
	hnDataURL = dataServer.URL
	hnMetaURL = metaServer.URL

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "hn5000test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test adding HN5000 source
	source := Source{
		Name: "test-hn5000",
		Type: "hn5000",
	}

	err = AddHN5000(tempDir, source)
	if err != nil {
		t.Fatalf("AddHN5000 failed: %v", err)
	}

	// Check if file was created
	mdFile := filepath.Join(tempDir, "test-hn5000", "hn5000.md")
	content, err := os.ReadFile(mdFile)
	if err != nil {
		t.Fatalf("Failed to read markdown file: %v", err)
	}

	// Verify content
	contentStr := string(content)
	expectedEntries := []string{
		"# HackerNews Top 5000 Blogs",
		"This list contains the top 5000 most popular blogs and websites from HackerNews.",
		"## Sources",
		"- [HackerNews Top 5000](https://refactoringenglish.com/tools/hn-popularity/)",
		"## Links",
		"- [example.com](https://example.com) - example.com is 100 on the top 5000 HackerNews blogs by John Doe. Software engineer and tech blogger - Tech,Programming",
		"- [test.org](https://test.org) - test.org is 90 on the top 5000 HackerNews blogs by Jane Smith. Open source enthusiast - Open Source,Linux",
		"- [blog.dev](https://blog.dev) - Ranked 80 on the top 5000 HackerNews blogs",
	}

	for _, expected := range expectedEntries {
		if !strings.Contains(contentStr, expected) {
			t.Errorf("Expected content to contain %q, but it didn't", expected)
		}
	}
}

func TestAddHN5000_HTTPError(t *testing.T) {
	// Create mock servers that return errors
	dataServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer dataServer.Close()

	metaServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "text/csv")
		w.Write([]byte(`domain,author name,bio,topics`))
	}))
	defer metaServer.Close()

	// Save original URLs and restore after test
	originalDataURL := hnDataURL
	originalMetaURL := hnMetaURL
	defer func() {
		hnDataURL = originalDataURL
		hnMetaURL = originalMetaURL
	}()
	hnDataURL = dataServer.URL
	hnMetaURL = metaServer.URL

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "hn5000test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test adding HN5000 source
	source := Source{
		Name: "test-hn5000",
		Type: "hn5000",
	}

	err = AddHN5000(tempDir, source)
	if err == nil {
		t.Error("Expected error when data server returns 500, got nil")
	}
}

func TestAddHN5000_InvalidCSV(t *testing.T) {
	// Create mock servers that return invalid CSV
	dataServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`invalid,csv,data,too,many,columns
1,2,3,4,5,6`))
	}))
	defer dataServer.Close()

	metaServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`invalid,csv,data,too,many,columns
1,2,3,4,5,6`))
	}))
	defer metaServer.Close()

	// Save original URLs and restore after test
	originalDataURL := hnDataURL
	originalMetaURL := hnMetaURL
	defer func() {
		hnDataURL = originalDataURL
		hnMetaURL = originalMetaURL
	}()
	hnDataURL = dataServer.URL
	hnMetaURL = metaServer.URL

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "hn5000test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Test adding HN5000 source
	source := Source{
		Name: "test-hn5000",
		Type: "hn5000",
	}

	// This should not return an error as invalid records are skipped
	err = AddHN5000(tempDir, source)
	if err != nil {
		t.Errorf("Expected success with invalid CSV (skipping records), got error: %v", err)
	}

	// Verify that a markdown file was created (even if empty)
	mdFile := filepath.Join(tempDir, "test-hn5000", "hn5000.md")
	if _, err := os.Stat(mdFile); os.IsNotExist(err) {
		t.Error("Expected markdown file to be created even with invalid CSV")
	}
}

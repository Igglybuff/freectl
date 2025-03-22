package search

import (
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"freectl/internal/tui"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/log"
	"github.com/sahilm/fuzzy"
	"github.com/spf13/cobra"
)

type SearchResult struct {
	Link     string
	Line     string
	Score    int
	Category string
}

var SearchCmd = &cobra.Command{
	Use:     "search [query]",
	Aliases: []string{"s"},
	Short:   "Search for links in the FMHY repository",
	Long: `Search through the FMHY repository for links matching the given query.
The search uses fuzzy matching to find relevant results, so you don't need to type exact matches.

The search will:
1. Look through all markdown files in the repository
2. Find lines containing URLs (http://, https://, or www.)
3. Use fuzzy matching to find relevant results
4. Sort results by relevance score
5. Display the results in an interactive terminal UI

By default, only the top 10 results are shown. Use --limit to show more results.

Controls:
  ? - Toggle help menu
  q - Quit
  ↑/↓ - Navigate results
  enter - Select result

Examples:
  # Search for torrent sites (shows top 10 results)
  freectl search "torrent"
  freectl s "torrent"

  # Search for streaming services with 20 results
  freectl search --limit 20 "streaming"

  # Search with multiple words
  freectl search "free movies streaming"

  # Search in a custom cache directory
  freectl search --cache-dir /path/to/cache "torrent"`,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 1 {
			log.Fatal("Please provide a search query")
		}
		query := strings.Join(args, " ")
		limit, _ := cmd.Flags().GetInt("limit")

		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		// Expand the ~ to the user's home directory
		if cacheDir[:2] == "~/" {
			home, err := os.UserHomeDir()
			if err != nil {
				log.Fatal("Failed to get home directory", "error", err)
			}
			cacheDir = filepath.Join(home, cacheDir[2:])
		}

		repoPath := filepath.Join(cacheDir, "FMHY")
		if _, err := os.Stat(repoPath); os.IsNotExist(err) {
			log.Fatal("Repository not found. Please run 'freectl update' first")
		}

		docsPath := filepath.Join(repoPath, "docs")
		var results []SearchResult
		var mu sync.Mutex // Mutex for thread-safe results append

		entries, err := os.ReadDir(docsPath)
		if err != nil {
			log.Fatal("Error reading docs directory", "error", err)
		}

		// Create a worker pool for parallel processing
		numWorkers := runtime.NumCPU()
		jobs := make(chan string, len(entries))
		var wg sync.WaitGroup

		// Start workers
		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for path := range jobs {
					content, err := os.ReadFile(path)
					if err != nil {
						continue
					}

					lines := strings.Split(string(content), "\n")
					var currentCategory string
					var lastHeading string
					for _, line := range lines {
						// Check for headers to update category
						if strings.HasPrefix(line, "# ") {
							currentCategory = cleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
							lastHeading = currentCategory
							continue
						}
						if strings.HasPrefix(line, "## ") {
							currentCategory = cleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
							lastHeading = currentCategory
							continue
						}

						// Skip empty lines and other headers
						if line == "" || strings.HasPrefix(line, "#") {
							continue
						}

						// Look for URLs in the line
						if strings.Contains(line, "http") || strings.Contains(line, "www.") {
							matches := fuzzy.Find(query, []string{line})
							if len(matches) > 0 && matches[0].Score >= -100 {
								// Clean up the line by removing markdown formatting
								cleanLine := cleanMarkdown(line)
								// Extract URL from the line
								url := extractURL(cleanLine)
								if url != "" {
									mu.Lock()
									results = append(results, SearchResult{
										Link:     url,
										Line:     cleanLine,
										Score:    matches[0].Score,
										Category: lastHeading,
									})
									mu.Unlock()
								}
							}
						}
					}
				}
			}()
		}

		// Send jobs to workers
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			if !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			jobs <- filepath.Join(docsPath, entry.Name())
		}
		close(jobs)

		// Wait for all workers to finish
		wg.Wait()

		if err != nil {
			log.Fatal("Error searching repository", "error", err)
		}

		if len(results) == 0 {
			log.Info("No results found")
			return
		}

		// Sort results by score
		sort.Slice(results, func(i, j int) bool {
			return results[i].Score > results[j].Score
		})

		// Limit results if specified
		if limit > 0 && limit < len(results) {
			results = results[:limit]
		} else if limit == 0 && len(results) > 10 {
			results = results[:10]
		}

		// Convert results to TUI format
		tuiResults := make([]tui.SearchResult, len(results))
		for i, r := range results {
			tuiResults[i] = tui.SearchResult{
				Category: r.Category,
				Link:     r.Link,
				Line:     r.Line,
				Score:    r.Score,
			}
		}

		// Create and run the TUI
		p := tea.NewProgram(tui.NewModel(tuiResults))
		if _, err := p.Run(); err != nil {
			log.Fatal("Error running TUI", "error", err)
		}
	},
}

func init() {
	SearchCmd.Flags().IntP("limit", "l", 0, "Maximum number of results to show (default: 10)")
}

// cleanMarkdown removes markdown formatting from a line
func cleanMarkdown(line string) string {
	// Remove bold/italic
	line = strings.ReplaceAll(line, "**", "")
	line = strings.ReplaceAll(line, "*", "")
	line = strings.ReplaceAll(line, "__", "")
	line = strings.ReplaceAll(line, "_", "")

	// Remove code blocks
	line = strings.ReplaceAll(line, "`", "")

	// Remove links but keep the URL
	line = strings.ReplaceAll(line, "](http", " http")
	line = strings.ReplaceAll(line, "](https", " https")
	line = strings.ReplaceAll(line, "](www", " www")
	line = strings.ReplaceAll(line, "[", "")
	line = strings.ReplaceAll(line, ")", "")

	// Clean up any double spaces
	line = strings.Join(strings.Fields(line), " ")

	return line
}

// extractURL finds the first URL in a line using regex for better accuracy
func extractURL(line string) string {
	// Look for http://, https://, or www.
	urlStart := -1
	if strings.Contains(line, "http://") {
		urlStart = strings.Index(line, "http://")
	} else if strings.Contains(line, "https://") {
		urlStart = strings.Index(line, "https://")
	} else if strings.Contains(line, "www.") {
		urlStart = strings.Index(line, "www.")
	}

	if urlStart == -1 {
		return ""
	}

	// Find the end of the URL (space, newline, or end of string)
	urlEnd := len(line)
	for i := urlStart; i < len(line); i++ {
		if line[i] == ' ' || line[i] == '\n' || line[i] == '\r' || line[i] == ')' || line[i] == ']' {
			urlEnd = i
			break
		}
	}

	url := line[urlStart:urlEnd]
	// Basic URL validation
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "www.") {
		return ""
	}
	return url
}

// cleanCategory removes unusual Unicode characters while keeping basic ASCII characters
func cleanCategory(category string) string {
	var result strings.Builder
	for _, char := range category {
		// Keep ASCII characters (including spaces and basic punctuation)
		if char < 128 {
			result.WriteRune(char)
		}
	}
	return result.String()
}

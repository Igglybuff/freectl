package search

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"freectl/internal/common"
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

// Add this function to check repository age
func checkRepoAge(repoPath string) (bool, error) {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%ct")
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to get last commit timestamp: %w", err)
	}

	var timestamp int64
	if _, err := fmt.Sscanf(string(output), "%d", &timestamp); err != nil {
		return false, fmt.Errorf("failed to parse timestamp: %w", err)
	}

	lastCommit := time.Unix(timestamp, 0)
	return time.Since(lastCommit) > 7*24*time.Hour, nil
}

// Add this function to prompt for update
func promptForUpdate() bool {
	fmt.Print("Repository is more than a week old. Would you like to update it? [Y/n] ")
	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	response = strings.ToLower(strings.TrimSpace(response))
	return response == "" || response == "y" || response == "yes"
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
		if len(cacheDir) >= 2 && cacheDir[:2] == "~/" { // Add length check and fix condition
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

		// Check repository age
		needsUpdate, err := checkRepoAge(repoPath)
		if err != nil {
			log.Warn("Failed to check repository age", "error", err)
		} else if needsUpdate && promptForUpdate() {
			log.Info("Updating repository...")
			updateCmd := exec.Command("git", "-C", repoPath, "pull")
			updateCmd.Stdout = os.Stdout
			updateCmd.Stderr = os.Stderr
			if err := updateCmd.Run(); err != nil {
				log.Error("Failed to update repository", "error", err)
			} else {
				log.Info("Repository updated successfully")
			}
		}

		docsPath := filepath.Join(repoPath, "docs")
		var results []SearchResult
		var mu sync.Mutex

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
							currentCategory = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
							lastHeading = currentCategory
							continue
						}
						if strings.HasPrefix(line, "## ") {
							currentCategory = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
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
								cleanLine := common.CleanMarkdown(line)
								url := common.ExtractURL(cleanLine)
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
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
				continue
			}
			jobs <- filepath.Join(docsPath, entry.Name())
		}
		close(jobs)
		wg.Wait()

		if len(results) == 0 {
			log.Info("No results found")
			return
		}

		// Sort and limit results
		sort.Slice(results, func(i, j int) bool {
			return results[i].Score > results[j].Score
		})

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

package search

import (
	"fmt"
	"strings"

	"freectl/internal/common"
	"freectl/internal/search"
	"freectl/internal/tui"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var repoName string

var SearchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search through all cached repositories",
	Long: `Search through all cached repositories for resources.
If no repository is specified with --repo, searches across all repositories.

The search will:
1. Look through all markdown files in each repository
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
  # Search across all repositories
  freectl search "torrent"
  
  # Search in a specific repository
  freectl search "kanban" --repo "awesome-selfhosted"
  
  # Search with multiple words and limit results
  freectl search --limit 20 "free movies streaming"
  
  # Search in a custom cache directory
  freectl search --cache-dir /path/to/cache "torrent"`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := strings.Join(args, " ")
		limit, _ := cmd.Flags().GetInt("limit")
		cacheDir, _ := cmd.Flags().GetString("cache-dir")

		results, err := search.Search(query, cacheDir, repoName)
		if err != nil {
			return fmt.Errorf("search failed: %w", err)
		}

		if len(results) == 0 {
			log.Info("No results found")
			return nil
		}

		// Limit results
		if limit > 0 && limit < len(results) {
			results = results[:limit]
		} else if limit == 0 && len(results) > 10 {
			results = results[:10]
		}

		// Convert results to TUI format
		tuiResults := make([]tui.SearchResult, len(results))
		for i, r := range results {
			tuiResults[i] = tui.SearchResult{
				Category:   r.Category,
				Link:       r.URL,
				Text:       r.Description,
				Line:       r.Line,
				Score:      r.Score,
				Repository: r.Repository,
				IsInvalid:  common.IsInvalidCategory(r.Category),
			}
		}

		// Create and run the TUI
		p := tea.NewProgram(tui.NewModel(tuiResults))
		if _, err := p.Run(); err != nil {
			return fmt.Errorf("error running TUI: %w", err)
		}

		return nil
	},
}

func init() {
	SearchCmd.Flags().StringVarP(&repoName, "repo", "r", "", "Search in a specific repository")
	SearchCmd.Flags().IntP("limit", "l", 0, "Maximum number of results to show (default: 10)")
}

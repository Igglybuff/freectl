package search

import (
	"strings"

	"freectl/internal/search"
	"freectl/internal/tui"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

type SearchResult struct {
	Link        string
	Description string
	Line        string
	Score       int
	Category    string
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

		results, err := search.Search(query, cacheDir)
		if err != nil {
			log.Fatal("Search failed", "error", err)
		}

		if len(results) == 0 {
			log.Info("No results found")
			return
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
				Category: r.Category,
				Link:     r.URL,
				Text:     r.Description,
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

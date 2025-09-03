package search

import (
	"fmt"

	"freectl/internal/common"
	"freectl/internal/search"
	"freectl/internal/settings"
	"freectl/internal/tui"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var sourceName string
var usePreprocessed bool

var SearchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search through all cached sources",
	Long: `Search through all cached sources for resources.
If no source is specified with --source, searches across all sources.

The search will:
1. Look through all markdown files in each source
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
  # Search across all sources
  freectl search "torrent"

  # Search in a specific source
  freectl search "kanban" --source "awesome-selfhosted"

  # Search with multiple words and limit results
  freectl search --limit 20 "free movies streaming"`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return fmt.Errorf("search query required")
		}

		query := args[0]
		log.Debug("Starting search", "query", query)

		// Load settings to get cache directory
		s, err := settings.LoadSettings()
		if err != nil {
			log.Error("Failed to load settings", "error", err)
			return fmt.Errorf("failed to load settings: %w", err)
		}

		// Perform search
		var results []search.Result

		// Get limit from flag
		limit, _ := cmd.Flags().GetInt("limit")

		if usePreprocessed {
			log.Info("Using preprocessed search")
			results, err = search.SearchPreprocessed(query, sourceName, s, limit)
		} else {
			log.Info("Using real-time search")
			results, err = search.Search(query, sourceName, s)
		}

		if err != nil {
			return fmt.Errorf("search failed: %w", err)
		}

		log.Info("Search completed", "results", len(results))
		if len(results) == 0 {
			log.Info("No results found")
			return nil
		}

		// Limit results (only for real-time search, preprocessed search handles this internally)
		if !usePreprocessed {
			if limit > 0 && limit < len(results) {
				log.Info("Limiting results", "limit", limit, "total", len(results))
				results = results[:limit]
			} else if limit == 0 && len(results) > 10 {
				log.Info("Applying default limit of 10 results", "total", len(results))
				results = results[:10]
			}
		}

		// Convert results to TUI format
		tuiResults := make([]tui.SearchResult, len(results))
		for i, r := range results {
			tuiResults[i] = tui.SearchResult{
				Category:  r.Category,
				Link:      r.URL,
				Name:      r.Name,
				Line:      r.Line,
				Score:     r.Score,
				Source:    r.Source,
				IsInvalid: common.IsInvalidCategory(r.Category),
			}
			log.Debug("Converted result",
				"index", i,
				"name", r.Name,
				"description", r.Description,
				"category", r.Category,
				"url", r.URL,
				"score", r.Score,
				"source", r.Source)
		}

		log.Info("Starting TUI", "results", len(tuiResults))
		// Create and run the TUI
		p := tea.NewProgram(tui.NewModel(tuiResults))
		if _, err := p.Run(); err != nil {
			return fmt.Errorf("error running TUI: %w", err)
		}

		return nil
	},
}

func init() {
	SearchCmd.Flags().StringVarP(&sourceName, "source", "r", "", "Search in a specific source")
	SearchCmd.Flags().IntP("limit", "l", 0, "Maximum number of results to show (default: 10)")
	SearchCmd.Flags().BoolVarP(&usePreprocessed, "preprocessed", "p", false, "Use preprocessed search (faster, requires 'freectl process' first)")
}

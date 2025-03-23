package root

import (
	"fmt"
	"os"
	"path/filepath"

	"freectl/cmd/add"
	"freectl/cmd/delete"
	"freectl/cmd/list"
	"freectl/cmd/search"
	"freectl/cmd/serve"
	"freectl/cmd/update"

	"github.com/spf13/cobra"
)

var cacheDir string

var RootCmd = &cobra.Command{
	Use:   "freectl",
	Short: "CLI tool for finding resources from Git repositories",
	Long: `A CLI tool for finding resources from Git repositories.
It manages a local cache of repositories and provides search functionality
across all cached repositories.

The tool expects repositories to have markdown files containing links
to resources. It will search through these files to find relevant links
based on your search query.

Commands:
  add     - Add a new repository to the cache
  delete  - Delete a cached repository
  list    - List all cached repositories
  search  - Search through all cached repositories
  serve   - Start a web interface for searching
  update  - Update all cached repositories

Examples:
  # Add a new repository
  freectl add https://github.com/awesome-selfhosted/awesome-selfhosted --name "awesome-selfhosted"
  
  # List all repositories
  freectl list
  
  # Delete a repository
  freectl delete "awesome-selfhosted"
  
  # Search across all repositories
  freectl search "torrent"
  
  # Search in a specific repository
  freectl search "kanban" --repo "awesome-selfhosted"
  
  # Start the web interface
  freectl serve
  
  # Update all repositories
  freectl update

Environment:
  CACHE_DIR  - Directory to store cached repositories (default: ~/.local/cache/freectl)`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	},
}

func init() {
	// Add commands
	RootCmd.AddCommand(add.AddCmd)
	RootCmd.AddCommand(delete.DeleteCmd)
	RootCmd.AddCommand(list.ListCmd)
	RootCmd.AddCommand(search.SearchCmd)
	RootCmd.AddCommand(serve.ServeCmd)
	RootCmd.AddCommand(update.UpdateCmd)

	// Add persistent flags
	RootCmd.PersistentFlags().StringVar(&cacheDir, "cache-dir", "", "Directory to store cached repositories")
}

func Execute() {
	if err := RootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	// Set default cache directory if not provided
	if cacheDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			fmt.Printf("Error getting home directory: %v\n", err)
			os.Exit(1)
		}
		cacheDir = filepath.Join(homeDir, ".local", "cache", "freectl")
	}
}

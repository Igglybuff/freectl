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
	"freectl/cmd/stats"
	"freectl/cmd/update"
	"freectl/internal/config"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

func init() {
	// Configure logging
	log.SetOutput(os.Stdout)
	log.SetFormatter(log.TextFormatter)

	// Set log level from environment or default to info
	if os.Getenv("LOG_LEVEL") == "debug" {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.InfoLevel)
	}

	log.Debug("Initializing root command")

	// Add commands
	RootCmd.AddCommand(add.AddCmd)
	RootCmd.AddCommand(delete.DeleteCmd)
	RootCmd.AddCommand(list.ListCmd)
	RootCmd.AddCommand(search.SearchCmd)
	RootCmd.AddCommand(serve.ServeCmd)
	RootCmd.AddCommand(update.UpdateCmd)
	RootCmd.AddCommand(stats.StatsCmd)

	// Set default cache directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Error("Failed to get home directory", "error", err)
		fmt.Printf("Error getting home directory: %v\n", err)
		os.Exit(1)
	}
	defaultCacheDir := filepath.Join(homeDir, ".local", "cache", "freectl")
	log.Debug("Setting default cache directory", "path", defaultCacheDir)

	// Add persistent flags
	RootCmd.PersistentFlags().StringVar(&config.CacheDir, "cache-dir", defaultCacheDir, "Directory to store cached repositories")
	log.Debug("Root command initialization complete")
}

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
  freectl update`,
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Debug("Root command executed")
		return cmd.Help()
	},
}

func Execute() {
	log.Debug("Starting command execution")
	if err := RootCmd.Execute(); err != nil {
		log.Error("Command execution failed", "error", err)
		fmt.Println(err)
		os.Exit(1)
	}
	log.Debug("Command execution completed successfully")
}

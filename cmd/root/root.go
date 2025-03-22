package root

import (
	"os"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var RootCmd = &cobra.Command{
	Use:   "freectl",
	Short: "CLI tool for finding resources from FMHY.net",
	Long: `freectl is a command-line interface for searching and managing resources from FMHY.net.
It provides a convenient way to search through the FMHY repository and find useful links.

Examples:
  # Update the local repository cache
  freectl update

  # Search for resources
  freectl search "torrent"
  freectl s "streaming"

  # Use a custom cache directory
  freectl --cache-dir /path/to/cache update

For more information about a specific command, use:
  freectl <command> --help`,
}

func Execute() {
	if err := RootCmd.Execute(); err != nil {
		log.Error("Error executing command", "error", err)
		os.Exit(1)
	}
}

func init() {
	// Add persistent flags here if needed
	RootCmd.PersistentFlags().StringP("cache-dir", "c", "~/.local/cache/freectl", "Directory to store the FMHY repository cache")
}

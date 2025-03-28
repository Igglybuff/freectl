package add

import (
	"fmt"

	"freectl/internal/repository"
	"freectl/internal/sources"
	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	name     string
	repoType string
)

var AddCmd = &cobra.Command{
	Use:   "add [repository-url]",
	Short: "Add a new repository to the cache",
	Long: `Add a new repository to the cache. The repository will be cloned and indexed for searching.
The repository must be a Git repository accessible via HTTPS.

Examples:
  # Add a repository with a custom name and type
  freectl add https://github.com/awesome-selfhosted/awesome-selfhosted --name "awesome-selfhosted" --type git
  
  # Add a repository using the default name (derived from the URL)
  freectl add https://github.com/user/repo`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]
		cacheDir, _ := cmd.Flags().GetString("cache-dir")

		// If no name is provided, derive it from the URL
		if name == "" {
			name = sources.DeriveNameFromURL(url)
		}

		if err := repository.AddRepository(cacheDir, url, name, repoType); err != nil {
			return fmt.Errorf("failed to add repository: %w", err)
		}

		log.Info("Repository added successfully", "name", name, "type", repoType)
		return nil
	},
}

func init() {
	AddCmd.Flags().StringVarP(&name, "name", "n", "", "Name for the repository (default: derived from URL)")
	AddCmd.Flags().StringVarP(&repoType, "type", "t", "git", "Type of repository (default: git)")
}

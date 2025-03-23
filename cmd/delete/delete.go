package delete

import (
	"fmt"
	"os"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var DeleteCmd = &cobra.Command{
	Use:   "delete [repository]",
	Short: "Delete a cached repository",
	Long: `Delete a cached repository from the local cache.
This will remove the repository and all its contents from disk.

Example:
  freectl delete "awesome-selfhosted"`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		repoName := args[0]
		cacheDir, _ := cmd.Flags().GetString("cache-dir")

		// Get list of repositories
		repos, err := common.ListRepositories(cacheDir)
		if err != nil {
			return fmt.Errorf("failed to get repositories: %w", err)
		}

		// Find the repository
		var repo common.Repository
		var found bool
		for _, r := range repos {
			if r.Name == repoName {
				repo = r
				found = true
				break
			}
		}

		if !found {
			return fmt.Errorf("repository '%s' not found", repoName)
		}

		// Confirm deletion
		fmt.Printf("Are you sure you want to delete repository '%s'? [y/N] ", repoName)
		var response string
		fmt.Scanln(&response)

		if response != "y" && response != "Y" {
			fmt.Println("Deletion cancelled")
			return nil
		}

		// Delete the repository directory
		if err := os.RemoveAll(repo.Path); err != nil {
			return fmt.Errorf("failed to delete repository: %w", err)
		}

		log.Info("Repository deleted successfully", "name", repoName)
		return nil
	},
}

package add

import (
	"fmt"

	"freectl/internal/repository"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	name     string
	repoType string
)

// AddCmd represents the add command
var AddCmd = &cobra.Command{
	Use:   "add [url]",
	Short: "Add a new repository",
	Long: `Add a new repository to the cache. The repository will be cloned
and enabled by default.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]
		cacheDir := cmd.Flag("cache-dir").Value.String()

		req := repository.AddRepositoryRequest{
			Name: name,
			URL:  url,
			Type: repoType,
		}

		if err := repository.AddRepository(cacheDir, req); err != nil {
			log.Error("Failed to add repository", "error", err)
			return fmt.Errorf("failed to add repository: %w", err)
		}

		return nil
	},
}

func init() {
	AddCmd.Flags().StringVarP(&name, "name", "n", "", "Name for the repository (default: derived from URL)")
	AddCmd.Flags().StringVarP(&repoType, "type", "t", "git", "Type of repository (default: git)")
}

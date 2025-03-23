package add

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	name string
)

var AddCmd = &cobra.Command{
	Use:   "add [repository-url]",
	Short: "Add a new repository to the cache",
	Long: `Add a new repository to the cache. The repository will be cloned and indexed for searching.
The repository must be a Git repository accessible via HTTPS.

Examples:
  # Add a repository with a custom name
  freectl add https://github.com/awesome-selfhosted/awesome-selfhosted --name "awesome-selfhosted"
  
  # Add a repository using the default name (derived from the URL)
  freectl add https://github.com/user/repo`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]
		cacheDir, _ := cmd.Flags().GetString("cache-dir")

		// If no name is provided, derive it from the URL
		if name == "" {
			name = filepath.Base(url)
			// Remove .git extension if present
			name = strings.TrimSuffix(name, ".git")
		}

		repoPath := common.GetRepositoryPath(cacheDir, name)
		if _, err := os.Stat(repoPath); !os.IsNotExist(err) {
			return fmt.Errorf("repository %s already exists", name)
		}

		// Clone the repository
		log.Info("Cloning repository", "url", url, "name", name)
		if err := cloneRepository(url, repoPath); err != nil {
			return fmt.Errorf("failed to clone repository: %w", err)
		}

		log.Info("Repository added successfully", "name", name)
		return nil
	},
}

func init() {
	AddCmd.Flags().StringVarP(&name, "name", "n", "", "Name for the repository (default: derived from URL)")
}

func cloneRepository(url, path string) error {
	cmd := exec.Command("git", "clone", url, path)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

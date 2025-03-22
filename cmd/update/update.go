package update

import (
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var UpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update the local FMHY repository cache",
	Long: `Update downloads the FMHY repository to the local cache directory or updates it if it already exists.
The repository is stored in ~/.local/cache/freectl by default.

This command will:
1. Create the cache directory if it doesn't exist
2. Clone the repository if it's not already present
3. Pull the latest changes if the repository exists

Examples:
  # Update using default cache directory
  freectl update

  # Update using a custom cache directory
  freectl update --cache-dir /path/to/cache`,
	Run: func(cmd *cobra.Command, args []string) {
		startTime := time.Now()
		cacheDir, _ := cmd.Flags().GetString("cache-dir")
		// Expand the ~ to the user's home directory
		if cacheDir[:2] == "~/" {
			home, err := os.UserHomeDir()
			if err != nil {
				log.Fatal("Failed to get home directory", "error", err)
			}
			cacheDir = filepath.Join(home, cacheDir[2:])
		}

		// Create cache directory if it doesn't exist
		if err := os.MkdirAll(cacheDir, 0755); err != nil {
			log.Fatal("Failed to create cache directory", "error", err)
		}

		repoPath := filepath.Join(cacheDir, "FMHY")
		if _, err := os.Stat(repoPath); os.IsNotExist(err) {
			// Clone the repository
			log.Info("Cloning FMHY repository...")
			cmd := exec.Command("git", "clone", "https://github.com/fmhy/edit.git", repoPath)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				log.Fatal("Failed to clone repository", "error", err)
			}
			log.Info("Repository cloned successfully")
		} else {
			// Update existing repository
			log.Info("Updating FMHY repository...")
			cmd := exec.Command("git", "-C", repoPath, "pull")
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				log.Fatal("Failed to update repository", "error", err)
			}
			log.Info("Repository updated successfully")
		}

		duration := time.Since(startTime)
		log.Info("Update completed", "duration", duration)
	},
}

func init() {
	// Add any flags specific to the update command here
}

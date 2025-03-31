package serve

import (
	"fmt"
	"freectl/internal/settings"
	"freectl/internal/sources"
	"freectl/internal/web"
	"net/http"
	"os"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var port int

var ServeCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start a web interface for searching cached sources",
	Long:  `Starts an HTTP server that provides a web interface for searching cached sources at http://localhost:8080`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return startServer()
	},
}

func init() {
	ServeCmd.Flags().IntVarP(&port, "port", "p", 8080, "Port to listen on")
}

func startServer() error {
	// Configure logger
	log.SetOutput(os.Stdout)
	log.SetFormatter(log.TextFormatter)

	// Initialize settings with the correct cache directory
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		return err
	}

	// Expand and create cache directory if it doesn't exist
	expandedCacheDir, err := sources.ExpandCacheDir(s.CacheDir)
	if err != nil {
		log.Error("Failed to expand cache directory", "error", err)
		return err
	}

	if err := os.MkdirAll(expandedCacheDir, 0755); err != nil {
		log.Error("Failed to create cache directory", "error", err)
		return err
	}

	// Serve static files and templates
	http.HandleFunc("/", web.HandleHome)
	http.HandleFunc("/static/", web.HandleStatic)
	http.HandleFunc("/search", web.HandleSearch)
	http.HandleFunc("/favorites", web.HandleFavorites)
	http.HandleFunc("/favorites/add", web.HandleAddFavorite)
	http.HandleFunc("/favorites/remove", web.HandleRemoveFavorite)
	http.HandleFunc("/stats", web.HandleStats)
	http.HandleFunc("/update", web.HandleUpdate)
	http.HandleFunc("/settings", web.HandleSettings)
	http.HandleFunc("/sources/add", web.HandleAddSource)
	http.HandleFunc("/sources/list", web.HandleListSource)
	http.HandleFunc("/sources/delete", web.HandleDeleteSource)
	http.HandleFunc("/sources/toggle", web.HandleToggleSource)
	http.HandleFunc("/sources/edit", web.HandleEditSource)
	http.HandleFunc("/scan/virustotal", web.HandleVirusTotalScan)
	http.HandleFunc("/library", web.HandleLibrary)

	log.Infof("Starting server at http://localhost:%d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

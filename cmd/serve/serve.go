package serve

import (
	"fmt"
	"net/http"
	"os"
	"freectl/internal/settings"
	"freectl/internal/web"

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

	// Create cache directory if it doesn't exist
	if err := os.MkdirAll(s.CacheDir, 0755); err != nil {
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

	log.Infof("Starting server at http://localhost:%d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

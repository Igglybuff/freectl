package serve

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"

	"freectl/internal/search"

	"github.com/spf13/cobra"
)

var port int

var ServeCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start a web interface for searching FMHY content",
	Long:  `Starts an HTTP server that provides a web interface for searching FMHY content at http://localhost:8080`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return startServer()
	},
}

func init() {
	ServeCmd.Flags().IntVarP(&port, "port", "p", 8080, "Port to listen on")
}

func startServer() error {
	// Serve static files and templates
	http.HandleFunc("/", handleHome)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/favorites", handleFavorites)
	http.HandleFunc("/favorites/add", handleAddFavorite)
	http.HandleFunc("/favorites/remove", handleRemoveFavorite)

	fmt.Printf("Starting server at http://localhost:%d\n", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.ParseFiles("templates/index.html"))
	tmpl.Execute(w, nil)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing search query", http.StatusBadRequest)
		return
	}

	results, err := search.Search(query, "~/.local/cache/freectl")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convert to web-friendly format
	webResults := make([]SearchResult, len(results))
	for i, r := range results {
		webResults[i] = SearchResult{
			Title:       r.Category,
			Description: r.Description,
			URL:         r.URL,
			Score:       r.Score,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(webResults)
}

func handleFavorites(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	favorites, err := search.LoadFavorites()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favorites)
}

func handleAddFavorite(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var favorite search.Favorite
	if err := json.Unmarshal(body, &favorite); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := search.AddFavorite(favorite.Link, favorite.Description, favorite.Category); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleRemoveFavorite(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var favorite search.Favorite
	if err := json.Unmarshal(body, &favorite); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := search.RemoveFavorite(favorite.Link); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Define a SearchResult struct for JSON encoding
type SearchResult struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Score       int    `json:"score"`
}

package serve

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"freectl/internal/common"
	"freectl/internal/search"
	"freectl/internal/stats"
	"freectl/internal/update"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var port int

var ServeCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start a web interface for searching cached repositories",
	Long:  `Starts an HTTP server that provides a web interface for searching cached repositories at http://localhost:8080`,
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
	http.HandleFunc("/static/", handleStatic)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/favorites", handleFavorites)
	http.HandleFunc("/favorites/add", handleAddFavorite)
	http.HandleFunc("/favorites/remove", handleRemoveFavorite)
	http.HandleFunc("/stats", handleStats)
	http.HandleFunc("/update", handleUpdate)

	log.Infof("Starting server at http://localhost:%d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	content, err := search.TemplateFS.ReadFile("templates/index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Write(content)
}

func handleStatic(w http.ResponseWriter, r *http.Request) {
	// Remove the /static/ prefix from the path
	path := strings.TrimPrefix(r.URL.Path, "/static/")

	// Read the file from the embedded filesystem
	content, err := search.StaticFS.ReadFile("static/" + path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Set the appropriate content type based on file extension
	switch {
	case strings.HasSuffix(path, ".css"):
		w.Header().Set("Content-Type", "text/css")
	case strings.HasSuffix(path, ".js"):
		w.Header().Set("Content-Type", "application/javascript")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	w.Write(content)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing search query", http.StatusBadRequest)
		return
	}

	// Validate query length
	if len(query) > 1000 {
		http.Error(w, "Search query too long", http.StatusBadRequest)
		return
	}

	// Validate minimum length
	if len(strings.TrimSpace(query)) < 2 {
		http.Error(w, "Search query too short", http.StatusBadRequest)
		return
	}

	// Validate for potentially dangerous characters
	if strings.ContainsAny(query, "<>") {
		http.Error(w, "Invalid characters in search query", http.StatusBadRequest)
		return
	}

	// Get pagination parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 {
		perPage = 10
	}

	// Get repository filter from query parameters
	repoName := r.URL.Query().Get("repo")

	results, err := search.Search(query, "~/.local/cache/freectl", repoName)
	if err != nil {
		// Only return error for actual errors, not for missing repository
		if !strings.Contains(err.Error(), "repository not found") {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = []search.Result{}
	}

	// Deduplicate results based on URL
	seen := make(map[string]bool)
	uniqueResults := make([]SearchResult, 0, len(results))
	for _, r := range results {
		if !seen[r.URL] {
			seen[r.URL] = true
			uniqueResults = append(uniqueResults, SearchResult{
				Title:       r.Category,
				Description: r.Description,
				URL:         r.URL,
				Score:       r.Score,
				Repository:  r.Repository,
			})
		}
	}

	// Calculate pagination
	totalResults := len(uniqueResults)
	totalPages := 1 // Default to 1 page even with no results
	if totalResults > 0 {
		totalPages = (totalResults + perPage - 1) / perPage
	}
	if page > totalPages {
		page = totalPages
	}

	// Handle pagination for empty results
	var paginatedResults []SearchResult
	if totalResults > 0 {
		start := (page - 1) * perPage
		end := start + perPage
		if end > totalResults {
			end = totalResults
		}
		paginatedResults = uniqueResults[start:end]
	}

	response := struct {
		Results      []SearchResult `json:"results"`
		TotalResults int            `json:"total_results"`
		TotalPages   int            `json:"total_pages"`
		CurrentPage  int            `json:"current_page"`
		PerPage      int            `json:"per_page"`
	}{
		Results:      paginatedResults,
		TotalResults: totalResults,
		TotalPages:   totalPages,
		CurrentPage:  page,
		PerPage:      perPage,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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

	if err := search.AddFavorite(favorite); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
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

	if err := search.RemoveFavorite(favorite); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	repoPath := common.GetRepoPath("~/.local/cache/freectl")
	docsDir := filepath.Join(repoPath, "docs")
	s := &stats.Stats{
		DomainsCount:  make(map[string]int),
		ProtocolStats: make(map[string]int),
	}

	var wg sync.WaitGroup
	err := filepath.Walk(docsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && filepath.Ext(path) == ".md" {
			wg.Add(1)
			go func(p string) {
				defer wg.Done()
				s.ProcessFile(p)
			}(path)
		}
		return nil
	})

	if err != nil {
		http.Error(w, fmt.Sprintf("Error walking docs directory: %v", err), http.StatusInternalServerError)
		return
	}

	wg.Wait()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get cache directory from environment or use default
	cacheDir := os.Getenv("CACHE_DIR")
	if cacheDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get home directory: %v", err), http.StatusInternalServerError)
			return
		}
		cacheDir = filepath.Join(homeDir, ".local", "cache", "freectl")
	}

	duration, err := update.UpdateRepo(cacheDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update repositories: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"duration": duration.String(),
	})
}

// Define a SearchResult struct for JSON encoding
type SearchResult struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Score       int    `json:"score"`
	Repository  string `json:"repository"`
}

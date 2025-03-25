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
	"freectl/internal/config"
	"freectl/internal/repository"
	"freectl/internal/search"
	"freectl/internal/settings"
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
	// Configure logger
	log.SetOutput(os.Stdout)
	log.SetFormatter(log.TextFormatter)

	// Serve static files and templates
	http.HandleFunc("/", handleHome)
	http.HandleFunc("/static/", handleStatic)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/favorites", handleFavorites)
	http.HandleFunc("/favorites/add", handleAddFavorite)
	http.HandleFunc("/favorites/remove", handleRemoveFavorite)
	http.HandleFunc("/stats", handleStats)
	http.HandleFunc("/update", handleUpdate)
	http.HandleFunc("/list", handleList)
	http.HandleFunc("/settings", handleSettings)
	http.HandleFunc("/repositories/add", handleAddRepository)
	http.HandleFunc("/repositories/list", handleListRepositories)
	http.HandleFunc("/repositories/delete", handleDeleteRepository)
	http.HandleFunc("/repositories/toggle", handleToggleRepository)

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

	// Get repository and category filters from query parameters
	repoName := r.URL.Query().Get("repo")
	category := r.URL.Query().Get("category")

	results, err := search.Search(query, config.CacheDir, repoName)
	if err != nil {
		// Only return error for actual errors, not for missing repository
		if !strings.Contains(err.Error(), "repository not found") {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = []search.Result{}
	}

	// Deduplicate results based on URL and filter by category if specified
	seen := make(map[string]bool)
	uniqueResults := make([]SearchResult, 0, len(results))
	for _, r := range results {
		if !seen[r.URL] && (category == "" || r.Category == category) {
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

	// Return the updated list of favorites
	favorites, err := search.LoadFavorites()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favorites)
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

	// Return the updated list of favorites
	favorites, err := search.LoadFavorites()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favorites)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get repository name from query parameters
	repoName := r.URL.Query().Get("repo")
	if repoName == "" {
		http.Error(w, "Repository name is required", http.StatusBadRequest)
		return
	}

	repoPath := common.GetRepoPath(config.CacheDir, repoName)
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

	duration, err := update.UpdateRepo(config.CacheDir)
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

func handleList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	repos, err := repository.List(config.CacheDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(repos)
}

func handleSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "GET" {
		settings, err := settings.LoadSettings()
		if err != nil {
			log.Error("Failed to load settings", "error", err)
			http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		if err := json.NewEncoder(w).Encode(settings); err != nil {
			log.Error("Failed to encode settings", "error", err)
			http.Error(w, fmt.Sprintf(`{"error": "Failed to encode settings: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
		return
	}

	if r.Method == "POST" {
		var s settings.Settings
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			log.Error("Failed to decode settings from request", "error", err)
			http.Error(w, fmt.Sprintf(`{"error": "Failed to decode settings: %s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		if err := settings.SaveSettings(s); err != nil {
			log.Error("Failed to save settings", "error", err)
			http.Error(w, fmt.Sprintf(`{"error": "Failed to save settings: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		// Return the saved settings as confirmation
		if err := json.NewEncoder(w).Encode(s); err != nil {
			log.Error("Failed to encode response", "error", err)
			http.Error(w, fmt.Sprintf(`{"error": "Failed to encode response: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
		return
	}

	// Method not allowed
	if r.Method != "GET" && r.Method != "POST" {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
}

func handleAddRepository(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	log.Info("Received repository add request",
		"method", r.Method,
		"content_type", r.Header.Get("Content-Type"),
		"accept", r.Header.Get("Accept"))

	var req struct {
		URL  string `json:"url"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("Failed to decode request body", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid request: %s", err.Error()),
		})
		return
	}

	if err := search.AddRepository(config.CacheDir, req.URL, req.Name); err != nil {
		log.Error("Failed to add repository", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	log.Info("Repository added successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Repository added successfully",
	})
}

func handleListRepositories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	repos, err := repository.List(config.CacheDir)
	if err != nil {
		log.Error("Failed to list repositories", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"repositories": repos,
	})
}

func handleDeleteRepository(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("Failed to decode request body", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid request: %s", err.Error()),
		})
		return
	}

	if err := repository.Delete(config.CacheDir, req.Name); err != nil {
		log.Error("Failed to delete repository", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Repository deleted successfully",
	})
}

func handleToggleRepository(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("Failed to decode request body", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Invalid request: %s", err.Error()),
		})
		return
	}

	if err := repository.ToggleEnabled(config.CacheDir, req.Name); err != nil {
		log.Error("Failed to toggle repository", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Get the updated enabled status
	enabled, err := repository.IsEnabled(config.CacheDir, req.Name)
	if err != nil {
		log.Error("Failed to get repository status", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get repository status: %s", err.Error()),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var status string
	if enabled {
		status = "enabled"
	} else {
		status = "disabled"
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"enabled": enabled,
		"message": fmt.Sprintf("Repository %s successfully", status),
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

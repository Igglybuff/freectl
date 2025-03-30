package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"text/template"

	"freectl/internal/common"
	"freectl/internal/search"
	"freectl/internal/settings"
	"freectl/internal/sources"
	"freectl/internal/stats"

	"github.com/charmbracelet/log"
)

//go:embed templates/index.html
var TemplateFS embed.FS

//go:embed static/*
var StaticFS embed.FS

func HandleHome(w http.ResponseWriter, r *http.Request) {
	// Load settings
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Parse template
	tmpl, err := template.ParseFS(TemplateFS, "templates/index.html")
	if err != nil {
		log.Error("Failed to parse template", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Execute template with settings
	w.Header().Set("Content-Type", "text/html")
	data := struct {
		Settings settings.Settings
	}{
		Settings: s,
	}
	if err := tmpl.Execute(w, data); err != nil {
		log.Error("Failed to execute template", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func HandleStatic(w http.ResponseWriter, r *http.Request) {
	// Remove the /static/ prefix from the path
	path := strings.TrimPrefix(r.URL.Path, "/static/")

	// Read the file from the embedded filesystem
	content, err := StaticFS.ReadFile("static/" + path)
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
		// Add CORS headers for JavaScript modules
		w.Header().Set("Access-Control-Allow-Origin", "*")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	w.Write(content)
}

func HandleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing search query", http.StatusBadRequest)
		return
	}

	// Load settings first for validation
	settings, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Validate query length
	if len(query) > settings.MaxQueryLength {
		http.Error(w, "Search query too long", http.StatusBadRequest)
		return
	}

	// Validate minimum length
	if len(strings.TrimSpace(query)) < settings.MinQueryLength {
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

	// Get source and category filters from query parameters
	sourceName := r.URL.Query().Get("source")
	category := r.URL.Query().Get("category")

	// Perform search
	log.Info("Starting search", "query", query, "source", sourceName)
	results, err := search.Search(query, sourceName, settings)
	if err != nil {
		log.Error("Search failed", "error", err)
		http.Error(w, fmt.Sprintf("Search failed: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	log.Info("Search completed", "results", len(results))

	// Deduplicate results based on URL and filter by category if specified
	seen := make(map[string]bool)
	uniqueResults := make([]SearchResult, 0, len(results))
	for _, r := range results {
		if !seen[r.URL] && (category == "" || r.Category == category) {
			seen[r.URL] = true
			uniqueResults = append(uniqueResults, SearchResult{
				Category:    r.Category,
				Description: common.RenderMarkdown(r.Description),
				URL:         r.URL,
				Name:        r.Name,
				Score:       r.Score,
				Source:      r.Source,
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

func HandleFavorites(w http.ResponseWriter, r *http.Request) {
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

func HandleAddFavorite(w http.ResponseWriter, r *http.Request) {
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

func HandleRemoveFavorite(w http.ResponseWriter, r *http.Request) {
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

func HandleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get source name from query parameters
	sourceName := r.URL.Query().Get("source")
	if sourceName == "" {
		http.Error(w, "Source name is required", http.StatusBadRequest)
		return
	}

	// Load settings to verify source exists and get cache directory
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		http.Error(w, fmt.Sprintf("Failed to load settings: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Verify source exists in settings
	found := false
	for _, source := range s.Sources {
		if source.Name == sourceName {
			found = true
			break
		}
	}

	if !found {
		http.Error(w, fmt.Sprintf("Source '%s' not found in settings", sourceName), http.StatusNotFound)
		return
	}

	sourcePath := filepath.Join(s.CacheDir, sourceName)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		http.Error(w, fmt.Sprintf("Source '%s' not found in cache", sourceName), http.StatusNotFound)
		return
	}

	stats := &stats.Stats{
		DomainsCount:  make(map[string]int),
		ProtocolStats: make(map[string]int),
	}

	var wg sync.WaitGroup
	err = filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && filepath.Ext(path) == ".md" {
			wg.Add(1)
			go func(p string) {
				defer wg.Done()
				stats.ProcessFile(p)
			}(path)
		}
		return nil
	})

	if err != nil {
		http.Error(w, fmt.Sprintf("Error walking source: %v", err), http.StatusInternalServerError)
		return
	}

	wg.Wait()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func HandleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get list of sources from settings
	sourceList, err := settings.ListSources()
	if err != nil {
		log.Error("Failed to list sources", "error", err)
		http.Error(w, fmt.Sprintf("Failed to list sources: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	if len(sourceList) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "No sources found. Please add a source using 'freectl add'",
		})
		return
	}

	// Update all sources using the wrapper function
	if err := settings.UpdateAllSources(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update sources: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Sources updated successfully",
	})
}

func HandleSettings(w http.ResponseWriter, r *http.Request) {
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

func HandleAddSource(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	log.Info("Received source add request",
		"method", r.Method,
		"content_type", r.Header.Get("Content-Type"),
		"accept", r.Header.Get("Accept"))

	var req struct {
		URL  string `json:"url"`
		Name string `json:"name"`
		Type string `json:"type"`
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

	// If name is not provided, derive it from URL
	if req.Name == "" {
		req.Name = sources.DeriveNameFromURL(req.URL)
	}

	if err := settings.AddSource(req.URL, req.Name, req.Type); err != nil {
		log.Error("Failed to add source", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	log.Info("Source added successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Source added successfully",
	})
}

func HandleListSource(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Method not allowed",
		})
		return
	}

	// Get sources from settings
	sources, err := settings.ListSources()
	if err != nil {
		log.Error("Failed to list sources", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to list sources: %w", err),
		})
		return
	}

	if len(sources) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"sources": []interface{}{},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"sources": sources,
	})
}

func HandleDeleteSource(w http.ResponseWriter, r *http.Request) {
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
		Name  string `json:"name"`
		Force bool   `json:"force"`
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

	// Load settings to get cache directory
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to load settings: %w", err),
		})
		return
	}

	// List sources to verify the source exists in settings
	allSources, err := settings.ListSources()
	if err != nil {
		log.Error("Failed to list sources", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to list sources: %w", err),
		})
		return
	}

	found := false
	for _, source := range allSources {
		if source.Name == req.Name {
			found = true
			break
		}
	}

	if !found {
		log.Error("Source not found in settings", "name", req.Name)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Source '%s' not found in settings", req.Name),
		})
		return
	}

	// First try to delete from settings
	if err := settings.DeleteSource(req.Name, true); err != nil {
		log.Error("Failed to delete source from settings", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to delete source from settings: %w", err),
		})
		return
	}

	// Then try to delete from cache if it exists
	if err := sources.Delete(s.CacheDir, req.Name, false); err != nil {
		// Don't fail the request if cache deletion fails - the source is already removed from settings
		log.Warn("Source was removed from settings but cache deletion failed", "name", req.Name)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

func HandleToggleSource(w http.ResponseWriter, r *http.Request) {
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

	if err := settings.ToggleSourceEnabled(req.Name); err != nil {
		log.Error("Failed to toggle source", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Get the updated enabled status
	enabled, err := settings.IsSourceEnabled(req.Name)
	if err != nil {
		log.Error("Failed to get source status", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to get source status: %s", err.Error()),
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
		"message": fmt.Sprintf("Source %s successfully", status),
	})
}

func HandleEditSource(w http.ResponseWriter, r *http.Request) {
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
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
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

	// Load settings to get cache directory
	s, err := settings.LoadSettings()
	if err != nil {
		log.Error("Failed to load settings", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to load settings: %w", err),
		})
		return
	}

	// First rename in settings
	if err := settings.RenameSource(req.OldName, req.NewName); err != nil {
		log.Error("Failed to rename source in settings", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to rename source: %w", err),
		})
		return
	}

	// Then rename the directory if it exists
	oldPath := filepath.Join(s.CacheDir, req.OldName)
	newPath := filepath.Join(s.CacheDir, req.NewName)
	if _, err := os.Stat(oldPath); err == nil {
		if err := os.Rename(oldPath, newPath); err != nil {
			log.Error("Failed to rename source directory", "error", err)
			// Try to revert the settings change
			if revertErr := settings.RenameSource(req.NewName, req.OldName); revertErr != nil {
				log.Error("Failed to revert settings after directory rename failure", "error", revertErr)
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to rename source directory: %w", err),
			})
			return
		}
	}

	log.Info("Successfully renamed source", "oldName", req.OldName, "newName", req.NewName)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Source renamed successfully",
	})
}

func HandleVirusTotalScan(w http.ResponseWriter, r *http.Request) {
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
		URL string `json:"url"`
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

	// TODO: Implement actual VirusTotal scanning
	// For now, return a placeholder response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "VirusTotal scanning not yet implemented",
		"url":     req.URL,
	})
}

// Define a SearchResult struct for JSON encoding
type SearchResult struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Name        string `json:"name"`
	Score       int    `json:"score"`
	Source      string `json:"source"`
}

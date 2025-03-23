package search

import (
	"bufio"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/sahilm/fuzzy"
)

//go:embed templates/index.html
var TemplateFS embed.FS

//go:embed static/*
var StaticFS embed.FS

type Result struct {
	URL         string `json:"url"`
	Description string `json:"description"`
	Line        string `json:"-"`
	Score       int    `json:"-"`
	Category    string `json:"title"`
	Repository  string `json:"repository"`
}

// CheckRepoAge checks if the repository needs updating
func CheckRepoAge(repoPath string) (bool, error) {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%ct")
	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to get last commit timestamp: %w", err)
	}

	var timestamp int64
	if _, err := fmt.Sscanf(string(output), "%d", &timestamp); err != nil {
		return false, fmt.Errorf("failed to parse timestamp: %w", err)
	}

	lastCommit := time.Unix(timestamp, 0)
	return time.Since(lastCommit) > 7*24*time.Hour, nil
}

// PromptForUpdate asks the user if they want to update the repository
func PromptForUpdate() bool {
	fmt.Print("Repository is more than a week old. Would you like to update it? [Y/n] ")
	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	response = strings.ToLower(strings.TrimSpace(response))
	return response == "" || response == "y" || response == "yes"
}

// isLinkHeavyReadme checks if a README.md file contains a significant number of links
func isLinkHeavyReadme(path string) bool {
	content, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	lines := strings.Split(string(content), "\n")
	totalLines := 0
	linkLines := 0

	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			totalLines++
			if strings.Contains(line, "http") || strings.Contains(line, "www.") {
				linkLines++
			}
		}
	}

	// Consider it link-heavy if:
	// 1. It has at least 10 links AND
	// 2. At least 20% of non-empty lines contain links
	return linkLines >= 10 && float64(linkLines)/float64(totalLines) >= 0.2
}

// isContentFile returns true if the file is likely to contain content links
func isContentFile(path string) bool {
	// Special handling for README.md files
	if strings.HasSuffix(path, "README.md") {
		return isLinkHeavyReadme(path)
	}

	// List of common non-content files to ignore
	ignoreFiles := []string{
		"CONTRIBUTING.md",
		"LICENSE.md",
		"CHANGELOG.md",
		"CODE_OF_CONDUCT.md",
		"SECURITY.md",
		"SUPPORT.md",
		"MAINTAINING.md",
		"DEPLOYMENT.md",
		"DEVELOPMENT.md",
		"CONTRIBUTORS.md",
		"AUTHORS.md",
		"ROADMAP.md",
		"VERSION.md",
		"RELEASE.md",
		"PULL_REQUEST_TEMPLATE.md",
		"ISSUE_TEMPLATE.md",
		"CODEOWNERS",
		".github/",
		"docs/CONTRIBUTING.md",
		"docs/LICENSE.md",
	}

	// Get just the filename and directory name
	dir := filepath.Dir(path)
	file := filepath.Base(path)

	// Check if the file is in the ignore list
	for _, ignore := range ignoreFiles {
		if file == ignore {
			return false
		}
		// Check if the file is in an ignored directory
		if strings.HasPrefix(ignore, dir+"/") {
			return false
		}
	}

	// Check if the file is in a common non-content directory
	nonContentDirs := []string{
		".github",
		".git",
		"node_modules",
		"vendor",
		"dist",
		"build",
		"coverage",
		"test",
		"tests",
		"examples",
		"scripts",
		"tools",
		"ci",
		"docs/api",
		"docs/development",
		"docs/deployment",
		"docs/architecture",
	}

	for _, nonContentDir := range nonContentDirs {
		if strings.Contains(dir, nonContentDir) {
			return false
		}
	}

	return true
}

// Search performs a fuzzy search across all markdown files in the repository
func Search(query string, cacheDir string, repoName string) ([]Result, error) {
	// Get list of repositories
	repos, err := common.ListRepositories(cacheDir)
	if err != nil {
		return nil, fmt.Errorf("failed to get repositories: %w", err)
	}

	if len(repos) == 0 {
		return nil, fmt.Errorf("no repositories found in %s", cacheDir)
	}

	// Filter repositories if a specific one is requested
	if repoName != "" {
		var found bool
		for _, repo := range repos {
			if repo.Name == repoName {
				repos = []common.Repository{repo}
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("repository '%s' not found", repoName)
		}
	}

	var allResults []Result
	var mu sync.Mutex

	// Search in each repository
	for _, repo := range repos {
		repoPath := repo.Path
		log.Info("Searching in repository", "name", repo.Name, "path", repoPath)

		// Walk through all markdown files in the repository
		err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				log.Error("Error accessing path", "path", path, "error", err)
				return nil // Skip this file but continue walking
			}

			// Skip directories and non-markdown files
			if info.IsDir() || !strings.HasSuffix(path, ".md") {
				return nil
			}

			// Skip non-content files
			if !isContentFile(path) {
				log.Debug("Skipping non-content file", "path", path)
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				log.Error("Error reading file", "path", path, "error", err)
				return nil
			}

			lines := strings.Split(string(content), "\n")
			var lastHeading string
			for _, line := range lines {
				// Track headings for categories
				if strings.HasPrefix(line, "# ") {
					lastHeading = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
					continue
				}
				if strings.HasPrefix(line, "## ") {
					lastHeading = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
					continue
				}

				// Skip empty lines or heading lines
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}

				// Look for bullet points with links
				if strings.HasPrefix(strings.TrimSpace(line), "*") || strings.HasPrefix(strings.TrimSpace(line), "-") {
					line = strings.TrimSpace(line)
					line = strings.TrimPrefix(line, "*")
					line = strings.TrimPrefix(line, "-")
					line = strings.TrimSpace(line)

					// Look for markdown link pattern: [text](url)
					if strings.Contains(line, "](http") || strings.Contains(line, "](https") || strings.Contains(line, "](www.") {
						cleanLine := common.CleanMarkdown(line)
						url := common.ExtractURL(cleanLine)
						if url != "" {
							// Extract description - everything after the URL and dash
							parts := strings.SplitN(cleanLine, "-", 2)
							description := url // Default to URL if no description
							if len(parts) > 1 {
								description = strings.TrimSpace(parts[1])
							} else {
								// If no dash, try to extract the link text [text](url)
								start := strings.Index(line, "[")
								end := strings.Index(line, "]")
								if start != -1 && end != -1 && start < end {
									description = line[start+1 : end]
								}
							}

							// Clean the description
							description = common.CleanDescription(description)

							// Search in both the description and the full line
							matches := fuzzy.Find(query, []string{description, cleanLine})
							if len(matches) > 0 {
								log.Debug("Found match",
									"score", matches[0].Score,
									"description", description,
									"line", cleanLine,
									"category", lastHeading,
									"repository", repo.Name)

								if matches[0].Score >= -200 {
									mu.Lock()
									allResults = append(allResults, Result{
										URL:         url,
										Description: description,
										Line:        cleanLine,
										Score:       matches[0].Score,
										Category:    lastHeading,
										Repository:  repo.Name,
									})
									mu.Unlock()
								}
							}
						}
					}
				}
			}
			return nil
		})

		if err != nil {
			log.Error("Error walking repository", "repository", repo.Name, "error", err)
			continue
		}
	}

	// Sort results by score
	sort.Slice(allResults, func(i, j int) bool {
		return allResults[i].Score > allResults[j].Score
	})

	return allResults, nil
}

// Settings represents the user settings
type Settings struct {
	MinQueryLength int    `json:"minQueryLength"`
	MaxQueryLength int    `json:"maxQueryLength"`
	SearchDelay    int    `json:"searchDelay"`
	ShowScores     bool   `json:"showScores"`
	ResultsPerPage int    `json:"resultsPerPage"`
	CacheDir       string `json:"cacheDir"`
	AutoUpdate     bool   `json:"autoUpdate"`
	TruncateTitles bool   `json:"truncateTitles"`
	MaxTitleLength int    `json:"maxTitleLength"`
}

// DefaultSettings returns the default settings
func DefaultSettings() Settings {
	return Settings{
		MinQueryLength: 2,
		MaxQueryLength: 1000,
		SearchDelay:    300,
		ShowScores:     true,
		ResultsPerPage: 10,
		CacheDir:       "~/.local/cache/freectl",
		AutoUpdate:     true,
		TruncateTitles: true,
		MaxTitleLength: 100,
	}
}

// GetSettingsPath returns the path to the settings file
func GetSettingsPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Error("Failed to get home directory", "error", err)
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".config", "freectl")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Error("Failed to create config directory", "path", configDir, "error", err)
		return "", fmt.Errorf("failed to create config directory: %w", err)
	}

	return filepath.Join(configDir, "config.json"), nil
}

// LoadSettings loads settings from the config file
func LoadSettings() (Settings, error) {
	path, err := GetSettingsPath()
	if err != nil {
		log.Error("Failed to get settings path", "error", err)
		return DefaultSettings(), nil
	}

	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// If file doesn't exist, create it with default settings
			defaultSettings := DefaultSettings()
			if err := SaveSettings(defaultSettings); err != nil {
				log.Error("Failed to create default settings file", "error", err)
				return defaultSettings, nil
			}
			return defaultSettings, nil
		}
		// For any other error, return default settings but log the error
		log.Error("Failed to read settings file", "path", path, "error", err)
		return DefaultSettings(), nil
	}

	var settings Settings
	if err := json.Unmarshal(content, &settings); err != nil {
		// If JSON parsing fails, return default settings but log the error
		log.Error("Failed to parse settings file", "error", err)
		return DefaultSettings(), nil
	}

	return settings, nil
}

// SaveSettings saves settings to the config file
func SaveSettings(settings Settings) error {
	path, err := GetSettingsPath()
	if err != nil {
		log.Error("Failed to get settings path", "error", err)
		return err
	}

	content, err := json.MarshalIndent(settings, "", "    ")
	if err != nil {
		log.Error("Failed to marshal settings", "error", err)
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		log.Error("Failed to write settings file", "path", path, "error", err)
		return fmt.Errorf("failed to write settings file: %w", err)
	}

	return nil
}

// StartWebServer starts the web server
func StartWebServer(port int, cacheDir string) error {
	// Serve static files
	http.Handle("/static/", http.FileServer(http.FS(StaticFS)))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			content, err := TemplateFS.ReadFile("templates/index.html")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/html")
			w.Write(content)
			return
		}

		if r.URL.Path == "/search" {
			query := r.URL.Query().Get("q")
			if query == "" {
				json.NewEncoder(w).Encode([]Result{})
				return
			}

			results, err := Search(query, cacheDir, "")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Convert internal results to JSON-friendly format
			jsonResults := make([]Result, len(results))
			for i, r := range results {
				jsonResults[i] = Result{
					URL:         r.URL,
					Description: r.Description,
					Category:    r.Category,
					Repository:  r.Repository,
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(jsonResults)
			return
		}

		if r.URL.Path == "/favorites" {
			if r.Method == "GET" {
				favorites, err := LoadFavorites()
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(favorites)
				return
			}
		}

		if r.URL.Path == "/favorites/add" {
			if r.Method == "POST" {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				var favorite Favorite
				if err := json.Unmarshal(body, &favorite); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				if err := AddFavorite(favorite); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				w.WriteHeader(http.StatusOK)
				return
			}
		}

		if r.URL.Path == "/favorites/remove" {
			if r.Method == "POST" {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				var favorite Favorite
				if err := json.Unmarshal(body, &favorite); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				if err := RemoveFavorite(favorite); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				w.WriteHeader(http.StatusOK)
				return
			}
		}

		if r.URL.Path == "/settings" {
			w.Header().Set("Content-Type", "application/json")

			if r.Method == "GET" {
				settings, err := LoadSettings()
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
				var settings Settings
				if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
					log.Error("Failed to decode settings from request", "error", err)
					http.Error(w, fmt.Sprintf(`{"error": "Failed to decode settings: %s"}`, err.Error()), http.StatusBadRequest)
					return
				}

				if err := SaveSettings(settings); err != nil {
					log.Error("Failed to save settings", "error", err)
					http.Error(w, fmt.Sprintf(`{"error": "Failed to save settings: %s"}`, err.Error()), http.StatusInternalServerError)
					return
				}

				// Return the saved settings as confirmation
				if err := json.NewEncoder(w).Encode(settings); err != nil {
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

		http.NotFound(w, r)
	})

	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

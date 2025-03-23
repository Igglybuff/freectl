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
	"freectl/internal/settings"

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

// AddRepositoryRequest represents the request to add a new repository
type AddRepositoryRequest struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

// AddRepository adds a new repository to the cache
func AddRepository(cacheDir string, url string, name string) error {
	if url == "" {
		return fmt.Errorf("repository URL is required")
	}

	// If no name is provided, derive it from the URL
	if name == "" {
		name = filepath.Base(url)
		// Remove .git extension if present
		name = strings.TrimSuffix(name, ".git")
	}

	// Get the repository path using the common function
	repoPath := common.GetRepositoryPath(cacheDir, name)

	// Check if repository already exists
	if _, err := os.Stat(repoPath); !os.IsNotExist(err) {
		return fmt.Errorf("repository %s already exists", name)
	}

	// Clone the repository
	log.Info("Cloning repository", "url", url, "name", name)
	cmd := exec.Command("git", "clone", "--depth", "1", url, repoPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to clone repository: %s", string(output))
	}

	log.Info("Repository added successfully", "name", name)
	return nil
}

// StartWebServer starts the web server
func StartWebServer(port int, cacheDir string) error {
	// Initialize logger with stdout
	logger := log.NewWithOptions(os.Stdout, log.Options{
		ReportCaller:    true,
		ReportTimestamp: true,
		Level:           log.DebugLevel,
	})
	log.SetDefault(logger)

	log.Info("Starting web server", "port", port, "cache_dir", cacheDir)

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
				s, err := settings.LoadSettings()
				if err != nil {
					log.Error("Failed to load settings", "error", err)
					http.Error(w, fmt.Sprintf(`{"error": "%s"}`, err.Error()), http.StatusInternalServerError)
					return
				}

				if err := json.NewEncoder(w).Encode(s); err != nil {
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

		http.NotFound(w, r)
	})

	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

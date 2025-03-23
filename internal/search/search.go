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

// isContentFile returns true if the file is likely to contain content links
func isContentFile(path string) bool {
	// List of common non-content files to ignore
	ignoreFiles := []string{
		"README.md",
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
		"docs/README.md",
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
				if strings.HasPrefix(line, "# ") {
					lastHeading = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "# ")))
					continue
				}
				if strings.HasPrefix(line, "## ") {
					lastHeading = common.CleanCategory(strings.TrimSpace(strings.TrimPrefix(line, "## ")))
					continue
				}

				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}

				if strings.Contains(line, "http") || strings.Contains(line, "www.") {
					cleanLine := common.CleanMarkdown(line)
					url := common.ExtractURL(cleanLine)
					if url != "" {
						// Extract description by removing the URL and any surrounding brackets/parentheses
						description := cleanLine
						description = strings.ReplaceAll(description, url, "")
						description = strings.Trim(description, "[]() ")
						if description == "" {
							description = url // Fallback to URL if no description found
						}

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

// StartWebServer starts the web server
func StartWebServer(port int, cacheDir string) error {
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

		http.NotFound(w, r)
	})

	return http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
}

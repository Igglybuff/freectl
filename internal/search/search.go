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
	"runtime"
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

type Result struct {
	URL         string `json:"url"`
	Description string `json:"description"`
	Line        string `json:"-"`
	Score       int    `json:"-"`
	Category    string `json:"title"`
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

// UpdateRepo pulls the latest changes from the repository
func UpdateRepo(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "pull")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Search performs the actual search operation
func Search(query string, cacheDir string) ([]Result, error) {
	log.Info("Starting search", "query", query, "cacheDir", cacheDir)

	if len(cacheDir) >= 2 && cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	repoPath := filepath.Join(cacheDir, "FMHY")
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("repository not found. Please run 'freectl update' first")
	}

	docsPath := filepath.Join(repoPath, "docs")
	log.Info("Searching in docs directory", "path", docsPath)

	var results []Result
	var mu sync.Mutex

	entries, err := os.ReadDir(docsPath)
	if err != nil {
		return nil, fmt.Errorf("error reading docs directory: %w", err)
	}

	log.Info("Found markdown files", "count", len(entries))

	numWorkers := runtime.NumCPU()
	jobs := make(chan string, len(entries))
	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for path := range jobs {
				content, err := os.ReadFile(path)
				if err != nil {
					log.Error("Error reading file", "path", path, "error", err)
					continue
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
									"category", lastHeading)

								if matches[0].Score >= -200 {
									mu.Lock()
									results = append(results, Result{
										URL:         url,
										Description: description,
										Line:        cleanLine,
										Score:       matches[0].Score,
										Category:    lastHeading,
									})
									mu.Unlock()
								}
							}
						}
					}
				}
			}
		}()
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		jobs <- filepath.Join(docsPath, entry.Name())
	}
	close(jobs)
	wg.Wait()

	log.Info("Search complete", "results", len(results))

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	return results, nil
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

			results, err := Search(query, cacheDir)
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

				if err := AddFavorite(favorite.Link, favorite.Description, favorite.Category); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				log.Info("Added favorite",
					"link", favorite.Link,
					"description", favorite.Description,
					"category", favorite.Category)

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]bool{"success": true})
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

				if err := RemoveFavorite(favorite.Link); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				log.Info("Removed favorite",
					"link", favorite.Link,
					"description", favorite.Description,
					"category", favorite.Category)

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]bool{"success": true})
				return
			}
		}

		http.NotFound(w, r)
	})

	addr := fmt.Sprintf(":%d", port)
	log.Info("Starting web server", "addr", addr)
	return http.ListenAndServe(addr, nil)
}

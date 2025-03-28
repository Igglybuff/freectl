package search

import (
	"bufio"
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"freectl/internal/common"
	"freectl/internal/settings"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/sahilm/fuzzy"
)

//go:embed templates/index.html
var TemplateFS embed.FS

//go:embed static/*
var StaticFS embed.FS

type Result struct {
	URL         string `json:"url"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Line        string `json:"-"`
	Score       int    `json:"-"`
	Category    string `json:"title"`
	Source      string `json:"source"`
}

// CheckSourceAge checks if the source needs updating
func CheckSourceAge(sourcePath string) (bool, error) {
	cmd := exec.Command("git", "-C", sourcePath, "log", "-1", "--format=%ct")
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

// PromptForUpdate asks the user if they want to update the source
func PromptForUpdate() bool {
	fmt.Print("Source is more than a week old. Would you like to update it? [Y/n] ")
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

// Search performs a fuzzy search across all markdown files in the sources
func Search(query string, cacheDir string, sourceName string, settings settings.Settings) ([]Result, error) {
	// Get list of sources
	sourceList, err := sources.List(cacheDir)
	if err != nil {
		return nil, fmt.Errorf("failed to get sources: %w", err)
	}

	log.Info("Found sources", "count", len(sourceList), "cacheDir", cacheDir)
	if len(sourceList) == 0 {
		return nil, fmt.Errorf("no sources found in %s", cacheDir)
	}

	// Filter by source name if specified
	if sourceName != "" {
		var filteredSources []sources.Source
		for _, source := range sourceList {
			if source.Name == sourceName {
				filteredSources = append(filteredSources, source)
				break
			}
		}
		if len(filteredSources) == 0 {
			return nil, fmt.Errorf("source '%s' not found", sourceName)
		}
		sourceList = filteredSources
		log.Info("Filtered sources", "count", len(sourceList), "sourceName", sourceName)
	}

	// Filter out disabled sources
	var enabledSources []sources.Source
	for _, source := range sourceList {
		if source.Enabled {
			enabledSources = append(enabledSources, source)
			log.Debug("Source enabled", "name", source.Name)
		} else {
			log.Debug("Source disabled", "name", source.Name)
		}
	}
	log.Info("Enabled sources", "count", len(enabledSources))

	var allResults []Result
	var mu sync.Mutex

	// Search in each enabled source
	for _, source := range enabledSources {
		sourcePath := source.Path
		log.Info("Searching in source", "name", source.Name, "path", sourcePath)

		// Walk through all markdown files in the source
		err := filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
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

			log.Debug("Processing markdown file", "path", path)
			content, err := os.ReadFile(path)
			if err != nil {
				log.Error("Error reading file", "path", path, "error", err)
				return nil
			}

			lines := strings.Split(string(content), "\n")
			var lastHeading string
			linkCount := 0
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
						linkCount++
						cleanLine := common.CleanMarkdown(line)
						url := common.ExtractURL(cleanLine)
						if url != "" {
							log.Debug("Found link in file",
								"path", path,
								"line", line,
								"url", url)

							// Extract description - everything after the URL and dash
							parts := strings.SplitN(cleanLine, "-", 2)
							description := url // Default to URL if no description

							// First try to get the link text [text](url)
							start := strings.Index(line, "[")
							end := strings.Index(line, "]")
							linkText := ""
							if start != -1 && end != -1 && start < end {
								linkText = line[start+1 : end]
							}

							if len(parts) > 1 {
								description = strings.TrimSpace(parts[1])
							}

							// Clean the description
							description = common.CleanDescription(description)

							// Search in both the description and the full line
							matches := fuzzy.Find(query, []string{description, cleanLine})
							if len(matches) > 0 {
								log.Debug("Found match",
									"score", matches[0].Score,
									"minScore", settings.MinFuzzyScore,
									"name", linkText,
									"description", description,
									"line", cleanLine,
									"category", lastHeading,
									"source", source.Name,
									"allMatches", len(matches))

								// Check if the score meets the minimum threshold
								if matches[0].Score >= settings.MinFuzzyScore {
									mu.Lock()
									allResults = append(allResults, Result{
										URL:         url,
										Name:        linkText,
										Description: description,
										Line:        cleanLine,
										Score:       matches[0].Score,
										Category:    lastHeading,
										Source:      source.Name, // Keep this field name for backward compatibility
									})
									mu.Unlock()
									log.Debug("Added result to allResults",
										"totalResults", len(allResults),
										"score", matches[0].Score,
										"name", linkText)
								} else {
									log.Debug("Result below minimum score threshold",
										"score", matches[0].Score,
										"minScore", settings.MinFuzzyScore,
										"name", linkText)
								}
							}
						}
					}
				}
			}
			return nil
		})

		if err != nil {
			log.Error("Error walking source", "source", source.Name, "error", err)
			continue
		}
	}

	log.Info("Search completed", "totalResults", len(allResults))
	// Sort results by score
	sort.Slice(allResults, func(i, j int) bool {
		return allResults[i].Score > allResults[j].Score
	})

	// Normalize scores relative to the highest score
	if len(allResults) > 0 {
		maxScore := allResults[0].Score
		for i := range allResults {
			// Convert to a percentage (0-100) and round to nearest integer
			allResults[i].Score = int((float64(allResults[i].Score) / float64(maxScore)) * 100)
		}
	}

	return allResults, nil
}

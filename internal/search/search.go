package search

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

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

// parseHeading extracts heading text and level from a line
func parseHeading(line string) (text string, level int) {
	switch {
	case strings.HasPrefix(line, "### "):
		return strings.TrimSpace(strings.TrimPrefix(line, "### ")), 3
	case strings.HasPrefix(line, "## "):
		return strings.TrimSpace(strings.TrimPrefix(line, "## ")), 2
	case strings.HasPrefix(line, "# "):
		return strings.TrimSpace(strings.TrimPrefix(line, "# ")), 1
	default:
		return "", 0
	}
}

// cleanHeadingText removes markdown formatting from heading text
func cleanHeadingText(text string) string {
	// Remove markdown formatting like ** and []
	text = strings.TrimPrefix(text, "**")
	text = strings.TrimSuffix(text, "**")
	if start := strings.Index(text, "["); start != -1 {
		if end := strings.Index(text, "]"); end != -1 {
			text = text[:start] + text[start+1:end] + text[end+1:]
		}
	}
	return strings.TrimSpace(text)
}

// extractLinkText gets the text portion of a markdown link
func extractLinkText(line string) string {
	if start := strings.Index(line, "["); start != -1 {
		if end := strings.Index(line[start:], "]"); end != -1 {
			return line[start+1 : start+end]
		}
	}
	return ""
}

// cleanLine removes common markdown formatting and special characters
func cleanLine(line string) string {
	// Remove blockquote markers if present
	line = strings.TrimPrefix(strings.TrimSpace(line), ">")
	line = strings.TrimSpace(line)

	// Remove bullet points if present
	if strings.HasPrefix(line, "*") || strings.HasPrefix(line, "-") {
		line = strings.TrimPrefix(line, "*")
		line = strings.TrimPrefix(line, "-")
		line = strings.TrimSpace(line)
	}

	// Replace HTML entities with spaces
	line = strings.ReplaceAll(line, "&nbsp;", " ")
	return strings.TrimSpace(line)
}

// processHeading handles a heading line, updating lastHeading and checking for links
func processHeading(line string, source sources.Source, query string, minScore int, allResults *[]Result, mu *sync.Mutex) string {
	headingText, _ := parseHeading(line)
	lastHeading := common.CleanCategory(headingText)

	// Check for links in heading
	if strings.Contains(line, "http") || strings.Contains(line, "www.") {
		cleanHeading := cleanHeadingText(headingText)
		cleanLine := common.CleanMarkdown(line)
		url := common.ExtractURL(cleanLine)
		if url != "" {
			linkText := extractLinkText(line)
			if linkText == "" {
				linkText = cleanHeading
			}
			processLink(url, linkText, cleanLine, cleanHeading, source.Name, query, minScore, allResults, mu)
		}
	}

	return lastHeading
}

// processContentLine handles a non-heading line, looking for links
func processContentLine(line, lastHeading string, source sources.Source, query string, minScore int, allResults *[]Result, mu *sync.Mutex) {
	if !strings.Contains(line, "http") && !strings.Contains(line, "www.") {
		return
	}

	cleanedLine := cleanLine(line)
	cleanedLine = common.CleanMarkdown(cleanedLine)
	url := common.ExtractURL(cleanedLine)
	if url == "" {
		return
	}

	// Extract link text - try different formats
	linkText := extractLinkText(line)

	// If no markdown format found, try to extract text near the URL
	if linkText == "" {
		urlIndex := strings.Index(cleanedLine, url)
		if urlIndex > 0 {
			// Try to get text before the URL
			beforeURL := strings.TrimSpace(cleanedLine[:urlIndex])
			if beforeURL != "" {
				linkText = beforeURL
			}
		}
		// If still no text, use the domain name
		if linkText == "" {
			domain := common.ExtractDomain(url)
			if domain != "" {
				linkText = domain
			} else {
				linkText = url
			}
		}
	}

	processLink(url, linkText, cleanedLine, lastHeading, source.Name, query, minScore, allResults, mu)
}

// processLink handles the processing and adding of a link to the results
func processLink(url, linkText, cleanLine, category, sourceName, query string, minScore int, allResults *[]Result, mu *sync.Mutex) {
	// Extract description - try different patterns
	var description string

	// First try: everything after a dash
	parts := strings.SplitN(cleanLine, "-", 2)
	if len(parts) > 1 {
		description = strings.TrimSpace(parts[1])
	} else {
		// Second try: everything after the URL
		urlIndex := strings.Index(cleanLine, url)
		if urlIndex != -1 {
			afterURL := cleanLine[urlIndex+len(url):]
			// Remove any remaining markdown syntax
			afterURL = strings.TrimPrefix(afterURL, ")")
			afterURL = strings.TrimSpace(afterURL)
			if afterURL != "" {
				description = afterURL
			} else {
				description = url // Default to URL if no description found
			}
		} else {
			description = url
		}
	}

	// Clean the description
	description = common.CleanDescription(description)

	// Search in both the description and the full line
	matches := fuzzy.Find(query, []string{description, cleanLine})
	if len(matches) > 0 {
		log.Debug("Found match",
			"score", matches[0].Score,
			"minScore", minScore,
			"name", linkText,
			"description", description,
			"line", cleanLine,
			"category", category,
			"source", sourceName,
			"allMatches", len(matches))

		// Check if the score meets the minimum threshold
		if matches[0].Score >= minScore {
			mu.Lock()
			*allResults = append(*allResults, Result{
				URL:         url,
				Name:        linkText,
				Description: description,
				Line:        cleanLine,
				Score:       matches[0].Score,
				Category:    category,
				Source:      sourceName,
			})
			mu.Unlock()
			log.Debug("Added result to allResults",
				"totalResults", len(*allResults),
				"score", matches[0].Score,
				"name", linkText)
		} else {
			log.Debug("Result below minimum score threshold",
				"score", matches[0].Score,
				"minScore", minScore,
				"name", linkText)
		}
	}
}

// Search performs a fuzzy search across all markdown files in the sources
func Search(query string, sourceName string, s settings.Settings) ([]Result, error) {
	// Get list of sources from settings
	sourceList := s.Sources
	if sourceList == nil {
		return nil, fmt.Errorf("no sources found in settings")
	}

	log.Info("Found sources", "count", len(sourceList), "cacheDir", s.CacheDir)
	if len(sourceList) == 0 {
		return nil, fmt.Errorf("no sources found in %s", s.CacheDir)
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

			for _, line := range lines {
				// Skip empty lines and horizontal rules
				trimmedLine := strings.TrimSpace(line)
				if trimmedLine == "" || trimmedLine == "---" || trimmedLine == "&nbsp;" {
					continue
				}

				// Check if it's a heading
				if _, level := parseHeading(line); level > 0 {
					lastHeading = processHeading(line, source, query, s.MinFuzzyScore, &allResults, &mu)
					continue
				}

				// Process regular content line
				processContentLine(line, lastHeading, source, query, s.MinFuzzyScore, &allResults, &mu)
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

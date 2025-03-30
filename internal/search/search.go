package search

import (
	"fmt"
	"net/url"
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
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

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
	}

	for _, nonContentDir := range nonContentDirs {
		if strings.Contains(dir, nonContentDir) {
			return false
		}
	}

	return true
}

// getNodeText extracts text content from a goldmark AST node
func getNodeText(n ast.Node, source []byte) string {
	var text strings.Builder

	// Handle block nodes with Lines
	if n.Kind() == ast.KindParagraph || n.Kind() == ast.KindHeading {
		lines := n.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			text.Write(line.Value(source))
		}
		return text.String()
	}

	// Handle inline nodes and their children
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		switch c.Kind() {
		case ast.KindText:
			if textNode, ok := c.(*ast.Text); ok {
				segment := textNode.Segment
				text.Write(segment.Value(source))
			}
		case ast.KindString:
			if strNode, ok := c.(*ast.String); ok {
				text.Write(strNode.Value)
			}
		default:
			// Recursively get text from other node types
			text.WriteString(getNodeText(c, source))
		}
	}

	// If no children and this is a text node, get its value
	if text.Len() == 0 && n.Kind() == ast.KindText {
		if textNode, ok := n.(*ast.Text); ok {
			segment := textNode.Segment
			text.Write(segment.Value(source))
		}
	}

	return text.String()
}

// isLocalhost checks if a URL points to local location (localhost, 127.0.0.1, #shortcut, etc.)
func isLocalURL(urlStr string) bool {
	if strings.HasPrefix(urlStr, "#") {
		return true
	}

	u, err := url.Parse(urlStr)
	if err != nil {
		return false
	}

	// If there's no host component, it's a relative URL
	if u.Host == "" {
		return true
	}

	host := u.Hostname()
	return host == "localhost" ||
		host == "127.0.0.1" ||
		host == "::1" ||
		host == "[::1]" ||
		strings.HasSuffix(host, ".localhost")
}

// Search performs a fuzzy search across all markdown files using goldmark for parsing
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
	}

	// Filter out disabled sources
	var enabledSources []sources.Source
	for _, source := range sourceList {
		if source.Enabled {
			enabledSources = append(enabledSources, source)
		}
	}

	var allResults []Result
	var mu sync.Mutex

	// Initialize goldmark with GitHub Flavored Markdown
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

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

			// Parse the markdown content
			doc := md.Parser().Parse(text.NewReader(content))

			// Track headings by level
			headings := make(map[int]string)
			var currentLevel int
			var currentContext string
			var contextNode ast.Node
			var insideHeading bool

			// Walk through the AST
			ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
				if !entering {
					if n == contextNode {
						currentContext = ""
						contextNode = nil
					}
					if _, ok := n.(*ast.Heading); ok {
						insideHeading = false
					}
					return ast.WalkContinue, nil
				}

				switch v := n.(type) {
				case *ast.Heading:
					headingText := getNodeText(v, content)
					cleanHeading := common.CleanCategory(headingText)
					currentLevel = v.Level
					headings[currentLevel] = cleanHeading
					currentContext = headingText
					contextNode = v
					insideHeading = true

				case *ast.Paragraph, *ast.ListItem:
					currentContext = getNodeText(v, content)
					contextNode = v

				case *ast.Link:
					// Get the link destination
					destination := v.Destination
					if len(destination) == 0 {
						return ast.WalkContinue, nil
					}
					url := string(destination)

					// Get link text
					linkText := getNodeText(v, content)
					if linkText == "" {
						linkText = url
					}

					// Skip single-character link texts
					if len(strings.TrimSpace(linkText)) <= 1 {
						return ast.WalkContinue, nil
					}

					// Use the current context as description
					var description string
					if currentContext != "" {
						description = common.CleanDescription(currentContext)
					} else {
						description = linkText
					}

					// Search in both description and link text
					matches := fuzzy.Find(query, []string{description, linkText})
					if len(matches) > 0 && matches[0].Score >= s.MinFuzzyScore {
						if isLocalURL(url) {
							return ast.WalkContinue, nil
						}

						// Find the nearest parent heading
						category := "n/a"
						// If we're inside a heading, look for the parent heading
						if insideHeading {
							for level := currentLevel - 1; level >= 1; level-- {
								if parent, ok := headings[level]; ok {
									category = common.CleanCategory(parent)
									break
								}
							}
						} else {
							// Otherwise, look for the nearest heading
							for level := currentLevel; level >= 1; level-- {
								if parent, ok := headings[level]; ok {
									category = common.CleanCategory(parent)
									break
								}
							}
						}

						mu.Lock()
						allResults = append(allResults, Result{
							URL:         url,
							Name:        linkText,
							Description: description,
							Line:        description,
							Score:       matches[0].Score,
							Category:    category,
							Source:      source.Name,
						})
						mu.Unlock()
					}
				}

				return ast.WalkContinue, nil
			})

			return nil
		})

		if err != nil {
			log.Error("Error walking source", "source", source.Name, "error", err)
			continue
		}
	}

	// Sort results by score
	sort.Slice(allResults, func(i, j int) bool {
		return allResults[i].Score > allResults[j].Score
	})

	// Normalize scores
	if len(allResults) > 0 {
		maxScore := allResults[0].Score
		for i := range allResults {
			allResults[i].Score = int((float64(allResults[i].Score) / float64(maxScore)) * 100)
		}
	}

	return allResults, nil
}

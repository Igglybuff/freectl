package extractors

import (
	"fmt"
	"strings"
	"time"

	"freectl/internal/common"

	"github.com/charmbracelet/log"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// MarkdownExtractor extracts links from markdown content using multiple strategies
type MarkdownExtractor struct {
	config     ProcessingConfig
	strategies []Strategy
	markdown   goldmark.Markdown
}

// NewMarkdownExtractor creates a new markdown extractor
func NewMarkdownExtractor(config ProcessingConfig) *MarkdownExtractor {
	// Initialize goldmark with GitHub Flavored Markdown
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
	)

	extractor := &MarkdownExtractor{
		config:   config,
		markdown: md,
	}

	// Initialize strategies in order of preference
	extractor.strategies = []Strategy{
		NewStructuredMarkdownStrategy(md),
		NewRegexMarkdownStrategy(),
		NewSimpleMarkdownStrategy(),
	}

	return extractor
}

// Extract processes markdown content and returns extracted items
func (me *MarkdownExtractor) Extract(content []byte, source SourceMetadata) (*ExtractionResult, error) {
	startTime := time.Now()

	context := ExtractionContext{
		Source: source,
		Config: me.config,
	}

	var allItems []RawItem
	var errors []string
	var strategyUsed string

	// Try each strategy until one succeeds
	for _, strategy := range me.strategies {
		if !strategy.CanHandle(content) {
			continue
		}

		log.Debug("Trying extraction strategy", "strategy", strategy.Name(), "source", source.Name)

		items, err := strategy.Extract(content, context)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s strategy failed: %v", strategy.Name(), err))
			continue
		}

		if len(items) > 0 {
			allItems = items
			strategyUsed = strategy.Name()
			break
		}
	}

	// If no strategy produced results, combine all attempts
	if len(allItems) == 0 {
		log.Warn("All strategies failed or produced no results", "source", source.Name)

		// Try simple strategy as last resort
		simpleStrategy := NewSimpleMarkdownStrategy()
		items, err := simpleStrategy.Extract(content, context)
		if err != nil {
			errors = append(errors, fmt.Sprintf("fallback strategy failed: %v", err))
		} else {
			allItems = items
			strategyUsed = simpleStrategy.Name()
		}
	}

	stats := ExtractionStats{
		TotalItems:     len(allItems),
		ValidItems:     len(allItems),
		ProcessingTime: time.Since(startTime),
		ExtractorUsed:  strategyUsed,
	}

	return &ExtractionResult{
		Items:  allItems,
		Errors: errors,
		Stats:  stats,
	}, nil
}

// CanHandle returns true if this extractor can handle the given content
func (me *MarkdownExtractor) CanHandle(content []byte, sourceType string) bool {
	// Handle explicit markdown source types
	if sourceType == "git" || sourceType == "markdown" {
		return true
	}

	// For unknown source types, check if any strategy can handle the content
	for _, strategy := range me.strategies {
		if strategy.CanHandle(content) {
			return true
		}
	}

	return false
}

// Priority returns the priority of this extractor
func (me *MarkdownExtractor) Priority() int {
	return 100
}

// Name returns the name of this extractor
func (me *MarkdownExtractor) Name() string {
	return "markdown"
}

// StructuredMarkdownStrategy uses goldmark AST parsing for well-structured markdown
type StructuredMarkdownStrategy struct {
	markdown goldmark.Markdown
}

// NewStructuredMarkdownStrategy creates a new structured markdown strategy
func NewStructuredMarkdownStrategy(md goldmark.Markdown) Strategy {
	return &StructuredMarkdownStrategy{
		markdown: md,
	}
}

// Extract extracts items using goldmark AST parsing
func (sms *StructuredMarkdownStrategy) Extract(content []byte, context ExtractionContext) ([]RawItem, error) {
	// Parse the markdown content
	doc := sms.markdown.Parser().Parse(text.NewReader(content))

	var items []RawItem

	// Track heading hierarchy
	headings := make(map[int]string)
	var currentContext string
	var currentFile string

	// Extract current file from content if it has file markers
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "<!-- FILE: ") && strings.HasSuffix(line, " -->") {
			currentFile = strings.TrimSuffix(strings.TrimPrefix(line, "<!-- FILE: "), " -->")
		}
	}

	// Walk through the AST
	ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}

		switch v := n.(type) {
		case *ast.Heading:
			headingText := getNodeText(v, content)
			cleanHeading := common.CleanCategory(headingText)

			// Skip misleading headings or invalid categories
			if isMisleadingHeading(cleanHeading) || common.IsInvalidCategory(cleanHeading) {
				return ast.WalkSkipChildren, nil
			}

			headings[v.Level] = cleanHeading
			currentContext = headingText

		case *ast.Link:
			// Get the link destination
			destination := v.Destination
			if len(destination) == 0 {
				return ast.WalkContinue, nil
			}
			urlStr := string(destination)

			// Skip local/invalid URLs
			if isLocalURL(urlStr) {
				return ast.WalkContinue, nil
			}

			// Get link text
			linkText := getNodeText(v, content)
			if linkText == "" {
				linkText = urlStr
			}

			// Skip single-character link texts
			if len(strings.TrimSpace(linkText)) <= 1 {
				return ast.WalkContinue, nil
			}

			// Build heading hierarchy
			var hierarchy []string
			for level := 1; level <= 6; level++ {
				if heading, ok := headings[level]; ok {
					hierarchy = append(hierarchy, heading)
				}
			}

			// Determine category from hierarchy
			category := "Uncategorized"
			if len(hierarchy) > 0 {
				category = hierarchy[len(hierarchy)-1]
			}

			// Create raw item
			item := RawItem{
				URL:            urlStr,
				Name:           strings.TrimSpace(linkText),
				Description:    common.CleanDescription(strings.TrimSpace(currentContext)),
				Context:        currentContext,
				RawText:        getNodeText(n.Parent(), content),
				HeadingContext: hierarchy,
				Metadata: map[string]interface{}{
					"file_path": currentFile,
					"category":  category,
					"hierarchy": hierarchy,
				},
			}

			items = append(items, item)
		}

		return ast.WalkContinue, nil
	})

	return items, nil
}

// CanHandle returns true if this strategy can handle the content
func (sms *StructuredMarkdownStrategy) CanHandle(content []byte) bool {
	// Check if content has structured markdown elements
	contentStr := string(content)
	hasHeaders := strings.Contains(contentStr, "# ") || strings.Contains(contentStr, "## ")
	hasLinks := strings.Contains(contentStr, "[") && strings.Contains(contentStr, "](")
	return hasHeaders && hasLinks
}

// Priority returns the priority of this strategy
func (sms *StructuredMarkdownStrategy) Priority() int {
	return 100
}

// Name returns the name of this strategy
func (sms *StructuredMarkdownStrategy) Name() string {
	return "structured"
}

// RegexMarkdownStrategy uses regex patterns to extract links
type RegexMarkdownStrategy struct {
}

// NewRegexMarkdownStrategy creates a new regex-based strategy
func NewRegexMarkdownStrategy() Strategy {
	return &RegexMarkdownStrategy{}
}

// Extract extracts items using regex patterns
func (rms *RegexMarkdownStrategy) Extract(content []byte, context ExtractionContext) ([]RawItem, error) {
	contentStr := string(content)
	lines := strings.Split(contentStr, "\n")

	var items []RawItem
	var currentHeading string
	var currentFile string

	for lineNum, line := range lines {
		originalLine := line
		line = strings.TrimSpace(line)

		// Track file changes
		if strings.HasPrefix(line, "<!-- FILE: ") && strings.HasSuffix(line, " -->") {
			currentFile = strings.TrimSuffix(strings.TrimPrefix(line, "<!-- FILE: "), " -->")
			continue
		}

		// Track headings
		if strings.HasPrefix(line, "#") {
			currentHeading = common.CleanCategory(strings.TrimSpace(strings.TrimLeft(line, "#")))
			if isMisleadingHeading(currentHeading) || common.IsInvalidCategory(currentHeading) {
				currentHeading = "Uncategorized"
			}
			continue
		}

		// Use existing markdown link extraction
		linkText, urlStr := common.ExtractMarkdownLink(line)
		if linkText != "" && urlStr != "" {
			// Skip invalid links
			if len(linkText) <= 1 || isLocalURL(urlStr) {
				continue
			}

			category := currentHeading
			if category == "" {
				category = "Uncategorized"
			}

			// Clean the description using existing utilities
			description := common.CleanDescription(common.CleanMarkdown(originalLine))

			item := RawItem{
				URL:            urlStr,
				Name:           linkText,
				Description:    description,
				Context:        originalLine,
				RawText:        originalLine,
				HeadingContext: []string{category},
				Metadata: map[string]interface{}{
					"file_path":   currentFile,
					"line_number": lineNum + 1,
					"category":    category,
				},
			}

			items = append(items, item)
		}
	}

	return items, nil
}

// CanHandle returns true if this strategy can handle the content
func (rms *RegexMarkdownStrategy) CanHandle(content []byte) bool {
	contentStr := string(content)
	return strings.Contains(contentStr, "[") && strings.Contains(contentStr, "](")
}

// Priority returns the priority of this strategy
func (rms *RegexMarkdownStrategy) Priority() int {
	return 50
}

// Name returns the name of this strategy
func (rms *RegexMarkdownStrategy) Name() string {
	return "regex"
}

// SimpleMarkdownStrategy uses simple URL extraction
type SimpleMarkdownStrategy struct {
}

// NewSimpleMarkdownStrategy creates a new simple strategy
func NewSimpleMarkdownStrategy() Strategy {
	return &SimpleMarkdownStrategy{}
}

// Extract extracts items using simple URL detection
func (sms *SimpleMarkdownStrategy) Extract(content []byte, context ExtractionContext) ([]RawItem, error) {
	contentStr := string(content)
	lines := strings.Split(contentStr, "\n")

	var items []RawItem
	var currentHeading string
	var currentFile string

	for lineNum, line := range lines {
		originalLine := line
		line = strings.TrimSpace(line)

		// Track file changes
		if strings.HasPrefix(line, "<!-- FILE: ") && strings.HasSuffix(line, " -->") {
			currentFile = strings.TrimSuffix(strings.TrimPrefix(line, "<!-- FILE: "), " -->")
			continue
		}

		// Track headings
		if strings.HasPrefix(line, "#") {
			currentHeading = common.CleanCategory(strings.TrimSpace(strings.TrimLeft(line, "#")))
			if isMisleadingHeading(currentHeading) || common.IsInvalidCategory(currentHeading) {
				currentHeading = "Uncategorized"
			}
			continue
		}

		// Use existing URL extraction
		urlStr := common.ExtractURL(line)
		if urlStr != "" {
			// Skip local URLs
			if isLocalURL(urlStr) {
				continue
			}

			// Try to extract a name from the surrounding text
			name := extractNameFromContext(originalLine, urlStr)
			if name == "" {
				// Use domain as fallback name
				domain := common.ExtractDomain(urlStr)
				if domain != "" {
					name = domain
				} else {
					name = urlStr
				}
			}

			category := currentHeading
			if category == "" {
				category = "Uncategorized"
			}

			// Clean the description using existing utilities
			description := common.CleanDescription(common.CleanMarkdown(originalLine))

			item := RawItem{
				URL:            urlStr,
				Name:           name,
				Description:    description,
				Context:        originalLine,
				RawText:        originalLine,
				HeadingContext: []string{category},
				Metadata: map[string]interface{}{
					"file_path":   currentFile,
					"line_number": lineNum + 1,
					"category":    category,
				},
			}

			items = append(items, item)
		}
	}

	return items, nil
}

// CanHandle returns true if this strategy can handle the content
func (sms *SimpleMarkdownStrategy) CanHandle(content []byte) bool {
	return strings.Contains(string(content), "http")
}

// Priority returns the priority of this strategy
func (sms *SimpleMarkdownStrategy) Priority() int {
	return 1
}

// Name returns the name of this strategy
func (sms *SimpleMarkdownStrategy) Name() string {
	return "simple"
}

// Helper functions

// getNodeText extracts text content from a goldmark AST node
func getNodeText(n ast.Node, source []byte) string {
	var text strings.Builder

	// Handle different node types
	switch n.Kind() {
	case ast.KindParagraph, ast.KindHeading:
		lines := n.Lines()
		for i := 0; i < lines.Len(); i++ {
			line := lines.At(i)
			text.Write(line.Value(source))
		}
		return strings.TrimSpace(text.String())
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
			text.WriteString(getNodeText(c, source))
		}
	}

	return strings.TrimSpace(text.String())
}

// Note: cleanCategory function removed - using common.CleanCategory instead

// isMisleadingHeading checks if a heading is likely misleading (like "Contents")
func isMisleadingHeading(heading string) bool {
	misleadingHeadings := []string{
		"contents", "table of contents", "toc", "index",
		"contributing", "license", "changelog", "authors",
		"installation", "usage", "getting started",
	}

	headingLower := strings.ToLower(heading)
	for _, misleading := range misleadingHeadings {
		if headingLower == misleading {
			return true
		}
	}

	return false
}

// isLocalURL checks if a URL points to local location
func isLocalURL(urlStr string) bool {
	if strings.HasPrefix(urlStr, "#") {
		return true
	}

	// Use existing URL validation - if ExtractURL returns empty, it's invalid
	if common.ExtractURL(urlStr) == "" {
		return true
	}

	// Extract domain using existing utility
	domain := common.ExtractDomain(urlStr)
	if domain == "" {
		return true
	}

	// Check for local domains
	return domain == "localhost" ||
		domain == "127.0.0.1" ||
		domain == "::1" ||
		domain == "[::1]" ||
		strings.HasSuffix(domain, ".localhost") ||
		strings.HasPrefix(domain, "192.168.") ||
		strings.HasPrefix(domain, "10.") ||
		strings.HasPrefix(domain, "172.")
}

// extractNameFromContext tries to extract a meaningful name from the line context
func extractNameFromContext(line, urlStr string) string {
	// Remove the URL from the line to get potential name
	lineWithoutURL := common.RemoveURLs(line)

	// Use existing description cleaning
	cleanedName := common.CleanDescription(lineWithoutURL)

	// If we have meaningful text, use it
	if len(cleanedName) > 3 && len(cleanedName) < 200 {
		return cleanedName
	}

	return ""
}

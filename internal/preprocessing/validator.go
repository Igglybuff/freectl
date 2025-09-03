package preprocessing

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// DefaultValidator implements ItemValidator with standard validation and cleaning logic
type DefaultValidator struct {
	config   ProcessingConfig
	urlRegex *regexp.Regexp
}

// NewDefaultValidator creates a new default validator
func NewDefaultValidator(config ProcessingConfig) ItemValidator {
	// Regex for basic URL validation
	urlRegex := regexp.MustCompile(`^https?://[^\s<>"{}|\\^` + "`" + `\[\]]+$`)

	return &DefaultValidator{
		config:   config,
		urlRegex: urlRegex,
	}
}

// Validate checks if a raw item is valid
func (dv *DefaultValidator) Validate(item RawItem) error {
	// Check if URL is present
	if item.URL == "" {
		return fmt.Errorf("URL is required")
	}

	// Basic URL format validation
	if !dv.urlRegex.MatchString(item.URL) {
		return fmt.Errorf("invalid URL format: %s", item.URL)
	}

	// Parse URL to ensure it's valid
	parsedURL, err := url.Parse(item.URL)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}

	// Check if URL has a valid scheme
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("invalid URL scheme: %s", parsedURL.Scheme)
	}

	// Check if URL has a host
	if parsedURL.Host == "" {
		return fmt.Errorf("URL missing host")
	}

	// Check if name is present and reasonable
	if item.Name == "" {
		return fmt.Errorf("name is required")
	}

	// Check name length
	if len(item.Name) > 500 {
		return fmt.Errorf("name too long (max 500 characters)")
	}

	// Check if name contains only valid UTF-8
	if !utf8.ValidString(item.Name) {
		return fmt.Errorf("name contains invalid UTF-8")
	}

	// Validate description length if present
	if len(item.Description) > dv.config.MaxDescriptionLength*2 {
		return fmt.Errorf("description too long (max %d characters)", dv.config.MaxDescriptionLength*2)
	}

	return nil
}

// Clean cleans and normalizes a raw item into a processed item
func (dv *DefaultValidator) Clean(item RawItem) ProcessedItem {
	now := time.Now()

	// Generate unique ID
	id := dv.generateID(item)

	// Clean URL
	cleanURL := dv.cleanURL(item.URL)

	// Clean name
	cleanName := dv.cleanName(item.Name)

	// Clean description
	cleanDescription := dv.cleanDescription(item.Description)

	// Extract category from metadata or heading context
	category := dv.extractCategory(item)

	// Extract subcategory if possible
	subcategory := dv.extractSubcategory(item)

	// Extract tags
	tags := dv.extractTags(item)

	// Clean source context
	sourceContext := dv.cleanSourceContext(item.Context)

	// Build metadata
	metadata := ItemMetadata{
		ExtractorUsed: "markdown", // This should come from the extraction context
		Confidence:    dv.calculateConfidence(item),
	}

	// Add file path if available
	if filePath, ok := item.Metadata["file_path"].(string); ok {
		metadata.FilePath = filePath
	}

	// Add line number if available
	if lineNum, ok := item.Metadata["line_number"].(int); ok {
		metadata.LineNumber = lineNum
	}

	// Add heading hierarchy if available
	if hierarchy, ok := item.Metadata["hierarchy"].([]string); ok {
		metadata.HeadingHierarchy = hierarchy
	} else if len(item.HeadingContext) > 0 {
		metadata.HeadingHierarchy = item.HeadingContext
	}

	return ProcessedItem{
		ID:            id,
		URL:           cleanURL,
		Name:          cleanName,
		Description:   cleanDescription,
		Category:      category,
		Subcategory:   subcategory,
		Tags:          tags,
		SourceContext: sourceContext,
		RawText:       item.RawText,
		ExtractedAt:   now,
		Metadata:      metadata,
	}
}

// generateID generates a unique ID for an item based on its content
func (dv *DefaultValidator) generateID(item RawItem) string {
	data := fmt.Sprintf("%s|%s|%s", item.URL, item.Name, item.Description)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%x", hash)[:16]
}

// cleanURL normalizes and cleans a URL
func (dv *DefaultValidator) cleanURL(rawURL string) string {
	// Trim whitespace
	cleanURL := strings.TrimSpace(rawURL)

	// Parse and reconstruct URL to normalize it
	if parsedURL, err := url.Parse(cleanURL); err == nil {
		// Remove fragment (anchor) for consistency
		parsedURL.Fragment = ""

		// Remove trailing slash from path for consistency
		if parsedURL.Path != "/" {
			parsedURL.Path = strings.TrimSuffix(parsedURL.Path, "/")
		}

		cleanURL = parsedURL.String()
	}

	return cleanURL
}

// cleanName cleans and normalizes the item name
func (dv *DefaultValidator) cleanName(rawName string) string {
	name := strings.TrimSpace(rawName)

	// Remove common markdown artifacts
	name = strings.Trim(name, "*_`")

	// Remove excessive whitespace
	name = regexp.MustCompile(`\s+`).ReplaceAllString(name, " ")

	// Remove control characters
	name = regexp.MustCompile(`[\x00-\x1f\x7f]`).ReplaceAllString(name, "")

	// Truncate if too long but preserve whole words
	if len(name) > 200 {
		words := strings.Fields(name)
		var truncated []string
		length := 0

		for _, word := range words {
			if length+len(word)+1 > 200 {
				break
			}
			truncated = append(truncated, word)
			length += len(word) + 1
		}

		name = strings.Join(truncated, " ")
		if len(name) < len(rawName) {
			name += "..."
		}
	}

	return strings.TrimSpace(name)
}

// cleanDescription cleans and normalizes the description
func (dv *DefaultValidator) cleanDescription(rawDescription string) string {
	if rawDescription == "" {
		return ""
	}

	description := strings.TrimSpace(rawDescription)

	// Remove markdown formatting
	description = dv.removeMarkdownFormatting(description)

	// Remove excessive whitespace and newlines
	description = regexp.MustCompile(`\s+`).ReplaceAllString(description, " ")

	// Remove control characters
	description = regexp.MustCompile(`[\x00-\x1f\x7f]`).ReplaceAllString(description, "")

	// Truncate to configured max length
	maxLen := dv.config.MaxDescriptionLength
	if len(description) > maxLen {
		words := strings.Fields(description)
		var truncated []string
		length := 0

		for _, word := range words {
			if length+len(word)+1 > maxLen {
				break
			}
			truncated = append(truncated, word)
			length += len(word) + 1
		}

		description = strings.Join(truncated, " ")
		if len(description) < len(rawDescription) {
			description += "..."
		}
	}

	return strings.TrimSpace(description)
}

// removeMarkdownFormatting removes common markdown formatting from text
func (dv *DefaultValidator) removeMarkdownFormatting(text string) string {
	// Remove headers
	text = regexp.MustCompile(`^#+\s*`).ReplaceAllString(text, "")

	// Remove emphasis
	text = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(text, "$1")
	text = regexp.MustCompile(`\*([^*]+)\*`).ReplaceAllString(text, "$1")
	text = regexp.MustCompile(`__([^_]+)__`).ReplaceAllString(text, "$1")
	text = regexp.MustCompile(`_([^_]+)_`).ReplaceAllString(text, "$1")

	// Remove code formatting
	text = regexp.MustCompile("`([^`]+)`").ReplaceAllString(text, "$1")

	// Remove links but keep text
	text = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`).ReplaceAllString(text, "$1")

	// Remove list markers
	text = regexp.MustCompile(`^[-*+]\s*`).ReplaceAllString(text, "")

	return text
}

// extractCategory determines the category for an item
func (dv *DefaultValidator) extractCategory(item RawItem) string {
	// Try to get category from metadata first
	if category, ok := item.Metadata["category"].(string); ok && category != "" {
		return dv.normalizeCategory(category)
	}

	// Try to get from heading context
	if len(item.HeadingContext) > 0 {
		// Use the last (most specific) heading
		return dv.normalizeCategory(item.HeadingContext[len(item.HeadingContext)-1])
	}

	// Try to infer from URL or name if auto-categorization is enabled
	if dv.config.EnableAutoCategorization {
		if category := dv.inferCategoryFromContent(item); category != "" {
			return category
		}
	}

	return "Uncategorized"
}

// extractSubcategory determines the subcategory for an item
func (dv *DefaultValidator) extractSubcategory(item RawItem) string {
	// If we have multiple levels in the heading hierarchy, use the second-to-last as subcategory
	if len(item.HeadingContext) >= 2 {
		return dv.normalizeCategory(item.HeadingContext[len(item.HeadingContext)-2])
	}

	return ""
}

// extractTags extracts tags from the item context and content
func (dv *DefaultValidator) extractTags(item RawItem) []string {
	var tags []string

	// Extract from URL domain
	if parsedURL, err := url.Parse(item.URL); err == nil {
		domain := strings.ToLower(parsedURL.Hostname())
		domain = strings.TrimPrefix(domain, "www.")
		if domain != "" {
			tags = append(tags, domain)
		}
	}

	// Extract from file path
	if filePath, ok := item.Metadata["file_path"].(string); ok {
		if strings.Contains(filePath, "README") {
			tags = append(tags, "readme")
		}
		if strings.Contains(filePath, "awesome") {
			tags = append(tags, "awesome-list")
		}
	}

	// Extract common keywords from name and description
	content := strings.ToLower(item.Name + " " + item.Description)
	commonTags := []string{
		"free", "open-source", "tool", "library", "framework", "api", "service",
		"tutorial", "guide", "documentation", "blog", "article", "video",
		"github", "python", "javascript", "go", "rust", "java",
	}

	for _, tag := range commonTags {
		if strings.Contains(content, tag) {
			tags = append(tags, tag)
		}
	}

	// Remove duplicates and limit to reasonable number
	tags = dv.deduplicateAndLimitTags(tags, 10)

	return tags
}

// inferCategoryFromContent attempts to infer category from URL and content
func (dv *DefaultValidator) inferCategoryFromContent(item RawItem) string {
	content := strings.ToLower(item.Name + " " + item.Description + " " + item.URL)

	// Define category keywords
	categories := map[string][]string{
		"Development": {"api", "library", "framework", "tool", "github", "code", "programming", "developer"},
		"Media":       {"video", "movie", "music", "streaming", "download", "torrent"},
		"Education":   {"tutorial", "course", "learn", "education", "training", "guide"},
		"News":        {"news", "blog", "article", "journalism", "magazine"},
		"Security":    {"security", "privacy", "vpn", "encryption", "hack", "cybersecurity"},
		"Gaming":      {"game", "gaming", "steam", "playstation", "xbox", "nintendo"},
		"Social":      {"social", "forum", "community", "discord", "reddit", "twitter"},
	}

	for category, keywords := range categories {
		for _, keyword := range keywords {
			if strings.Contains(content, keyword) {
				return category
			}
		}
	}

	return ""
}

// normalizeCategory normalizes category names
func (dv *DefaultValidator) normalizeCategory(category string) string {
	category = strings.TrimSpace(category)

	// Remove common prefixes/suffixes
	category = strings.TrimSuffix(category, "s") // Remove plural

	// Capitalize first letter
	if len(category) > 0 {
		category = strings.ToUpper(category[:1]) + strings.ToLower(category[1:])
	}

	// Handle empty categories
	if category == "" {
		return "Uncategorized"
	}

	return category
}

// cleanSourceContext cleans the source context string
func (dv *DefaultValidator) cleanSourceContext(context string) string {
	if context == "" {
		return ""
	}

	context = strings.TrimSpace(context)
	context = dv.removeMarkdownFormatting(context)

	// Limit length
	if len(context) > 300 {
		context = context[:297] + "..."
	}

	return context
}

// calculateConfidence calculates a confidence score for the extraction
func (dv *DefaultValidator) calculateConfidence(item RawItem) float64 {
	confidence := 0.5 // Base confidence

	// Higher confidence if we have a good name
	if item.Name != "" && len(item.Name) > 3 && item.Name != item.URL {
		confidence += 0.2
	}

	// Higher confidence if we have description
	if item.Description != "" && len(item.Description) > 10 {
		confidence += 0.15
	}

	// Higher confidence if we have heading context
	if len(item.HeadingContext) > 0 {
		confidence += 0.1
	}

	// Higher confidence if URL looks valid
	if parsedURL, err := url.Parse(item.URL); err == nil {
		if parsedURL.Host != "" && !strings.Contains(parsedURL.Host, "localhost") {
			confidence += 0.05
		}
	}

	// Cap at 1.0
	if confidence > 1.0 {
		confidence = 1.0
	}

	return confidence
}

// deduplicateAndLimitTags removes duplicates and limits the number of tags
func (dv *DefaultValidator) deduplicateAndLimitTags(tags []string, maxTags int) []string {
	seen := make(map[string]bool)
	var unique []string

	for _, tag := range tags {
		tag = strings.TrimSpace(strings.ToLower(tag))
		if tag != "" && !seen[tag] && len(tag) > 1 {
			seen[tag] = true
			unique = append(unique, tag)

			if len(unique) >= maxTags {
				break
			}
		}
	}

	return unique
}

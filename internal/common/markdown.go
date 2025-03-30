package common

import (
	"strings"
)

// ExtractURL finds the first URL in a line
func ExtractURL(line string) string {
	for _, prefix := range []string{"http://", "https://", "www."} {
		if idx := strings.Index(line, prefix); idx != -1 {
			// Find the end of the URL
			end := len(line)
			for i := idx; i < len(line); i++ {
				if line[i] == ' ' || line[i] == '\n' || line[i] == '\r' || line[i] == ')' || line[i] == ']' {
					end = i
					break
				}
			}
			url := line[idx:end]
			// Basic URL validation
			if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "www.") {
				return ""
			}
			return url
		}
	}
	return ""
}

// ExtractDomain gets the domain from a URL
func ExtractDomain(url string) string {
	// Remove protocol
	if idx := strings.Index(url, "://"); idx != -1 {
		url = url[idx+3:]
	}
	// Remove path and query
	if idx := strings.Index(url, "/"); idx != -1 {
		url = url[:idx]
	}
	// Remove www. prefix
	url = strings.TrimPrefix(url, "www.")
	return url
}

// ExtractMarkdownLink extracts the text and URL from a markdown link [text](url)
func ExtractMarkdownLink(text string) (linkText string, url string) {
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		if runes[i] == '[' {
			linkStart := i + 1
			// Find closing bracket, handling nested brackets and escaped characters
			linkEnd := -1
			bracketCount := 1
			for j := linkStart; j < len(runes); j++ {
				if runes[j] == '\\' && j+1 < len(runes) {
					// Skip escaped characters
					j++
					continue
				}
				if runes[j] == '[' {
					bracketCount++
				} else if runes[j] == ']' {
					bracketCount--
					if bracketCount == 0 {
						linkEnd = j
						break
					}
				}
			}
			if linkEnd != -1 {
				// Process the link text, handling escaped characters
				linkText = ""
				for j := linkStart; j < linkEnd; j++ {
					if runes[j] == '\\' && j+1 < linkEnd {
						// Add the escaped character
						linkText += string(runes[j+1])
						j++
						continue
					}
					linkText += string(runes[j])
				}

				// Look for URL
				urlStart := -1
				for j := linkEnd; j < len(runes); j++ {
					if runes[j] == '(' {
						urlStart = j + 1
						break
					}
				}
				if urlStart != -1 {
					urlEnd := -1
					parenCount := 1
					for j := urlStart; j < len(runes); j++ {
						if runes[j] == '(' {
							parenCount++
						} else if runes[j] == ')' {
							parenCount--
							if parenCount == 0 {
								urlEnd = j
								break
							}
						}
					}
					if urlEnd != -1 {
						url = string(runes[urlStart:urlEnd])
						return linkText, url
					}
				}
			}
		}
	}
	return "", ""
}

// RemoveURLs removes any standalone URLs from text
func RemoveURLs(text string) string {
	words := strings.Fields(text)
	var result []string

	for _, word := range words {
		if !strings.Contains(word, "http://") &&
			!strings.Contains(word, "https://") &&
			!strings.Contains(word, "www.") {
			result = append(result, word)
		}
	}

	return strings.Join(result, " ")
}

// CleanCategory processes a category string according to the following rules:
// 1. If it contains non-markdown URLs, returns "n/a"
// 2. If it's a single markdown link, uses the link text
// 3. If it has multiple markdown links, uses the first link's text
// 4. Strips leading special characters, preserves common punctuation and international characters
// 5. Normalizes whitespace
// 6. Returns "n/a" if empty after processing
func CleanCategory(category string) string {
	// Case 1: Check for non-markdown URLs
	// First, remove all markdown links to check for any remaining URLs
	noMarkdown := category
	for {
		// Find the start of a markdown link
		startIdx := strings.Index(noMarkdown, "[")
		if startIdx == -1 {
			break
		}
		// Find the end of the URL part
		endIdx := strings.Index(noMarkdown[startIdx:], ")")
		if endIdx == -1 {
			break
		}
		endIdx += startIdx + 1 // Include the closing parenthesis
		// Remove this markdown link
		noMarkdown = noMarkdown[:startIdx] + noMarkdown[endIdx:]
	}

	// Now check if there are any URLs in the text without markdown links
	if ExtractURL(noMarkdown) != "" {
		return "n/a"
	}

	// Case 2 & 3: Handle markdown links
	linkText, _ := ExtractMarkdownLink(category)
	if linkText != "" {
		// If there's no other content after the link, use the link text
		remainingText := strings.TrimSpace(strings.Split(category, "](http")[0])
		if remainingText == "["+linkText {
			return linkText
		}
		// Otherwise, we have multiple links or mixed content, use first link text
		return linkText
	}

	// Case 4: Handle special characters
	// First, remove any leading special characters
	runes := []rune(category)
	startIdx := 0
	for i, r := range runes {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			startIdx = i
			break
		}
	}
	category = string(runes[startIdx:])

	// Case 5: Normalize whitespace
	category = strings.Join(strings.Fields(category), " ")

	// Case 6: Handle empty result
	if strings.TrimSpace(category) == "" {
		return "n/a"
	}

	return category
}

// CleanDescription removes unwanted formatting from link descriptions by:
// 1. Trimming leading and trailing whitespace
// 2. Removing leading dashes and hyphens
// 3. Removing trailing punctuation
// 4. Normalizing internal whitespace to single spaces
func CleanDescription(description string) string {
	// First trim any whitespace
	description = strings.TrimSpace(description)

	// Remove leading dashes, hyphens, and spaces
	description = strings.TrimLeft(description, "- ")

	// Remove trailing punctuation and spaces
	description = strings.TrimRight(description, ".,:;/ ")

	// Clean up any double spaces by splitting on whitespace and joining with single spaces
	return strings.Join(strings.Fields(description), " ")
}

// CleanMarkdown removes markdown formatting from a line
func CleanMarkdown(line string) string {
	// Remove bold/italic
	line = strings.ReplaceAll(line, "**", "")
	line = strings.ReplaceAll(line, "*", "")
	line = strings.ReplaceAll(line, "__", "")
	line = strings.ReplaceAll(line, "_", "")

	// Remove code blocks
	line = strings.ReplaceAll(line, "`", "")

	// Remove links but keep the URL
	line = strings.ReplaceAll(line, "](http", " http")
	line = strings.ReplaceAll(line, "](https", " https")
	line = strings.ReplaceAll(line, "](www", " www")
	line = strings.ReplaceAll(line, "[", "")
	line = strings.ReplaceAll(line, ")", "")

	// Clean up any double spaces
	line = strings.Join(strings.Fields(line), " ")

	return line
}

// IsInvalidCategory checks if a category is invalid based on its characteristics
func IsInvalidCategory(category string) bool {
	// Categories longer than 80 characters are considered invalid
	return len(category) > 80
}

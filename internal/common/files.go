package common

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/log"
)

// GetRepoPath returns the path to a repository
func GetRepoPath(cacheDir, repoName string) string {
	// Expand the ~ to the user's home directory
	if cacheDir[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatal("Failed to get home directory", "error", err)
		}
		cacheDir = filepath.Join(home, cacheDir[2:])
	}

	repoPath := filepath.Join(cacheDir, repoName)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		log.Fatal("Repository not found. Please run 'freectl update' first")
	}

	return repoPath
}

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

// CleanCategory removes unusual Unicode characters and unwanted formatting from category names
func CleanCategory(category string) string {
	// First trim any whitespace
	category = strings.TrimSpace(category)

	// Remove leading dashes, hyphens, and spaces
	category = strings.TrimLeft(category, "- ")

	// Remove trailing punctuation and spaces
	category = strings.TrimRight(category, "/.,;:- ")

	// Handle any remaining slashes with spaces around them
	category = strings.ReplaceAll(category, " / ", " ")
	category = strings.ReplaceAll(category, "/ ", " ")
	category = strings.ReplaceAll(category, " /", " ")

	var result strings.Builder
	for _, char := range category {
		// Keep ASCII characters (including spaces and basic punctuation)
		if char < 128 {
			result.WriteRune(char)
		}
	}

	// Clean up any double spaces and trim again
	cleaned := strings.Join(strings.Fields(result.String()), " ")

	// One final trim to catch any edge cases
	return strings.TrimRight(cleaned, "/.,;:- ")
}

// CleanDescription removes unwanted formatting from link descriptions
func CleanDescription(description string) string {
	// First trim any whitespace
	description = strings.TrimSpace(description)

	// Remove leading dashes, hyphens, and spaces
	description = strings.TrimLeft(description, "- ")

	// Remove trailing punctuation and spaces
	description = strings.TrimRight(description, ".,:;/ ")

	// Clean up any double spaces
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

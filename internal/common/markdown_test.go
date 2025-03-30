package common

import (
	"testing"
)

func TestCleanDescription(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "preserves URLs",
			input:    "Check out https://example.com and www.example.com",
			expected: "Check out https://example.com and www.example.com",
		},
		{
			name:     "preserves markdown links",
			input:    "Check out [this site](https://example.com)",
			expected: "Check out [this site](https://example.com)",
		},
		{
			name:     "handles mixed content",
			input:    "Visit [this site](https://example.com) and www.other.com",
			expected: "Visit [this site](https://example.com) and www.other.com",
		},
		{
			name:     "preserves multiple markdown links",
			input:    "See [site1](https://site1.com) and [site2](https://site2.com)",
			expected: "See [site1](https://site1.com) and [site2](https://site2.com)",
		},
		{
			name:     "normalizes whitespace",
			input:    "  multiple   spaces  and\ttabs",
			expected: "multiple spaces and tabs",
		},
		{
			name:     "handles empty input",
			input:    "",
			expected: "",
		},
		{
			name:     "handles leading dashes and hyphens",
			input:    "- -- --- description",
			expected: "description",
		},
		{
			name:     "handles trailing punctuation",
			input:    "description.,:;/",
			expected: "description",
		},
		{
			name:     "handles mixed punctuation",
			input:    "- description.,:;/",
			expected: "description",
		},
		{
			name:     "preserves internal punctuation",
			input:    "description with, some. punctuation",
			expected: "description with, some. punctuation",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CleanDescription(tt.input)
			if result != tt.expected {
				t.Errorf("cleanDescription(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestCleanCategory(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "skip if it's got non-markdown links",
			input:    "Check out https://example.com and www.example.com",
			expected: "n/a",
		},
		{
			name:     "extracts link text from single markdown link",
			input:    "[Cool category](https://example.com)",
			expected: "Cool category",
		},
		{
			name:     "skip if it's mixed content and has non-markdown links",
			input:    "Visit [this site](https://example.com) and www.other.com",
			expected: "n/a",
		},
		{
			name:     "preserves special characters",
			input:    "Tools & Resources + More",
			expected: "Tools & Resources + More",
		},
		{
			name:     "handle multiple markdown links but only return first one",
			input:    "[First Link](https://1.com) and [Second Link](https://2.com)",
			expected: "First Link",
		},
		{
			name:     "handles markdown links with special characters",
			input:    "[Tools & Resources](https://example.com)",
			expected: "Tools & Resources",
		},
		{
			name:     "normalizes whitespace",
			input:    "  multiple   spaces  and\ttabs",
			expected: "multiple spaces and tabs",
		},
		{
			name:     "handles empty input",
			input:    "",
			expected: "n/a",
		},
		{
			name:     "handle special characters",
			input:    "▷ Reading / Чтение",
			expected: "Reading / Чтение",
		},
		{
			name:     "handles URL in markdown link with special characters",
			input:    "[Tools & Resources](https://example.com/path?q=1)",
			expected: "Tools & Resources",
		},
		{
			name:     "handles multiple non-markdown URLs",
			input:    "https://1.com and https://2.com",
			expected: "n/a",
		},
		{
			name:     "handles markdown link with spaces in URL",
			input:    "[Link](https://example.com/path with spaces)",
			expected: "Link",
		},
		{
			name:     "handles markdown link with nested brackets",
			input:    "[[Link]](https://example.com)",
			expected: "[Link]",
		},
		{
			name:     "handles markdown link with nested parentheses",
			input:    "[Link](https://example.com/(path))",
			expected: "Link",
		},
		{
			name:     "handles markdown link with escaped characters",
			input:    "[Link \\[with\\] brackets](https://example.com)",
			expected: "Link [with] brackets",
		},
		{
			name:     "handles markdown link with URL-like text",
			input:    "[https://example.com](https://example.com)",
			expected: "https://example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CleanCategory(tt.input)
			if result != tt.expected {
				t.Errorf("cleanCategory(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

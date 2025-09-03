package extractors

import (
	"time"
)

// ProcessingConfig contains configuration for the preprocessing pipeline
type ProcessingConfig struct {
	AutoProcess              bool     `json:"auto_process"`
	ProcessOnUpdate          bool     `json:"process_on_update"`
	ExtractionStrategies     []string `json:"extraction_strategies"`
	UseSearchIndex           bool     `json:"use_search_index"`
	MaxDescriptionLength     int      `json:"max_description_length"`
	EnableAutoCategorization bool     `json:"enable_auto_categorization"`
	ParallelProcessing       bool     `json:"parallel_processing"`
	MaxConcurrentSources     int      `json:"max_concurrent_sources"`
	ValidateURLs             bool     `json:"validate_urls"`
	DeduplicateItems         bool     `json:"deduplicate_items"`
}

// SourceMetadata contains metadata about the source
type SourceMetadata struct {
	Name        string    `json:"name"`
	URL         string    `json:"url"`
	Type        string    `json:"type"`
	LastUpdated time.Time `json:"last_updated"`
	Version     string    `json:"version"`
	ProcessedAt time.Time `json:"processed_at"`
	ItemCount   int       `json:"item_count"`
	Errors      []string  `json:"errors,omitempty"`
}

// RawItem represents an item before processing
type RawItem struct {
	URL            string                 `json:"url"`
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	Context        string                 `json:"context,omitempty"`
	RawText        string                 `json:"raw_text,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	HeadingContext []string               `json:"heading_context,omitempty"`
}

// ExtractionResult represents the result of extracting items from a source
type ExtractionResult struct {
	Items  []RawItem       `json:"items"`
	Errors []string        `json:"errors,omitempty"`
	Stats  ExtractionStats `json:"stats"`
}

// ExtractionStats provides statistics about the extraction process
type ExtractionStats struct {
	TotalItems     int           `json:"total_items"`
	ValidItems     int           `json:"valid_items"`
	InvalidItems   int           `json:"invalid_items"`
	DuplicateItems int           `json:"duplicate_items"`
	ProcessingTime time.Duration `json:"processing_time"`
	ExtractorUsed  string        `json:"extractor_used"`
}

// Extractor is the interface that all source extractors must implement
type Extractor interface {
	// Extract processes raw content and returns extracted items
	Extract(content []byte, source SourceMetadata) (*ExtractionResult, error)

	// CanHandle returns true if this extractor can handle the given content
	CanHandle(content []byte, sourceType string) bool

	// Priority returns the priority of this extractor (higher = more preferred)
	Priority() int

	// Name returns the name of this extractor
	Name() string
}

// Strategy represents a specific extraction strategy
type Strategy interface {
	// Extract items using this strategy
	Extract(content []byte, context ExtractionContext) ([]RawItem, error)

	// CanHandle returns true if this strategy can handle the content
	CanHandle(content []byte) bool

	// Priority returns the priority of this strategy
	Priority() int

	// Name returns the name of this strategy
	Name() string
}

// ExtractionContext provides context for extraction strategies
type ExtractionContext struct {
	Source   SourceMetadata         `json:"source"`
	FilePath string                 `json:"file_path,omitempty"`
	Config   ProcessingConfig       `json:"config"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

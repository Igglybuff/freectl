package preprocessing

import (
	"freectl/internal/preprocessing/extractors"
	"time"
)

// ProcessedSource represents a fully processed data source
type ProcessedSource struct {
	Source SourceMetadata  `json:"source"`
	Items  []ProcessedItem `json:"items"`
}

// SourceMetadata contains metadata about the source
type SourceMetadata = extractors.SourceMetadata

// ProcessedItem represents a single extracted link/item
type ProcessedItem struct {
	ID            string       `json:"id"`
	URL           string       `json:"url"`
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	Category      string       `json:"category"`
	Subcategory   string       `json:"subcategory,omitempty"`
	Tags          []string     `json:"tags,omitempty"`
	SourceContext string       `json:"source_context,omitempty"`
	RawText       string       `json:"raw_text,omitempty"`
	ExtractedAt   time.Time    `json:"extracted_at"`
	Metadata      ItemMetadata `json:"metadata"`
}

// ItemMetadata contains additional metadata about how the item was extracted
type ItemMetadata struct {
	FilePath         string   `json:"file_path,omitempty"`
	LineNumber       int      `json:"line_number,omitempty"`
	HeadingHierarchy []string `json:"heading_hierarchy,omitempty"`
	ExtractorUsed    string   `json:"extractor_used"`
	Confidence       float64  `json:"confidence,omitempty"`
	SourceSection    string   `json:"source_section,omitempty"`
}

// RawItem represents an item before processing
type RawItem = extractors.RawItem

// ExtractionResult represents the result of extracting items from a source
type ExtractionResult = extractors.ExtractionResult

// ExtractionStats provides statistics about the extraction process
type ExtractionStats = extractors.ExtractionStats

// ProcessingStatus represents the status of preprocessing operations
type ProcessingStatus struct {
	SourceName     string     `json:"source_name"`
	Status         string     `json:"status"` // "pending", "processing", "completed", "error"
	StartedAt      time.Time  `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	Error          string     `json:"error,omitempty"`
	ItemsProcessed int        `json:"items_processed"`
	ItemsTotal     int        `json:"items_total"`
}

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

// DefaultProcessingConfig returns a default processing configuration
func DefaultProcessingConfig() ProcessingConfig {
	return ProcessingConfig{
		AutoProcess:              true,
		ProcessOnUpdate:          true,
		ExtractionStrategies:     []string{"structured", "regex", "simple"},
		UseSearchIndex:           false,
		MaxDescriptionLength:     500,
		EnableAutoCategorization: true,
		ParallelProcessing:       true,
		MaxConcurrentSources:     4,
		ValidateURLs:             false,
		DeduplicateItems:         true,
	}
}

// Extractor is the interface that all source extractors must implement
type Extractor = extractors.Extractor

// Strategy represents a specific extraction strategy
type Strategy = extractors.Strategy

// ExtractionContext provides context for extraction strategies
type ExtractionContext = extractors.ExtractionContext

// ItemValidator validates and cleans extracted items
type ItemValidator interface {
	// Validate checks if an item is valid
	Validate(item RawItem) error

	// Clean cleans and normalizes an item
	Clean(item RawItem) ProcessedItem
}

// ProcessedStorage handles storage of processed data
type ProcessedStorage interface {
	// Save saves processed source data
	Save(source ProcessedSource) error

	// Load loads processed source data
	Load(sourceName string) (*ProcessedSource, error)

	// List lists all processed sources
	List() ([]string, error)

	// Delete removes processed source data
	Delete(sourceName string) error

	// Exists checks if processed data exists for a source
	Exists(sourceName string) bool
}

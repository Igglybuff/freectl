package preprocessing

import (
	"crypto/md5"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"freectl/internal/preprocessing/extractors"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
)

// ProcessingEngine manages the preprocessing of data sources
type ProcessingEngine struct {
	config     ProcessingConfig
	extractors map[string]Extractor
	validator  ItemValidator
	storage    ProcessedStorage
	cacheDir   string
	mu         sync.RWMutex
}

// NewProcessingEngine creates a new processing engine
func NewProcessingEngine(cacheDir string, config ProcessingConfig) *ProcessingEngine {
	engine := &ProcessingEngine{
		config:     config,
		extractors: make(map[string]Extractor),
		cacheDir:   cacheDir,
	}

	// Initialize default components
	engine.validator = NewDefaultValidator(config)
	engine.storage = NewFileStorage(filepath.Join(cacheDir, "processed"))

	// Convert config to extractors.ProcessingConfig
	extractorConfig := extractors.ProcessingConfig{
		AutoProcess:              config.AutoProcess,
		ProcessOnUpdate:          config.ProcessOnUpdate,
		ExtractionStrategies:     config.ExtractionStrategies,
		UseSearchIndex:           config.UseSearchIndex,
		MaxDescriptionLength:     config.MaxDescriptionLength,
		EnableAutoCategorization: config.EnableAutoCategorization,
		ParallelProcessing:       config.ParallelProcessing,
		MaxConcurrentSources:     config.MaxConcurrentSources,
		ValidateURLs:             config.ValidateURLs,
		DeduplicateItems:         config.DeduplicateItems,
	}

	// Register default extractors
	engine.RegisterExtractor("git", extractors.NewMarkdownExtractor(extractorConfig))
	engine.RegisterExtractor("markdown", extractors.NewMarkdownExtractor(extractorConfig))
	engine.RegisterExtractor("rss", &stubExtractor{name: "rss", sourceType: "rss"})
	engine.RegisterExtractor("opml", &stubExtractor{name: "opml", sourceType: "opml"})
	engine.RegisterExtractor("bookmarks", &stubExtractor{name: "bookmarks", sourceType: "bookmarks"})

	return engine
}

// RegisterExtractor registers a new extractor for a source type
func (pe *ProcessingEngine) RegisterExtractor(sourceType string, extractor Extractor) {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	pe.extractors[sourceType] = extractor
}

// ProcessSource processes a single source into the unified JSON format
func (pe *ProcessingEngine) ProcessSource(source sources.Source) error {
	log.Info("Processing source", "name", source.Name, "type", source.Type)

	startTime := time.Now()

	// Get the appropriate extractor
	extractor, err := pe.getExtractor(string(source.Type))
	if err != nil {
		return fmt.Errorf("no extractor found for source type %s: %w", source.Type, err)
	}

	// Read raw content from the source
	content, err := pe.readSourceContent(source)
	if err != nil {
		return fmt.Errorf("failed to read source content: %w", err)
	}

	// Create source metadata
	metadata := SourceMetadata{
		Name:        source.Name,
		URL:         source.URL,
		Type:        string(source.Type),
		LastUpdated: time.Now(), // TODO: Get actual last updated time from source
		Version:     "1.0",
		ProcessedAt: time.Now(),
	}

	// Extract items using the appropriate extractor
	result, err := extractor.Extract(content, metadata)
	if err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}

	// Process and validate extracted items
	var processedItems []ProcessedItem
	var errors []string

	for _, rawItem := range result.Items {
		if err := pe.validator.Validate(rawItem); err != nil {
			errors = append(errors, fmt.Sprintf("validation failed for item %s: %v", rawItem.URL, err))
			continue
		}

		processedItem := pe.validator.Clean(rawItem)
		processedItems = append(processedItems, processedItem)
	}

	// Deduplicate if enabled
	if pe.config.DeduplicateItems {
		processedItems = pe.deduplicateItems(processedItems)
	}

	// Update metadata
	metadata.ItemCount = len(processedItems)
	metadata.Errors = append(result.Errors, errors...)

	// Create processed source
	processedSource := ProcessedSource{
		Source: metadata,
		Items:  processedItems,
	}

	// Save processed data
	if err := pe.storage.Save(processedSource); err != nil {
		return fmt.Errorf("failed to save processed data: %w", err)
	}

	processingTime := time.Since(startTime)
	log.Info("Source processing completed",
		"name", source.Name,
		"items", len(processedItems),
		"errors", len(errors),
		"duration", processingTime,
	)

	return nil
}

// ProcessAllSources processes all enabled sources
func (pe *ProcessingEngine) ProcessAllSources(sourceList []sources.Source) error {
	if !pe.config.ParallelProcessing {
		return pe.processSequentially(sourceList)
	}
	return pe.processInParallel(sourceList)
}

// processSequentially processes sources one by one
func (pe *ProcessingEngine) processSequentially(sourceList []sources.Source) error {
	for _, source := range sourceList {
		if !source.Enabled {
			continue
		}

		if err := pe.ProcessSource(source); err != nil {
			log.Error("Failed to process source", "name", source.Name, "error", err)
			continue
		}
	}
	return nil
}

// processInParallel processes sources concurrently
func (pe *ProcessingEngine) processInParallel(sourceList []sources.Source) error {
	// Filter enabled sources
	var enabledSources []sources.Source
	for _, source := range sourceList {
		if source.Enabled {
			enabledSources = append(enabledSources, source)
		}
	}

	if len(enabledSources) == 0 {
		return nil
	}

	// Create semaphore to limit concurrency
	maxConcurrent := pe.config.MaxConcurrentSources
	if maxConcurrent <= 0 {
		maxConcurrent = 4
	}

	semaphore := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup
	errorChan := make(chan error, len(enabledSources))

	for _, source := range enabledSources {
		wg.Add(1)
		go func(src sources.Source) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			if err := pe.ProcessSource(src); err != nil {
				errorChan <- fmt.Errorf("failed to process source %s: %w", src.Name, err)
			}
		}(source)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errorChan)

	// Collect errors
	var errors []string
	for err := range errorChan {
		errors = append(errors, err.Error())
		log.Error("Processing error", "error", err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("processing completed with %d errors: %s", len(errors), strings.Join(errors[:1], "; "))
	}

	return nil
}

// getExtractor returns the appropriate extractor for a source type
func (pe *ProcessingEngine) getExtractor(sourceType string) (Extractor, error) {
	pe.mu.RLock()
	defer pe.mu.RUnlock()

	extractor, exists := pe.extractors[sourceType]
	if !exists {
		return nil, fmt.Errorf("no extractor registered for source type: %s", sourceType)
	}

	return extractor, nil
}

// readSourceContent reads the raw content from a source directory
func (pe *ProcessingEngine) readSourceContent(source sources.Source) ([]byte, error) {
	sourcePath := source.Path

	// Check if source directory exists
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("source directory does not exist: %s", sourcePath)
	}

	// For different source types, we need different reading strategies
	switch source.Type {
	case sources.SourceTypeGit:
		return pe.readGitSource(sourcePath)
	case sources.SourceTypeRSS:
		return pe.readRSSSource(sourcePath)
	case sources.SourceTypeRedditWiki:
		return pe.readRedditWikiSource(sourcePath)
	default:
		// Default: try to read all markdown files
		return pe.readMarkdownFiles(sourcePath)
	}
}

// readGitSource reads content from a git repository source
func (pe *ProcessingEngine) readGitSource(sourcePath string) ([]byte, error) {
	var allContent []byte

	err := filepath.WalkDir(sourcePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() || !strings.HasSuffix(path, ".md") {
			return nil
		}

		// Skip non-content files (same logic as current search)
		if !isContentFile(path) {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			log.Error("Failed to read file", "path", path, "error", err)
			return nil // Continue processing other files
		}

		// Add file separator and path info
		separator := fmt.Sprintf("\n\n<!-- FILE: %s -->\n\n", path)
		allContent = append(allContent, []byte(separator)...)
		allContent = append(allContent, content...)
		allContent = append(allContent, []byte("\n\n")...)

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk source directory: %w", err)
	}

	return allContent, nil
}

// readRSSSource reads content from an RSS source
func (pe *ProcessingEngine) readRSSSource(sourcePath string) ([]byte, error) {
	feedFile := filepath.Join(sourcePath, "feed.md")
	return os.ReadFile(feedFile)
}

// readRedditWikiSource reads content from a Reddit wiki source
func (pe *ProcessingEngine) readRedditWikiSource(sourcePath string) ([]byte, error) {
	wikiFile := filepath.Join(sourcePath, "wiki.md")
	return os.ReadFile(wikiFile)
}

// readMarkdownFiles reads all markdown files from a directory
func (pe *ProcessingEngine) readMarkdownFiles(sourcePath string) ([]byte, error) {
	return pe.readGitSource(sourcePath) // Same logic for now
}

// deduplicateItems removes duplicate items based on URL
func (pe *ProcessingEngine) deduplicateItems(items []ProcessedItem) []ProcessedItem {
	seen := make(map[string]bool)
	var unique []ProcessedItem

	for _, item := range items {
		if !seen[item.URL] {
			seen[item.URL] = true
			unique = append(unique, item)
		}
	}

	return unique
}

// generateItemID generates a unique ID for an item
func generateItemID(item RawItem) string {
	data := fmt.Sprintf("%s|%s|%s", item.URL, item.Name, item.Description)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%x", hash)[:16]
}

// isContentFile determines if a file likely contains content links
// (copied from existing search logic)
func isContentFile(path string) bool {
	// Special handling for README.md files
	if strings.HasSuffix(path, "README.md") {
		return isLinkHeavyReadme(path)
	}

	// List of common non-content files to ignore
	ignoreFiles := []string{
		"CONTRIBUTING.md", "LICENSE.md", "CHANGELOG.md", "CODE_OF_CONDUCT.md",
		"SECURITY.md", "SUPPORT.md", "MAINTAINING.md", "DEPLOYMENT.md",
		"DEVELOPMENT.md", "CONTRIBUTORS.md", "AUTHORS.md", "ROADMAP.md",
		"VERSION.md", "RELEASE.md", "PULL_REQUEST_TEMPLATE.md",
		"ISSUE_TEMPLATE.md", "CODEOWNERS", ".github/",
		"docs/CONTRIBUTING.md", "docs/LICENSE.md",
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
		".github", ".git", "node_modules", "vendor", "dist", "build",
		"coverage", "test", "tests", "examples", "scripts", "tools", "ci",
	}

	for _, nonContentDir := range nonContentDirs {
		if strings.Contains(dir, nonContentDir) {
			return false
		}
	}

	return true
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

// GetProcessingStatus returns the current processing status for all sources
func (pe *ProcessingEngine) GetProcessingStatus() ([]ProcessingStatus, error) {
	processedSources, err := pe.storage.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list processed sources: %w", err)
	}

	var statuses []ProcessingStatus
	for _, sourceName := range processedSources {
		processed, err := pe.storage.Load(sourceName)
		if err != nil {
			continue
		}

		status := ProcessingStatus{
			SourceName:     sourceName,
			Status:         "completed",
			StartedAt:      processed.Source.ProcessedAt,
			CompletedAt:    &processed.Source.ProcessedAt,
			ItemsProcessed: processed.Source.ItemCount,
			ItemsTotal:     processed.Source.ItemCount,
		}

		if len(processed.Source.Errors) > 0 {
			status.Status = "completed_with_errors"
			status.Error = fmt.Sprintf("%d errors occurred", len(processed.Source.Errors))
		}

		statuses = append(statuses, status)
	}

	return statuses, nil
}

// NeedsProcessing checks if a source needs to be processed or reprocessed
func (pe *ProcessingEngine) NeedsProcessing(source sources.Source) bool {
	if !pe.storage.Exists(source.Name) {
		return true
	}

	processed, err := pe.storage.Load(source.Name)
	if err != nil {
		return true
	}

	// Check if source was updated after last processing
	sourceInfo, err := os.Stat(source.Path)
	if err != nil {
		return true
	}

	return sourceInfo.ModTime().After(processed.Source.ProcessedAt)
}

// stubExtractor is a placeholder extractor for unimplemented types
type stubExtractor struct {
	name       string
	sourceType string
}

func (se *stubExtractor) Extract(content []byte, source SourceMetadata) (*ExtractionResult, error) {
	// TODO: Implement actual extraction logic
	return &ExtractionResult{
		Items:  []RawItem{},
		Errors: []string{"extractor not yet implemented"},
		Stats: ExtractionStats{
			TotalItems:    0,
			ValidItems:    0,
			ExtractorUsed: se.name,
		},
	}, nil
}

func (se *stubExtractor) CanHandle(content []byte, sourceType string) bool {
	return sourceType == se.sourceType
}

func (se *stubExtractor) Priority() int {
	return 1
}

func (se *stubExtractor) Name() string {
	return se.name
}

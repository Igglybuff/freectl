package preprocessing

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/log"
)

// FileStorage implements ProcessedStorage using the local filesystem
type FileStorage struct {
	baseDir string
}

// NewFileStorage creates a new file storage instance
func NewFileStorage(baseDir string) ProcessedStorage {
	return &FileStorage{
		baseDir: baseDir,
	}
}

// Save saves processed source data to a JSON file
func (fs *FileStorage) Save(source ProcessedSource) error {
	// Ensure base directory exists
	if err := os.MkdirAll(fs.baseDir, 0755); err != nil {
		return fmt.Errorf("failed to create base directory: %w", err)
	}

	// Generate filename from source name
	filename := fs.getFilename(source.Source.Name)
	filePath := filepath.Join(fs.baseDir, filename)

	// Create backup of existing file if it exists
	if _, err := os.Stat(filePath); err == nil {
		backupPath := filePath + ".backup"
		if err := fs.copyFile(filePath, backupPath); err != nil {
			log.Warn("Failed to create backup", "file", filePath, "error", err)
		}
	}

	// Marshal to JSON with pretty formatting
	data, err := json.MarshalIndent(source, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal source data: %w", err)
	}

	// Write to temporary file first, then rename (atomic operation)
	tempPath := filePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temporary file: %w", err)
	}

	// Atomically replace the original file
	if err := os.Rename(tempPath, filePath); err != nil {
		// Clean up temp file on failure
		os.Remove(tempPath)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	log.Debug("Saved processed source", "name", source.Source.Name, "items", len(source.Items), "file", filePath)
	return nil
}

// Load loads processed source data from a JSON file
func (fs *FileStorage) Load(sourceName string) (*ProcessedSource, error) {
	filename := fs.getFilename(sourceName)
	filePath := filepath.Join(fs.baseDir, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("processed data not found for source: %s", sourceName)
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Unmarshal JSON
	var source ProcessedSource
	if err := json.Unmarshal(data, &source); err != nil {
		return nil, fmt.Errorf("failed to unmarshal source data: %w", err)
	}

	log.Debug("Loaded processed source", "name", sourceName, "items", len(source.Items))
	return &source, nil
}

// List lists all processed source names
func (fs *FileStorage) List() ([]string, error) {
	// Ensure base directory exists
	if err := os.MkdirAll(fs.baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	entries, err := os.ReadDir(fs.baseDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var sources []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()

		// Skip backup and temporary files
		if strings.HasSuffix(filename, ".backup") || strings.HasSuffix(filename, ".tmp") {
			continue
		}

		// Only include JSON files
		if !strings.HasSuffix(filename, ".json") {
			continue
		}

		// Extract source name from filename
		sourceName := fs.getSourceNameFromFilename(filename)
		if sourceName != "" {
			sources = append(sources, sourceName)
		}
	}

	return sources, nil
}

// Delete removes processed source data
func (fs *FileStorage) Delete(sourceName string) error {
	filename := fs.getFilename(sourceName)
	filePath := filepath.Join(fs.baseDir, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("processed data not found for source: %s", sourceName)
	}

	// Remove the file
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	// Also remove backup if it exists
	backupPath := filePath + ".backup"
	if _, err := os.Stat(backupPath); err == nil {
		os.Remove(backupPath) // Don't fail if backup removal fails
	}

	log.Debug("Deleted processed source", "name", sourceName)
	return nil
}

// Exists checks if processed data exists for a source
func (fs *FileStorage) Exists(sourceName string) bool {
	filename := fs.getFilename(sourceName)
	filePath := filepath.Join(fs.baseDir, filename)

	_, err := os.Stat(filePath)
	return err == nil
}

// GetStorageInfo returns information about the storage
func (fs *FileStorage) GetStorageInfo() (StorageInfo, error) {
	sources, err := fs.List()
	if err != nil {
		return StorageInfo{}, fmt.Errorf("failed to list sources: %w", err)
	}

	var totalItems int
	var totalSize int64
	var oldestUpdate, newestUpdate time.Time

	for _, sourceName := range sources {
		source, err := fs.Load(sourceName)
		if err != nil {
			continue
		}

		totalItems += len(source.Items)

		// Get file size
		filename := fs.getFilename(sourceName)
		filePath := filepath.Join(fs.baseDir, filename)
		if info, err := os.Stat(filePath); err == nil {
			totalSize += info.Size()
		}

		// Track update times
		processedAt := source.Source.ProcessedAt
		if oldestUpdate.IsZero() || processedAt.Before(oldestUpdate) {
			oldestUpdate = processedAt
		}
		if newestUpdate.IsZero() || processedAt.After(newestUpdate) {
			newestUpdate = processedAt
		}
	}

	return StorageInfo{
		TotalSources:  len(sources),
		TotalItems:    totalItems,
		TotalSize:     totalSize,
		OldestUpdate:  oldestUpdate,
		NewestUpdate:  newestUpdate,
		StorageType:   "file",
		BaseDirectory: fs.baseDir,
	}, nil
}

// getFilename generates a safe filename from a source name
func (fs *FileStorage) getFilename(sourceName string) string {
	// Sanitize the source name for use as filename
	filename := sourceName

	// Replace problematic characters
	filename = strings.ReplaceAll(filename, "/", "_")
	filename = strings.ReplaceAll(filename, "\\", "_")
	filename = strings.ReplaceAll(filename, ":", "_")
	filename = strings.ReplaceAll(filename, "*", "_")
	filename = strings.ReplaceAll(filename, "?", "_")
	filename = strings.ReplaceAll(filename, "\"", "_")
	filename = strings.ReplaceAll(filename, "<", "_")
	filename = strings.ReplaceAll(filename, ">", "_")
	filename = strings.ReplaceAll(filename, "|", "_")
	filename = strings.ReplaceAll(filename, " ", "_")

	// Remove any remaining non-alphanumeric characters except dots, dashes, and underscores
	var result strings.Builder
	for _, r := range filename {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			result.WriteRune(r)
		} else {
			result.WriteRune('_')
		}
	}

	filename = result.String()

	// Ensure filename isn't empty
	if filename == "" {
		filename = "unnamed_source"
	}

	// Add JSON extension
	return filename + ".json"
}

// getSourceNameFromFilename extracts the source name from a filename
func (fs *FileStorage) getSourceNameFromFilename(filename string) string {
	if !strings.HasSuffix(filename, ".json") {
		return ""
	}

	// Remove .json extension
	return strings.TrimSuffix(filename, ".json")
}

// copyFile copies a file from src to dst
func (fs *FileStorage) copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	return os.WriteFile(dst, data, 0644)
}

// StorageInfo provides information about the storage
type StorageInfo struct {
	TotalSources  int       `json:"total_sources"`
	TotalItems    int       `json:"total_items"`
	TotalSize     int64     `json:"total_size"`
	OldestUpdate  time.Time `json:"oldest_update"`
	NewestUpdate  time.Time `json:"newest_update"`
	StorageType   string    `json:"storage_type"`
	BaseDirectory string    `json:"base_directory"`
}

// CompactStorage removes backup files and optimizes storage
func (fs *FileStorage) CompactStorage() error {
	entries, err := os.ReadDir(fs.baseDir)
	if err != nil {
		return fmt.Errorf("failed to read directory: %w", err)
	}

	var removed int
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()

		// Remove backup files older than 7 days
		if strings.HasSuffix(filename, ".backup") {
			filePath := filepath.Join(fs.baseDir, filename)
			if info, err := os.Stat(filePath); err == nil {
				if time.Since(info.ModTime()) > 7*24*time.Hour {
					if err := os.Remove(filePath); err == nil {
						removed++
					}
				}
			}
		}

		// Remove temporary files
		if strings.HasSuffix(filename, ".tmp") {
			filePath := filepath.Join(fs.baseDir, filename)
			if err := os.Remove(filePath); err == nil {
				removed++
			}
		}
	}

	if removed > 0 {
		log.Info("Compacted storage", "files_removed", removed)
	}

	return nil
}

// LoadAll loads all processed sources
func (fs *FileStorage) LoadAll() (map[string]*ProcessedSource, error) {
	sources, err := fs.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list sources: %w", err)
	}

	result := make(map[string]*ProcessedSource)

	for _, sourceName := range sources {
		source, err := fs.Load(sourceName)
		if err != nil {
			log.Error("Failed to load source", "name", sourceName, "error", err)
			continue
		}

		result[sourceName] = source
	}

	return result, nil
}

// SaveMetadata saves metadata about the processing operation
func (fs *FileStorage) SaveMetadata(metadata map[string]interface{}) error {
	metaDir := filepath.Join(fs.baseDir, ".meta")
	if err := os.MkdirAll(metaDir, 0755); err != nil {
		return fmt.Errorf("failed to create metadata directory: %w", err)
	}

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	metaFile := filepath.Join(metaDir, "processing.json")
	return os.WriteFile(metaFile, data, 0644)
}

// LoadMetadata loads processing metadata
func (fs *FileStorage) LoadMetadata() (map[string]interface{}, error) {
	metaFile := filepath.Join(fs.baseDir, ".meta", "processing.json")

	if _, err := os.Stat(metaFile); os.IsNotExist(err) {
		return make(map[string]interface{}), nil
	}

	data, err := os.ReadFile(metaFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read metadata: %w", err)
	}

	var metadata map[string]interface{}
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return metadata, nil
}

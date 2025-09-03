package process

import (
	"fmt"
	"time"

	"freectl/internal/preprocessing"
	"freectl/internal/settings"
	"freectl/internal/sources"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var (
	sourceName string
	force      bool
	parallel   bool
)

// ProcessCmd represents the process command
var ProcessCmd = &cobra.Command{
	Use:   "process",
	Short: "Process sources into unified JSON format",
	Long: `Process data sources into a unified JSON format for faster searching.

This command preprocesses raw data sources (markdown files, RSS feeds, etc.)
into a structured JSON format that can be searched much more efficiently.

Examples:
  freectl process                    # Process all enabled sources
  freectl process --source awesome-piracy  # Process specific source
  freectl process --force            # Force reprocessing even if up-to-date
  freectl process --parallel=false   # Process sources sequentially`,
	RunE: runProcess,
}

func init() {
	ProcessCmd.Flags().StringVarP(&sourceName, "source", "s", "", "Process specific source by name")
	ProcessCmd.Flags().BoolVarP(&force, "force", "f", false, "Force reprocessing even if source is up-to-date")
	ProcessCmd.Flags().BoolVar(&parallel, "parallel", true, "Process sources in parallel")
}

func runProcess(cmd *cobra.Command, args []string) error {
	startTime := time.Now()

	// Load settings
	s, err := settings.Load()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}

	if len(s.Sources) == 0 {
		return fmt.Errorf("no sources found. Please add sources first using 'freectl add'")
	}

	log.Info("Starting preprocessing", "cache_dir", s.CacheDir, "sources", len(s.Sources))

	// Create processing config from settings
	config := preprocessing.DefaultProcessingConfig()
	config.ParallelProcessing = parallel

	// Create processing engine
	engine := preprocessing.NewProcessingEngine(s.CacheDir, config)

	// Filter sources if specific source requested
	sourcesToProcess := s.Sources
	if sourceName != "" {
		var filteredSources []sources.Source
		for _, source := range s.Sources {
			if source.Name == sourceName {
				// Check if processing is needed
				if !force && !engine.NeedsProcessing(source) {
					log.Info("Source is already up-to-date", "name", sourceName)
					return nil
				}
				filteredSources = append(filteredSources, source)
				break
			}
		}

		if len(filteredSources) == 0 {
			return fmt.Errorf("source '%s' not found", sourceName)
		}

		sourcesToProcess = filteredSources
	}

	// Filter enabled sources and check if processing is needed
	var sourcesToProcessFiltered []sources.Source
	for _, source := range sourcesToProcess {
		if source.Enabled || sourceName != "" {
			// Check if processing is needed (unless forced)
			if !force && sourceName == "" && !engine.NeedsProcessing(source) {
				log.Debug("Skipping up-to-date source", "name", source.Name)
				continue
			}

			sourcesToProcessFiltered = append(sourcesToProcessFiltered, source)
		}
	}

	if len(sourcesToProcessFiltered) == 0 {
		log.Info("No sources need processing")
		return nil
	}

	// Process the sources
	log.Info("Processing sources", "count", len(sourcesToProcessFiltered), "parallel", parallel)

	var processed, failed int
	for _, source := range sourcesToProcessFiltered {
		log.Info("Processing source", "name", source.Name, "type", source.Type)

		if err := engine.ProcessSource(source); err != nil {
			log.Error("Failed to process source", "name", source.Name, "error", err)
			failed++
			continue
		}

		processed++
	}

	processingTime := time.Since(startTime)
	log.Info("Processing completed",
		"processed", processed,
		"failed", failed,
		"duration", processingTime)

	if failed > 0 {
		return fmt.Errorf("processing completed with %d failures", failed)
	}

	// Show processing status
	if err := showProcessingStatus(engine); err != nil {
		log.Warn("Failed to show processing status", "error", err)
	}

	return nil
}

// showProcessingStatus displays the current processing status
func showProcessingStatus(engine *preprocessing.ProcessingEngine) error {
	statuses, err := engine.GetProcessingStatus()
	if err != nil {
		return fmt.Errorf("failed to get processing status: %w", err)
	}

	if len(statuses) == 0 {
		log.Info("No processed sources found")
		return nil
	}

	log.Info("Processing Status:")
	for _, status := range statuses {
		var statusColor string
		switch status.Status {
		case "completed":
			statusColor = "✅"
		case "completed_with_errors":
			statusColor = "⚠️ "
		case "error":
			statusColor = "❌"
		default:
			statusColor = "🔄"
		}

		log.Info(fmt.Sprintf("%s %s", statusColor, status.SourceName),
			"status", status.Status,
			"items", status.ItemsProcessed,
			"completed", status.CompletedAt.Format("2006-01-02 15:04:05"))

		if status.Error != "" {
			log.Warn("  Error: " + status.Error)
		}
	}

	return nil
}

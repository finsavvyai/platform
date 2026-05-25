package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/sdlc-ai/platform/internal/docs"
)

func main() {
	var (
		configFile = flag.String("config", "", "Configuration file path")
		outputDir  = flag.String("output", "./docs", "Output directory for documentation")
		specFile   = flag.String("spec", "./api/openapi.yaml", "OpenAPI specification file path")
		watch      = flag.Bool("watch", false, "Enable file watching for hot reload")
		verbose    = flag.Bool("verbose", false, "Enable verbose logging")
		force      = flag.Bool("force", false, "Force update even if no changes detected")
		version    = flag.Bool("version", false, "Show version information")
	)
	flag.Parse()

	if *version {
		fmt.Println("SDLC.ai Documentation Generator v1.0.0")
		os.Exit(0)
	}

	// Initialize logger
	logger := initLogger(*verbose)

	// Create configuration
	config := docs.AutoUpdaterConfig{
		SourceDirs: []string{
			"./internal/interfaces/http/routes",
			"./internal/domain/services",
			"./cmd",
		},
		WatchPatterns: []string{
			"*.go",
			"openapi.yaml",
			"*.yaml",
			"*.yml",
		},
		OutputDir:            *outputDir,
		SpecFilePath:         *specFile,
		TemplatesDir:         "./templates/docs",
		UpdateInterval:       5 * time.Minute,
		EnableHotReload:      *watch,
		EnableGitIntegration: true,
		GitRepoPath:          ".",
		ValidateSpec:         true,
		LintSpec:             true,
		EnableCache:          true,
		Logger:               logger,
	}

	// Load configuration from file if provided
	if *configFile != "" {
		if err := loadConfigFile(*configFile, &config); err != nil {
			logger.Fatal("Failed to load configuration", zap.Error(err))
		}
	}

	// Create auto updater
	updater, err := docs.NewAutoUpdater(config)
	if err != nil {
		logger.Fatal("Failed to create auto updater", zap.Error(err))
	}

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start updater
	if err := updater.Start(ctx); err != nil {
		logger.Fatal("Failed to start updater", zap.Error(err))
	}

	// Trigger initial update
	req := docs.UpdateRequest{
		Type:      docs.UpdateTypeManual,
		Force:     *force,
		Timestamp: time.Now(),
		Source:    "cli",
		Metadata: map[string]interface{}{
			"triggered_by": os.Getenv("USER"),
			"hostname":     getHostname(),
		},
	}

	if err := updater.TriggerUpdate(req); err != nil {
		logger.Error("Failed to trigger update", zap.Error(err))
	}

	// If not watching, exit after update
	if !*watch {
		logger.Info("Documentation update completed")
		os.Exit(0)
	}

	// Wait for interrupt signal
	<-sigChan
	logger.Info("Shutting down...")

	// Stop updater
	updater.Stop()

	logger.Info("Documentation updater stopped")
}

// initLogger initializes the logger
func initLogger(verbose bool) *zap.Logger {
	var config zap.Config
	if verbose {
		config = zap.NewDevelopmentConfig()
		config.Level = zap.NewAtomicLevelAt(zapcore.DebugLevel)
	} else {
		config = zap.NewProductionConfig()
		config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	}

	logger, err := config.Build()
	if err != nil {
		logrus.Fatalf("Failed to initialize logger: %v", err)
	}

	return logger
}

// loadConfigFile loads configuration from a YAML file
func loadConfigFile(path string, config *docs.AutoUpdaterConfig) error {
	// Implementation would load YAML configuration
	return nil
}

// getHostname returns the current hostname
func getHostname() string {
	if hostname, err := os.Hostname(); err == nil {
		return hostname
	}
	return "unknown"
}

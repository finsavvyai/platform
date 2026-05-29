package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/sdlc-ai/platform/services/gateway/internal/docs"
)

var (
	configFile = flag.String("config", "", "Configuration file path")
	watch      = flag.Bool("watch", false, "Enable watch mode")
	verbose    = flag.Bool("verbose", false, "Enable verbose logging")
	outputDir  = flag.String("output", "./docs", "Output directory for documentation")
	specFile   = flag.String("spec", "./api/openapi.yaml", "OpenAPI specification file path")
	sourceDirs = flag.String("sources", "./internal/interfaces/http/routes", "Comma-separated list of source directories")
	interval   = flag.Duration("interval", 5*time.Minute, "Update interval in watch mode")
	force      = flag.Bool("force", false, "Force update documentation")
)

func main() {
	flag.Parse()

	// Initialize logger
	logger := initLogger(*verbose)
	defer logger.Sync()

	// Create configuration
	config := docs.AutoUpdaterConfig{
		SourceDirs:           splitDirs(*sourceDirs),
		WatchPatterns:        []string{"*.go", "*.yaml", "*.yml"},
		OutputDir:            *outputDir,
		SpecFilePath:         *specFile,
		TemplatesDir:         filepath.Join(*outputDir, "templates"),
		UpdateInterval:       *interval,
		EnableHotReload:      *watch,
		EnableGitIntegration: true,
		GitRepoPath:          ".",
		ValidateSpec:         true,
		LintSpec:             true,
		EnableCache:          true,
		Logger:               logger,
	}

	// Load additional config from file if provided
	if *configFile != "" {
		if err := loadConfigFromFile(&config, *configFile); err != nil {
			logger.Error("Failed to load configuration", zap.Error(err))
			os.Exit(1)
		}
	}

	// Create auto updater
	updater, err := docs.NewAutoUpdater(config)
	if err != nil {
		logger.Error("Failed to create auto updater", zap.Error(err))
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start updater
	if err := updater.Start(ctx); err != nil {
		logger.Error("Failed to start auto updater", zap.Error(err))
		os.Exit(1)
	}

	// Trigger initial update
	req := docs.UpdateRequest{
		Type:      docs.UpdateTypeManual,
		Force:     *force,
		Files:     getAllGoFiles(config.SourceDirs),
		Timestamp: time.Now(),
		Source:    "cli",
	}

	if err := updater.TriggerUpdate(req); err != nil {
		logger.Error("Failed to trigger update", zap.Error(err))
		os.Exit(1)
	}

	if *watch {
		logger.Info("Watching for changes...")
		select {
		case <-sigChan:
			logger.Info("Received signal, stopping...")
			cancel()
		case <-ctx.Done():
			logger.Info("Context cancelled")
		}
	}

	// Stop updater
	updater.Stop()

	logger.Info("Documentation update completed")
}

func initLogger(verbose bool) *zap.Logger {
	config := zap.NewProductionConfig()
	if verbose {
		config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
		config.Development = true
		config.Encoding = "console"
		config.EncoderConfig = zapcore.EncoderConfig{
			TimeKey:        "time",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "msg",
			StacktraceKey:  "stacktrace",
			LineEnding:     zapcore.DefaultLineEnding,
			EncodeLevel:    zapcore.CapitalColorLevelEncoder,
			EncodeTime:     zapcore.ISO8601TimeEncoder,
			EncodeDuration: zapcore.StringDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		}
	} else {
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}

	logger, _ := config.Build()
	return logger
}

func splitDirs(dirs string) []string {
	if dirs == "" {
		return []string{}
	}

	var result []string
	for _, dir := range strings.Split(dirs, ",") {
		result = append(result, strings.TrimSpace(dir))
	}
	return result
}

func getAllGoFiles(dirs []string) []string {
	var files []string
	for _, dir := range dirs {
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(path, ".go") {
				files = append(files, path)
			}
			return nil
		})
	}
	return files
}

func loadConfigFromFile(config *docs.AutoUpdaterConfig, configFile string) error {
	// Implementation would load config from YAML/JSON file
	// For now, just return nil
	return nil
}

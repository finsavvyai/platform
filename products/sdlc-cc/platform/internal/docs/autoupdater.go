package docs

import (
	"context"
	"time"

	"go.uber.org/zap"
)

// UpdateType represents the type of update
type UpdateType string

const (
	UpdateTypeManual UpdateType = "manual"
	UpdateTypeAuto   UpdateType = "auto"
)

// AutoUpdaterConfig holds configuration for the documentation auto-updater
type AutoUpdaterConfig struct {
	SourceDirs           []string
	WatchPatterns        []string
	OutputDir            string
	SpecFilePath         string
	TemplatesDir         string
	UpdateInterval       time.Duration
	EnableHotReload      bool
	EnableGitIntegration bool
	GitRepoPath          string
	ValidateSpec         bool
	LintSpec             bool
	EnableCache          bool
	Logger               *zap.Logger
}

// UpdateRequest represents a request to update documentation
type UpdateRequest struct {
	Type      UpdateType
	Force     bool
	Timestamp time.Time
	Source    string
	Metadata  map[string]interface{}
}

// AutoUpdater handles automatic documentation updates
type AutoUpdater struct {
	config AutoUpdaterConfig
	logger *zap.Logger
}

// NewAutoUpdater creates a new documentation auto-updater
func NewAutoUpdater(config AutoUpdaterConfig) (*AutoUpdater, error) {
	return &AutoUpdater{
		config: config,
		logger: config.Logger,
	}, nil
}

// Start starts the auto-updater
func (au *AutoUpdater) Start(ctx context.Context) error {
	au.logger.Info("Documentation auto-updater started")
	return nil
}

// Stop stops the auto-updater
func (au *AutoUpdater) Stop() {
	au.logger.Info("Documentation auto-updater stopped")
}

// TriggerUpdate triggers a documentation update
func (au *AutoUpdater) TriggerUpdate(req UpdateRequest) error {
	au.logger.Info("Documentation update triggered",
		zap.String("type", string(req.Type)),
		zap.Bool("force", req.Force),
		zap.String("source", req.Source),
	)
	return nil
}

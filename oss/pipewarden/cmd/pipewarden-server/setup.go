package main

import (
	"log"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/clawpipe"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/mesh"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/tracing"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// initLogging starts the logger plus runtime tracing and mesh VPN.
func initLogging(cfg *config.Config) *logging.Logger {
	logger, err := logging.New(&cfg.Logging)
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}

	if err := tracing.Start(); err != nil {
		logger.Warnw("runtime trace start failed", "error", err)
	} else if tracing.Active() {
		logger.Infow("runtime trace active — view with `go tool trace`")
	}

	if err := mesh.Init(); err != nil {
		logger.Warnw("mesh init failed; outbound calls fall back to default client", "error", err)
	} else if mesh.Active() {
		logger.Infow("embedded mesh VPN active")
	}

	return logger
}

// openDatabase opens the storage backend with optional CLI override.
func openDatabase(cfg *config.Config, dbPathOverride string, logger *logging.Logger) *storage.DB {
	dbCfg := storage.Config{
		Driver:          cfg.Database.Driver,
		Path:            cfg.Database.Path,
		URL:             cfg.Database.URL,
		Host:            cfg.Database.Host,
		Port:            cfg.Database.Port,
		Username:        cfg.Database.Username,
		Password:        cfg.Database.Password,
		Name:            cfg.Database.Name,
		SSLMode:         cfg.Database.SSLMode,
		WALMode:         cfg.Database.WALMode,
		MaxOpenConns:    cfg.Database.MaxOpenConns,
		MaxIdleConns:    cfg.Database.MaxIdleConns,
		ConnMaxLifetime: cfg.Database.ConnMaxLifetime,
	}
	if dbPathOverride != "pipewarden.db" {
		dbCfg.Path = dbPathOverride
		dbCfg.Driver = "sqlite"
	}
	db, err := storage.NewFromConfig(dbCfg)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	logger.Infow("Database connected", "driver", db.Driver())
	return db
}

// initVault returns an initialized credential vault.
func initVault(cfg *config.Config, logger *logging.Logger) *vault.Vault {
	v, err := vault.New(cfg.Vault.EncryptionKey)
	if err != nil {
		log.Fatalf("Failed to initialize vault: %v", err)
	}
	if v.Enabled() {
		logger.Infow("Credential vault enabled", "encryption", "AES-256-GCM")
	} else {
		logger.Warnw("Credential vault disabled; persisted provider connections will be rejected until PIPEWARDEN_VAULT_KEY is set")
	}
	return v
}

// buildClaudeAnalyzer wires Claude with optional ClawPipe cost optimization.
func buildClaudeAnalyzer(cfg *config.Config, logger *logging.Logger) *aianalysis.ClaudeAnalyzer {
	a := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{
		APIKey:  cfg.Analysis.ClaudeAPIKey,
		Model:   cfg.Analysis.ClaudeModel,
		BaseURL: cfg.Analysis.ClaudeBaseURL,
	}, logger)
	if a.Enabled() {
		logger.Infow("Analysis engine enabled", "provider", "Claude", "model", cfg.Analysis.ClaudeModel)
	}
	if cfg.Claw.APIKey != "" {
		clawClient := clawpipe.NewClient(clawpipe.Config{
			APIKey:    cfg.Claw.APIKey,
			ProjectID: cfg.Claw.ProjectID,
			BaseURL:   cfg.Claw.Endpoint,
		})
		a.SetClawPipe(clawClient)
		logger.Infow("Cost optimization enabled", "provider", "ClawPipe")
	}
	return a
}

// logIntegrationFlags surfaces SIEM and PushCI status at startup.
func logIntegrationFlags(cfg *config.Config, logger *logging.Logger) {
	if cfg.SIEM.SlackWebhookURL != "" || cfg.SIEM.PagerDutyKey != "" || cfg.SIEM.JiraBaseURL != "" {
		logger.Infow("SIEM routing enabled",
			"slack", cfg.SIEM.SlackWebhookURL != "",
			"pagerduty", cfg.SIEM.PagerDutyKey != "",
			"jira", cfg.SIEM.JiraBaseURL != "",
		)
	}
	if cfg.PushCI.APIKey != "" {
		logger.Infow("PushCI auto-fix bridge enabled")
	}
}

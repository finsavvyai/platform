// Package main is the hosted PipeWarden SaaS server: dashboard, REST
// API, OAuth, billing, team management, audit log routing, and all
// hosted handlers. The OSS CLI lives in a separate binary
// (cmd/pipewarden) so the open-core surface stays free of these
// hosted dependencies.
//
// Usage:
//
//	pipewarden-server [-config <path>] [-db <path>] [-version]
//
// All long-lived runtime configuration is read from the config file
// (default: $PIPEWARDEN_CONFIG_PATH) and environment variables —
// see internal/config for the schema.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/handlers"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/router"
	"github.com/finsavvyai/pipewarden/internal/tracing"
)

var (
	version = "dev"
	commit  = "unknown"
	date    = "unknown"
)

const banner = `
PipeWarden Server — CI/CD Pipeline Security Guardian
DevSecOps • Multi-Platform • AI-Powered Remediation
`

func main() {
	configPath := flag.String("config", "", "path to config file")
	dbPath := flag.String("db", "pipewarden.db", "path to SQLite database")
	showVersion := flag.Bool("version", false, "print version information and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("pipewarden-server version=%s commit=%s date=%s\n", version, commit, date)
		return
	}

	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	if err := config.ValidateRequiredConfig(cfg); err != nil {
		log.Fatalf("Refusing to start: %v", err)
	}

	logger := initLogging(cfg)
	defer func() { _ = logger.Sync() }()
	defer tracing.Stop()

	logger.Infow(banner)
	logger.Infow("PipeWarden Server startup",
		"version", version,
		"commit", commit,
		"build_date", date,
		"environment", cfg.Environment,
		"port", cfg.Server.Port,
		"database_driver", cfg.Database.Driver,
	)

	db := openDatabase(cfg, *dbPath, logger)
	defer func() { _ = db.Close() }()

	v := initVault(cfg, logger)

	manager := integrations.NewManager(logger)
	handlers.LoadConnectionsFromDB(db, manager, v, logger, cfg)

	claudeAnalyzer := buildClaudeAnalyzer(cfg, logger)
	heuristicAnalyzer := analysis.NewHeuristicAnalyzer()
	_ = aianalysis.ClaudeConfig{} // keep import used even when build cuts the wiring

	logIntegrationFlags(cfg, logger)

	h := router.New(db, manager, claudeAnalyzer, heuristicAnalyzer, logger, v, cfg)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      h,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	go func() {
		logger.Infow("Server listening",
			"url", fmt.Sprintf("http://localhost:%d", cfg.Server.Port),
			"health", fmt.Sprintf("http://localhost:%d/health", cfg.Server.Port),
			"readiness", fmt.Sprintf("http://localhost:%d/readiness", cfg.Server.Port),
		)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalw("Server startup failed", "error", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Infow("Shutdown signal received", "signal", "SIGTERM")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Errorw("Shutdown error", "error", err)
	}
	logger.Infow("Server stopped gracefully")
}

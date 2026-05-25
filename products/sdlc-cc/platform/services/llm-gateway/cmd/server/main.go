package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/internal/observability"
	"github.com/sirupsen/logrus"
)

// @title LLM Gateway API
// @version 1.0
// @description A multi-provider LLM gateway with failover, cost tracking, and security features
// @host localhost:8080
// @BasePath /api/v1
func main() {
	// Load configuration
	cfg, err := config.LoadConfig("")
	if err != nil {
		logrus.WithError(err).Fatal("Failed to load configuration")
	}

	// Setup logger
	logger := setupLogger(cfg.Logging)
	logger.WithFields(logrus.Fields{
		"version": "1.0.0",
		"port":    cfg.Server.Port,
	}).Info("Starting LLM Gateway")

	// Initialize OpenTelemetry (OpenLLMetry-compatible). No-op if OTEL_ENABLED is unset.
	otelTP, err := observability.InitOTel("llm-gateway")
	if err != nil {
		logger.WithError(err).Warn("Failed to initialize OpenTelemetry; continuing without tracing")
	} else if otelTP != nil {
		logger.Info("OpenTelemetry tracing enabled (OTel GenAI semantic conventions)")
		defer func() {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := otelTP.Shutdown(shutdownCtx); err != nil {
				logger.WithError(err).Warn("OTel tracer provider shutdown error")
			}
		}()
	}

	// Setup dependencies
	costTracker := setupCostTracker(cfg, logger)
	validator := setupValidator(cfg, logger)
	promptDefender := setupPromptDefender(cfg, logger)
	responseSanitizer := setupResponseSanitizer(cfg, logger)

	// Create LLM gateway
	gateway := llm.NewGateway(
		&llm.Config{
			DefaultProvider:    cfg.LLM.DefaultProvider,
			MaxRetries:         cfg.LLM.MaxRetries,
			RetryDelay:         cfg.LLM.RetryDelay,
			Timeout:            cfg.LLM.Timeout,
			EnableFailover:     cfg.LLM.EnableFailover,
			EnableCostTracking: cfg.LLM.EnableCostTracking,
			EnableValidation:   cfg.LLM.EnableValidation,
			Security:           cfg.LLM.Security,
			Budgets:            cfg.LLM.Budgets,
			Providers:          cfg.LLM.Providers,
		},
		costTracker,
		validator,
		promptDefender,
		responseSanitizer,
		logger,
		nil,  // provider factory (auto-created from config)
		nil,  // cacheStore for ReasoningBank (nil = disabled)
	)

	// Setup HTTP server
	router := setupRouter(cfg, gateway, logger)

	// Create server
	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start monitoring server if enabled
	if cfg.Monitoring.Enabled {
		go startMonitoringServer(cfg.Monitoring, logger)
	}

	// Start server in a goroutine
	go func() {
		logger.WithField("addr", server.Addr).Info("Starting HTTP server")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("Server failed to start")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.WithError(err).Error("Server forced to shutdown")
	}

	logger.Info("Server exited")
}

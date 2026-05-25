//go:build ignore

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SDLC/llm-gateway/internal/api/handlers"
	"github.com/SDLC/llm-gateway/internal/api/middleware"
	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/internal/validation"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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
	)

	// Setup HTTP server
	router := setupRouter(cfg, gateway, handler)

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

// setupLogger configures the logger
func setupLogger(cfg config.LoggingConfig) *logrus.Logger {
	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set formatter
	if cfg.Format == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.RFC3339,
		})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: time.RFC3339,
		})
	}

	// Set output
	if cfg.Output == "file" {
		file, err := os.OpenFile("llm-gateway.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			logger.SetOutput(os.Stdout)
		} else {
			logger.SetOutput(file)
		}
	} else {
		logger.SetOutput(os.Stdout)
	}

	return logger
}

// setupCostTracker creates a cost tracker
func setupCostTracker(cfg *config.Config, logger *logrus.Logger) storage.CostTracker {
	// For now, return a mock implementation
	// In production, this would connect to PostgreSQL
	return &storage.MockCostTracker{}
}

// setupValidator creates a request validator
func setupValidator(cfg *config.Config, logger *logrus.Logger) validation.Validator {
	bannedModels := []string{}
	for _, provider := range cfg.LLM.Providers {
		for _, model := range provider.Models {
			if !model.Enabled {
				bannedModels = append(bannedModels, model.ID)
			}
		}
	}

	return validation.NewDefaultValidator(
		10000, // max prompt length
		50,    // max messages
		bannedModels,
	)
}

// setupPromptDefender creates a prompt defender
func setupPromptDefender(cfg *config.Config, logger *logrus.Logger) validation.PromptDefender {
	defender := validation.NewDefaultPromptDefender()

	// Add banned patterns from config
	for _, pattern := range cfg.LLM.Security.BannedPatterns {
		if err := defender.AddBannedPattern(pattern); err != nil {
			logger.WithError(err).WithField("pattern", pattern).Warn("Failed to add banned pattern")
		}
	}

	return defender
}

// setupResponseSanitizer creates a response sanitizer
func setupResponseSanitizer(cfg *config.Config, logger *logrus.Logger) validation.ResponseSanitizer {
	return validation.NewDefaultResponseSanitizer(cfg.LLM.Security.MaxResponseLength)
}

// setupRouter configures the HTTP router
func setupRouter(cfg *config.Config, gateway *llm.Gateway, logger *logrus.Logger) *gin.Engine {
	// Set Gin mode
	gin.SetMode(cfg.Server.GinMode)

	// Create router
	router := gin.New()

	// Add middleware
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())

	if cfg.Auth.Enabled {
		router.Use(middleware.Auth(cfg.Auth.JWTSecret))
	}

	// Create handlers
	handler := handlers.NewHandler(gateway, logger)

	// API routes
	api := router.Group("/api/v1")
	{
		// Completion endpoints
		api.POST("/complete", handler.Complete)
		api.POST("/complete/stream", handler.CompleteStream)

		// Model endpoints
		api.GET("/models", handler.Models)

		// Provider endpoints
		api.GET("/providers", handler.Providers)
		api.POST("/providers/:provider/enable", handler.EnableProvider)
		api.POST("/providers/:provider/disable", handler.DisableProvider)

		// Monitoring endpoints
		api.GET("/health", handler.Health)
		api.GET("/stats/usage", handler.GetUsageStats)
		api.GET("/stats/costs", handler.GetCostHistory)

		// Validation endpoint
		api.POST("/validate", handler.ValidateRequest)
	}

	// Documentation endpoint
	router.Static("/docs", "./docs")
	router.GET("/", func(c *gin.Context) {
		c.Redirect(302, "/docs")
	})

	// Health check endpoint (without auth)
	router.GET("/healthz", handler.Health)

	return router
}

// startMonitoringServer starts the Prometheus monitoring server
func startMonitoringServer(cfg config.MonitoringConfig, logger *logrus.Logger) {
	router := gin.New()
	router.GET(cfg.Path, gin.WrapH(promhttp.Handler()))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.WithFields(logrus.Fields{
		"addr": addr,
		"path": cfg.Path,
	}).Info("Starting monitoring server")

	if err := router.Run(addr); err != nil {
		logger.WithError(err).Error("Monitoring server failed to start")
	}
}

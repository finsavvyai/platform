package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/database"
	"github.com/mcpoverflow/api-service/internal/handlers"
	"github.com/mcpoverflow/api-service/internal/health"
	"github.com/mcpoverflow/api-service/internal/logging"
	"github.com/mcpoverflow/api-service/internal/metrics"
	"github.com/mcpoverflow/api-service/internal/middleware"
	"github.com/mcpoverflow/api-service/internal/monitoring"
	"go.uber.org/zap"
)

const Version = "0.1.4"

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize structured logging
	logCfg := logging.Config{
		Level:       getEnv("LOG_LEVEL", "info"),
		Format:      getEnv("LOG_FORMAT", "json"),
		Environment: cfg.Environment,
	}
	if err := logging.Init(logCfg); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logging.Sync()

	logging.Info("Starting MCPOverflow API",
		zap.String("version", Version),
		zap.String("environment", cfg.Environment),
	)

	// Initialize Sentry for error tracking
	sentryConfig := monitoring.SentryConfig{
		DSN:              os.Getenv("SENTRY_DSN"),
		Environment:      cfg.Environment,
		Release:          "mcpoverflow-api@" + Version,
		TracesSampleRate: 0.1,
		Debug:            cfg.Environment != "production",
		AttachStacktrace: true,
	}
	if err := monitoring.InitSentry(sentryConfig); err != nil {
		logging.Warn("Failed to initialize Sentry", zap.Error(err))
	}
	defer monitoring.Flush(2 * time.Second)

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize database
	db, err := database.NewDatabase(cfg)
	if err != nil {
		logging.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer db.Close()

	// Create router
	router := gin.New()

	// Apply structured logging and recovery middleware
	router.Use(logging.GinLogger())
	router.Use(logging.GinRecovery())
	router.Use(monitoring.SentryMiddleware())

	// Apply Prometheus metrics middleware
	router.Use(metrics.PrometheusMiddleware())

	// Apply other middleware
	router.Use(middleware.ErrorHandler())
	router.Use(middleware.CORS())
	router.Use(middleware.SecurityHeaders())

	// Apply Redis-based rate limiting
	rateLimitConfig := middleware.DefaultRateLimitConfig()
	if cfg.Environment == "production" {
		rateLimitConfig.RequestsPerWindow = 60
		rateLimitConfig.SkipFailedLimiters = false
	} else {
		rateLimitConfig.RequestsPerWindow = 1000
		rateLimitConfig.SkipFailedLimiters = true
	}
	router.Use(middleware.RateLimiterRedis(db.Redis, rateLimitConfig))

	// Add database to context
	router.Use(func(c *gin.Context) {
		c.Set("db", db.DB)
		c.Set("redis", db.Redis)
		c.Set("config", cfg)
		c.Next()
	})

	// Register health check endpoints
	healthHandler := health.NewHealthHandler(db.DB, db.Redis, "mcpoverflow-api", Version)
	healthHandler.RegisterRoutes(router)

	// Register Prometheus metrics endpoint
	router.GET("/metrics", metrics.MetricsHandler())

	// Setup application routes
	handlers.SetupRoutes(router, cfg, db.DB)

	// Start server with graceful shutdown
	port := getEnv("PORT", "8080")
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Run server in a goroutine
	go func() {
		logging.Info("Server starting",
			zap.String("port", port),
			zap.String("environment", cfg.Environment),
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logging.Fatal("Server failed to start", zap.Error(err))
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logging.Info("Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logging.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logging.Info("Server exited gracefully")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

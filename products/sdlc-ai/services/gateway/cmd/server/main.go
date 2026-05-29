//go:build ignore

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/discovery"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/proxy"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/routes"
	"github.com/sdlc-ai/platform/services/gateway/internal/openclaw"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

// Application holds the application dependencies
type Application struct {
	Config          *config.Config
	Logger          *observability.Logger
	TraceHelper     *observability.TraceHelper
	TracerProvider  *observability.TracerProvider
	DB              *database.Connection
	PolicyEngine    *policy.PolicyEngine
	ServiceRegistry *discovery.ServiceRegistry
	HealthRegistry  *health.Registry
	CircuitRegistry *circuitbreaker.Registry
	Proxy           *proxy.Proxy
	Server          *http.Server
	ShutdownTimeout time.Duration
}

func main() {
	// Initialize application
	app, err := initializeApplication()
	if err != nil {
		logrus.WithError(err).Fatal("Failed to initialize application")
	}

	// Start application
	if err := app.Start(); err != nil {
		logrus.WithError(err).Fatal("Failed to start application")
	}

	// Wait for shutdown signal
	app.WaitForShutdown()

	// Graceful shutdown
	if err := app.Shutdown(); err != nil {
		logrus.WithError(err).Error("Application shutdown failed")
	}

	logrus.Info("Application exited successfully")
}

// initializeApplication initializes all application components
func initializeApplication() (*Application, error) {
	ctx := context.Background()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load configuration: %w", err)
	}

	// Initialize observability
	logger, traceHelper, tracerProvider, err := initializeObservability(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize observability: %w", err)
	}

	logger.WithContext(ctx).Info("Observability initialized")

	// Initialize core infrastructure
	db, policyEngine, err := initializeCoreInfrastructure(ctx, cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize core infrastructure: %w", err)
	}

	logger.WithContext(ctx).Info("Core infrastructure initialized")

	// Initialize service discovery
	serviceRegistry := discovery.InitializeGlobalServiceRegistry(cfg)
	logger.WithContext(ctx).Info("Service discovery initialized")

	// Initialize health checks
	healthRegistry := health.InitializeGlobalHealth(cfg, db)
	logger.WithContext(ctx).Info("Health checks initialized")

	// Initialize circuit breakers
	circuitRegistry := circuitbreaker.GetGlobalRegistry()
	logger.WithContext(ctx).Info("Circuit breakers initialized")

	// Initialize proxy
	proxyConfig := proxy.DefaultProxyConfig()
	proxyMiddleware := proxy.CreateProxyMiddleware(
		proxyConfig,
		serviceRegistry,
		logger,
		traceHelper,
	)

	// Create application
	app := &Application{
		Config:          cfg,
		Logger:          logger,
		TraceHelper:     traceHelper,
		TracerProvider:  tracerProvider,
		DB:              db,
		PolicyEngine:    policyEngine,
		ServiceRegistry: serviceRegistry,
		HealthRegistry:  healthRegistry,
		CircuitRegistry: circuitRegistry,
		Proxy:           nil, // Will be set during router setup
		ShutdownTimeout: cfg.Server.GracefulShutdownTimeout,
	}

	// Setup router
	router := app.setupRouter(proxyMiddleware)

	// Setup HTTP server
	app.Server = &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	logger.WithContext(ctx).WithField("port", cfg.Server.Port).Info("Application initialized")

	return app, nil
}

// initializeObservability initializes logging, tracing, and metrics
func initializeObservability(cfg *config.Config) (*observability.Logger, *observability.TraceHelper, *observability.TracerProvider, error) {
	// Initialize logging
	if err := observability.InitializeGlobalLogging(cfg); err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize logging: %w", err)
	}
	logger := observability.GetGlobalLogger()

	// Initialize tracing
	tracerProvider, err := observability.InitializeGlobalTracing(cfg)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize tracing: %w", err)
	}

	// Initialize trace helper
	traceHelper := observability.GetGlobalTraceHelper("gateway")

	return logger, traceHelper, tracerProvider, nil
}

// initializeCoreInfrastructure initializes database and policy engine
func initializeCoreInfrastructure(ctx context.Context, cfg *config.Config, logger *observability.Logger) (*database.Connection, *policy.PolicyEngine, error) {
	// Initialize database connection
	db, err := database.NewConnection(cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	logger.WithContext(ctx).Info("Database connection established")

	// Initialize policy engine
	policyEngine, err := policy.NewPolicyEngine(cfg)
	if err != nil {
		db.Close()
		return nil, nil, fmt.Errorf("failed to initialize policy engine: %w", err)
	}

	logger.WithContext(ctx).Info("Policy engine initialized")

	return db, policyEngine, nil
}

// setupRouter sets up the HTTP router with all middleware and routes
func (app *Application) setupRouter(proxyMiddleware func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	// Create enhanced middleware
	enhancedMW := middleware.NewEnhancedMiddleware(
		app.Config,
		app.Logger,
		app.TraceHelper,
		app.CircuitRegistry,
	)

	// Apply middleware chain
	middlewares := enhancedMW.CreateMiddlewareChain()
	for _, mw := range middlewares {
		r.Use(mw)
	}

	// Apply proxy middleware
	r.Use(proxyMiddleware)

	// Metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Health check endpoints
	healthHandler := health.NewHTTPHandler(app.HealthRegistry)
	r.Get("/health", healthHandler.ServeHTTP)
	r.Get("/health/ready", healthHandler.ServeHTTP)
	r.Get("/health/live", healthHandler.ServeHTTP)
	r.Get("/health/dependencies", healthHandler.ServeHTTP)

	// Service discovery endpoints
	r.Route("/services", func(r chi.Router) {
		r.Get("/", app.handleListServices)
		r.Get("/{service}", app.handleGetService)
		r.Post("/{service}", app.handleRegisterService)
		r.Delete("/{service}/{instance}", app.handleUnregisterService)
	})

	// API routes — initialize handler dependencies
	logrusLogger := logrus.New()
	logrusLogger.SetLevel(app.Config.GetLogrusLevel())
	logrusLogger.SetFormatter(&logrus.JSONFormatter{})

	// Initialize OpenClaw client from config
	var openClawClient *openclaw.Client
	var memoryService *openclaw.MemoryService

	openClawCfg := openclaw.Config{
		Enabled:        app.Config.OpenClaw.Enabled,
		GatewayURL:     app.Config.OpenClaw.GatewayURL,
		HookToken:      app.Config.OpenClaw.HookToken,
		DefaultChannel: app.Config.OpenClaw.DefaultChannel,
		TimeoutSeconds: app.Config.OpenClaw.TimeoutSeconds,
		MaxRetries:     app.Config.OpenClaw.MaxRetries,
		RetryDelayMs:   app.Config.OpenClaw.RetryDelayMs,
	}

	openClawClient = openclaw.NewClientWithConfig(openClawCfg, logrusLogger)
	memoryService = openclaw.NewMemoryService(logrusLogger)

	if app.Config.OpenClaw.Enabled {
		app.Logger.WithContext(context.Background()).Info("OpenClaw integration enabled")
	} else {
		app.Logger.WithContext(context.Background()).Info("OpenClaw integration disabled")
	}

	deps := &handlers.Dependencies{
		Config:       app.Config,
		DB:           app.DB,
		PolicyEngine: app.PolicyEngine,
		OpenClaw:     openClawClient,
		Memory:       memoryService,
	}
	routes.SetupRoutes(r, deps)

	// System endpoints
	r.Get("/version", app.handleVersion)
	r.Get("/info", app.handleInfo)

	return r
}

// Start starts the HTTP server
func (app *Application) Start() error {
	ctx := context.Background()

	// Start health monitoring
	go app.startHealthMonitoring(ctx)

	// Start service discovery monitoring
	go app.startServiceDiscoveryMonitoring(ctx)

	// Start HTTP server
	go func() {
		app.Logger.WithContext(ctx).WithField("port", app.Config.Server.Port).Info("Starting HTTP server")
		if err := app.Server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			app.Logger.WithContext(ctx).WithError(err).Error("HTTP server failed to start")
		}
	}()

	app.Logger.WithContext(ctx).Info("Application started successfully")
	return nil
}

// WaitForShutdown waits for shutdown signals
func (app *Application) WaitForShutdown() {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	app.Logger.Info("Shutdown signal received")
}

// Shutdown performs graceful shutdown
func (app *Application) Shutdown() error {
	ctx := context.Background()
	app.Logger.WithContext(ctx).Info("Starting graceful shutdown")

	// Create shutdown context with timeout
	shutdownCtx, cancel := context.WithTimeout(ctx, app.ShutdownTimeout)
	defer cancel()

	// Shutdown HTTP server
	if err := app.Server.Shutdown(shutdownCtx); err != nil {
		app.Logger.WithContext(ctx).WithError(err).Error("HTTP server shutdown failed")
	} else {
		app.Logger.WithContext(ctx).Info("HTTP server shutdown completed")
	}

	// Shutdown policy engine
	if app.PolicyEngine != nil {
		app.PolicyEngine.Shutdown()
		app.Logger.WithContext(ctx).Info("Policy engine shutdown completed")
	}

	// Shutdown database connection
	if app.DB != nil {
		if err := app.DB.Close(); err != nil {
			app.Logger.WithContext(ctx).WithError(err).Error("Database connection shutdown failed")
		} else {
			app.Logger.WithContext(ctx).Info("Database connection shutdown completed")
		}
	}

	// Shutdown tracing
	if app.TracerProvider != nil {
		if err := app.TracerProvider.Shutdown(shutdownCtx); err != nil {
			app.Logger.WithContext(ctx).WithError(err).Error("Tracer provider shutdown failed")
		} else {
			app.Logger.WithContext(ctx).Info("Tracer provider shutdown completed")
		}
	}

	// Shutdown circuit breakers
	if app.CircuitRegistry != nil {
		app.CircuitRegistry.Shutdown()
		app.Logger.WithContext(ctx).Info("Circuit breakers shutdown completed")
	}

	app.Logger.WithContext(ctx).Info("Graceful shutdown completed")
	return nil
}

// startHealthMonitoring starts periodic health monitoring
func (app *Application) startHealthMonitoring(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			app.performHealthCheck(ctx)
		}
	}
}

// performHealthCheck performs a comprehensive health check
func (app *Application) performHealthCheck(ctx context.Context) {
	report := app.HealthRegistry.CheckAll(ctx)

	// Log health status
	logLevel := logrus.InfoLevel
	switch report.Status {
	case health.StatusUnhealthy:
		logLevel = logrus.ErrorLevel
	case health.StatusDegraded:
		logLevel = logrus.WarnLevel
	}

	app.Logger.WithContext(ctx).WithFields(logrus.Fields{
		"status":        report.Status,
		"total_checks":  len(report.Checks),
		"healthy_count": report.Summary["healthy"],
		"uptime":        report.Uptime.String(),
	}).Log(logLevel, "Health check completed")

	// Update metrics
	if logLevel == logrus.ErrorLevel {
		// Increment unhealthy counter
		// TODO: Implement metrics
	}
}

// startServiceDiscoveryMonitoring starts service discovery monitoring
func (app *Application) startServiceDiscoveryMonitoring(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			app.monitorServiceDiscovery(ctx)
		}
	}
}

// monitorServiceDiscovery monitors service discovery status
func (app *Application) monitorServiceDiscovery(ctx context.Context) {
	services := app.ServiceRegistry.ListServices()
	registryInfo := app.ServiceRegistry.GetRegistryInfo()

	app.Logger.WithContext(ctx).WithFields(logrus.Fields{
		"total_services": len(services),
		"registry_info":  registryInfo,
	}).Debug("Service discovery monitoring completed")
}

// HTTP Handlers

func (app *Application) handleListServices(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	services := app.ServiceRegistry.ListServices()

	response := map[string]interface{}{
		"services": services,
		"count":    len(services),
	}

	render.JSON(w, r, response)
}

func (app *Application) handleGetService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	serviceName := chi.URLParam(r, "service")

	instances, err := app.ServiceRegistry.GetServiceInstances(serviceName)
	if err != nil {
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "SERVICE_NOT_FOUND",
				"message": fmt.Sprintf("Service %s not found", serviceName),
			},
		})
		return
	}

	response := map[string]interface{}{
		"service":   serviceName,
		"instances": instances,
		"count":     len(instances),
	}

	render.JSON(w, r, response)
}

func (app *Application) handleRegisterService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	serviceName := chi.URLParam(r, "service")

	var instance discovery.ServiceInstance
	if err := render.DecodeJSON(r.Body, &instance); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
		return
	}

	instance.Name = serviceName

	if err := app.ServiceRegistry.RegisterService(ctx, &instance); err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "REGISTRATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, map[string]interface{}{
		"message":  "Service instance registered successfully",
		"instance": instance,
	})
}

func (app *Application) handleUnregisterService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	serviceName := chi.URLParam(r, "service")
	instanceID := chi.URLParam(r, "instance")

	if err := app.ServiceRegistry.UnregisterService(ctx, serviceName, instanceID); err != nil {
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "SERVICE_NOT_FOUND",
				"message": err.Error(),
			},
		})
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"message": "Service instance unregistered successfully",
	})
}

func (app *Application) handleVersion(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"version":     app.Config.Version,
		"build_time":  app.Config.BuildTime,
		"git_commit":  app.Config.GitCommit,
		"go_version":  runtime.Version(),
		"environment": app.Config.Environment,
	}

	render.JSON(w, r, response)
}

func (app *Application) handleInfo(w http.ResponseWriter, r *http.Request) {
	healthReport := app.HealthRegistry.CheckAll(r.Context())
	registryInfo := app.ServiceRegistry.GetRegistryInfo()

	response := map[string]interface{}{
		"service":     "SDLC.ai Gateway",
		"version":     app.Config.Version,
		"environment": app.Config.Environment,
		"instance_id": app.Config.InstanceID,
		"start_time":  app.Config.StartTime,
		"uptime":      time.Since(app.Config.StartTime).String(),
		"health":      healthReport,
		"discovery":   registryInfo,
		"system": map[string]interface{}{
			"go_version": runtime.Version(),
			"go_os":      runtime.GOOS,
			"go_arch":    runtime.GOARCH,
			"num_cpu":    runtime.NumCPU(),
			"goroutines": runtime.NumGoroutine(),
		},
	}

	render.JSON(w, r, response)
}

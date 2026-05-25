package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/discovery"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/events"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/proxy"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/redisclient"
	httpmw "github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

var (
	version   = "dev"
	buildTime = "unknown"
	gitCommit = "unknown"
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
	Claw            *ClawService
	Proxy           *proxy.Proxy
	Server          *http.Server
	ShutdownTimeout time.Duration
	Redis           *redis.Client
	RateLimiter     *ratelimit.TierRateLimiter
	Events          *events.Publisher
	Security        *SecuritySuite
	LLM             *LLMSuite
}

func main() {
	if shouldPrintVersion(os.Args) {
		printVersion()
		return
	}

	// Initialize application
	app, err := initializeApplication()
	if err != nil {
		logrus.WithError(err).Fatal("Failed to initialize application")
	}

	// LOCAL_BYPASS(remove-before-prod): announce auth-bypass status so an
	// operator can never miss it on boot. See
	// internal/interfaces/http/middleware/auth_bypass.go.
	logrus.Warn(httpmw.Bootstrap())

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

func shouldPrintVersion(args []string) bool {
	if len(args) < 2 {
		return false
	}

	switch args[1] {
	case "--version", "-version", "version":
		return true
	default:
		return false
	}
}

func printVersion() {
	fmt.Printf(
		"gateway-server version=%s build_time=%s git_commit=%s\n",
		version,
		buildTime,
		gitCommit,
	)
}

// initializeApplication initializes all application components
func initializeApplication() (*Application, error) {
	ctx := context.Background()

	// Load configuration
	cfg, err := config.Load("")
	if err != nil {
		return nil, fmt.Errorf("failed to load configuration: %w", err)
	}
	applyBuildMetadata(cfg)

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

	// Initialize Redis + tier rate limiter (fail-open on Redis error)
	redisClient, rlErr := redisclient.New(ctx, cfg.Redis)
	if rlErr != nil {
		logger.WithContext(ctx).WithError(rlErr).Warn("Redis unavailable; rate limiting disabled")
	}
	var tierLimiter *ratelimit.TierRateLimiter
	if redisClient != nil {
		tierLimiter = ratelimit.NewTierRateLimiter(redisClient)
		logger.WithContext(ctx).Info("Tier rate limiter initialized")
	}

	// Event publisher (nil Redis = fail-open no-op so dev still runs)
	eventPublisher := events.NewPublisher(redisClient, "sdlc:events:")
	logger.WithContext(ctx).Info("Event publisher initialized")

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
		Redis:           redisClient,
		RateLimiter:     tierLimiter,
		Events:          eventPublisher,
	}

	// BEAT-PLAN S1.1: RBAC evaluator + HMAC audit Writer + audit Reader.
	// Nil-tolerant so dev boots without AUDIT_SIGNING_KEY succeed.
	app.Security = initSecuritySuite(ctx, db, logrus.StandardLogger())
	// BEAT-PLAN S1.2: Anthropic provider + spend Tracker + 402 gate.
	// Nil-tolerant so dev boots without ANTHROPIC_API_KEY succeed.
	app.LLM = initLLMSuite(ctx, db)

	app.Claw = NewClawService(
		NewPGClawStore(db),
		policyEngine,
		serviceRegistry,
		healthRegistry,
		logrus.StandardLogger(),
		cfg.Version,
	)
	if err := app.Claw.EnsureSchema(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure claw runtime schema: %w", err)
	}

	// Setup router
	router := app.setupRouter(proxyMiddleware)

	// Setup HTTP server with hardened TLS defaults [BEAT-PLAN Day 37].
	// MinVersion = TLS 1.3 except in dev where the listener is plain
	// HTTP and Server.TLSConfig is unused. CipherSuites is intentionally
	// nil under TLS 1.3 — the Go runtime selects from the AEAD-only set.
	app.Server = &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:           router,
		ReadTimeout:       cfg.Server.ReadTimeout,
		ReadHeaderTimeout: 10 * time.Second, // Slowloris guard
		WriteTimeout:      cfg.Server.WriteTimeout,
		IdleTimeout:       cfg.Server.IdleTimeout,
		MaxHeaderBytes:    1 << 20, // 1 MiB
		TLSConfig:         hardenedTLSConfig(),
	}

	logger.WithContext(ctx).WithField("port", cfg.Server.Port).Info("Application initialized")

	return app, nil
}

// hardenedTLSConfig returns the gateway's tls.Config used when the
// listener is wrapped with TLS (production behind ALB termination
// happens at the LB; in-cluster mTLS uses this). BEAT-PLAN Day 37.
//
// Pinned to TLS 1.3 — the AEAD-only cipher set in Go's stdlib. SNI is
// required, session tickets disabled to limit forward-secrecy
// regressions, renegotiation forbidden.
func hardenedTLSConfig() *tls.Config {
	return &tls.Config{
		MinVersion:               tls.VersionTLS13,
		PreferServerCipherSuites: true,
		SessionTicketsDisabled:   true,
		Renegotiation:            tls.RenegotiateNever,
		// CurvePreferences narrows curve set to NIST P-256 + X25519,
		// which match the AEAD ciphers selected under TLS 1.3.
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
	}
}

func applyBuildMetadata(cfg *config.Config) {
	if version != "" && version != "dev" {
		cfg.Version = version
	}

	if buildTime != "" && buildTime != "unknown" {
		cfg.BuildTime = buildTime
	}

	if gitCommit != "" && gitCommit != "unknown" {
		cfg.GitCommit = gitCommit
	}
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
	// Initialize database connection — pass every pool/retry field
	// through so pgxpool sees MaxSize >= 1 and the connect loop has a
	// non-zero retry budget. Earlier this struct only forwarded
	// host/port/user/password/database, leaving MaxConnections=0 and
	// crashing pgxpool with "MaxSize must be >= 1".
	db, err := database.NewDatabase(&database.Config{
		Host:              cfg.Database.Host,
		Port:              cfg.Database.Port,
		User:              cfg.Database.User,
		Password:          cfg.Database.Password,
		Database:          cfg.Database.Database,
		SSLMode:           cfg.Database.SSLMode,
		MaxConnections:    cfg.Database.MaxConnections,
		MinConnections:    cfg.Database.MinConnections,
		MaxConnLifetime:   cfg.Database.MaxConnLifetime,
		MaxConnIdleTime:   cfg.Database.MaxConnIdleTime,
		HealthCheckPeriod: cfg.Database.HealthCheckPeriod,
		ConnectTimeout:    cfg.Database.ConnectTimeout,
		RetryAttempts:     cfg.Database.RetryAttempts,
		RetryDelay:        cfg.Database.RetryDelay,
	}, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	logger.WithContext(ctx).Info("Database connection established")

	// Initialize policy engine
	policyEngine, err := policy.NewPolicyEngine(policy.DefaultEngineConfig(), nil)
	if err != nil {
		if closeErr := db.Close(); closeErr != nil {
			logger.WithContext(ctx).WithError(closeErr).Error("failed to close DB after policy engine init failure")
		}
		return nil, nil, fmt.Errorf("failed to initialize policy engine: %w", err)
	}

	logger.WithContext(ctx).Info("Policy engine initialized")

	return db, policyEngine, nil
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
		if err := app.PolicyEngine.Shutdown(shutdownCtx); err != nil {
			app.Logger.WithContext(ctx).WithError(err).Error("Policy engine shutdown failed")
		} else {
			app.Logger.WithContext(ctx).Info("Policy engine shutdown completed")
		}
	}

	// Shutdown Redis client
	if app.Redis != nil {
		if err := app.Redis.Close(); err != nil {
			app.Logger.WithContext(ctx).WithError(err).Error("Redis shutdown failed")
		} else {
			app.Logger.WithContext(ctx).Info("Redis shutdown completed")
		}
	}

	// Drain async audit writer + close the parallel sql.DB.
	if app.Security != nil {
		app.Security.Close()
	}
	// Drain the spend tracker.
	if app.LLM != nil {
		app.LLM.Close()
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

func renderJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// Encode error after headers/status are sent is non-actionable for the
	// client; log via the default writer is unavailable here. Discard is safe.
	_ = json.NewEncoder(w).Encode(v)
}

func (app *Application) handleListServices(w http.ResponseWriter, r *http.Request) {
	services := app.ServiceRegistry.ListServices()

	response := map[string]interface{}{
		"services": services,
		"count":    len(services),
	}

	renderJSON(w, http.StatusOK, response)
}

func (app *Application) handleGetService(w http.ResponseWriter, r *http.Request) {
	serviceName := chi.URLParam(r, "service")

	instances, err := app.ServiceRegistry.GetServiceInstances(serviceName)
	if err != nil {
		renderJSON(w, http.StatusNotFound, map[string]interface{}{
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

	renderJSON(w, http.StatusOK, response)
}

func (app *Application) handleRegisterService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	serviceName := chi.URLParam(r, "service")

	var instance discovery.ServiceInstance
	if err := json.NewDecoder(r.Body).Decode(&instance); err != nil {
		renderJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
		return
	}

	instance.Name = serviceName

	if err := app.ServiceRegistry.RegisterService(ctx, &instance); err != nil {
		renderJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "REGISTRATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	renderJSON(w, http.StatusCreated, map[string]interface{}{
		"message":  "Service instance registered successfully",
		"instance": instance,
	})
}

func (app *Application) handleUnregisterService(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	serviceName := chi.URLParam(r, "service")
	instanceID := chi.URLParam(r, "instance")

	if err := app.ServiceRegistry.UnregisterService(ctx, serviceName, instanceID); err != nil {
		renderJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "SERVICE_NOT_FOUND",
				"message": err.Error(),
			},
		})
		return
	}

	renderJSON(w, http.StatusOK, map[string]interface{}{
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

	renderJSON(w, http.StatusOK, response)
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

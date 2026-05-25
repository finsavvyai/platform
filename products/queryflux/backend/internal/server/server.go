package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/config"
	"github.com/queryflux/backend/internal/container"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"github.com/queryflux/backend/internal/infrastructure/health"
	"github.com/queryflux/backend/internal/infrastructure/logger"
	"github.com/queryflux/backend/internal/infrastructure/metrics"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Server represents the HTTP server
type Server struct {
	config              *config.Config
	container           *container.Container
	router              *gin.Engine
	server              *http.Server
	wsHub               *Hub
	aiHandler           *AIHandler
	subscriptionHandler *SubscriptionHandlers
	logger              *logger.Logger
	metrics             *metrics.Metrics
	health              *health.Health

	// Phase-1 wiring: safe query runner + adapter factory replace the
	// legacy mock-data services for all live database execution paths.
	// See QUERY_CONTRACT.md §4 and SECURITY_REVIEW.md CRIT-1.
	queryRunner    *query.SafeQueryRunner
	adapterFactory adapterFactoryGetter
}

// NewServer creates a new HTTP server instance
func NewServer(cfg *config.Config, c *container.Container, log *logger.Logger, metrics *metrics.Metrics, health *health.Health) *Server {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	wsHub := NewHub(context.Background())

	// TODO(phase-2): swap InMemoryAuditLogger for a persistent backend
	// (postgres audit_log table) once the schema lands.
	auditLogger := query.NewInMemoryAuditLogger()

	// adapterFactory uses the canonical Factory (not EnhancedFactory) to
	// avoid cross-request connection caching at the HTTP boundary — every
	// HTTP request opens, uses, and closes its own adapter.
	factory := adapters.NewFactory(logrus.StandardLogger())

	server := &Server{
		config:         cfg,
		container:      c,
		router:         router,
		wsHub:          wsHub,
		logger:         log,
		metrics:        metrics,
		health:         health,
		queryRunner:    query.NewSafeQueryRunner(auditLogger),
		adapterFactory: factory,
	}

	aiHandler := NewAIHandler(c.GetAIService(), log.Logger)
	aiHandler.setServer(server)
	server.aiHandler = aiHandler

	server.subscriptionHandler = NewSubscriptionHandlers(
		c.GetSubscriptionService(),
		c.GetLemonSqueezyService(),
		cfg.LemonSqueezyWebhookSecret,
		log.Logger,
	)

	server.setupMiddleware()
	server.setupRoutes()

	server.server = &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return server
}

// Start starts the HTTP server
func (s *Server) Start() error {
	go s.wsHub.Run()
	logrus.Infof("Starting server on %s", s.server.Addr)
	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	logrus.Info("Shutting down server...")
	s.wsHub.Shutdown()
	return s.server.Shutdown(ctx)
}

// GetRouter returns the Gin router for testing purposes
func (s *Server) GetRouter() *gin.Engine {
	return s.router
}

// healthCheck handler
func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

// setupMiddleware configures middleware for the server
func (s *Server) setupMiddleware() {
	s.router.Use(gin.Recovery())
	s.router.Use(s.SecurityHeadersMiddleware())
	s.router.Use(s.RequestIDMiddleware())
	s.router.Use(s.RequestSizeLimitMiddleware())
	s.router.Use(s.InputValidationMiddleware())
	s.router.Use(s.SQLInjectionDetectionMiddleware())
	s.router.Use(s.XSSProtectionMiddleware())
	s.router.Use(s.CORSMiddleware())
	s.router.Use(s.LoggingMiddleware())
	s.router.Use(s.ErrorHandlingMiddleware())
	s.router.Use(s.RateLimitMiddleware())
}

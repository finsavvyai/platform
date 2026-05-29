package adapter

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/config"
	"github.com/queryflux/backend/pkg/logger"
)

type HTTPServer struct {
	Router            *gin.Engine
	server            *http.Server
	queryService      *service.QueryService
	schemaService     *service.SchemaService
	authService       *service.AuthService
	authMiddleware    *AuthMiddleware
	connectionHandler *ConnectionHandler
	databaseHandler   *DatabaseHandler
	savedQueryHandler *SavedQueryHandler
	logger            *logger.Logger
	cfg               *config.Config
}

func NewHTTPServer(
	cfg *config.Config,
	queryService *service.QueryService,
	schemaService *service.SchemaService,
	authService *service.AuthService,
	authMiddleware *AuthMiddleware,
	log *logger.Logger,
	opts ...HTTPServerOption,
) *HTTPServer {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())

	s := &HTTPServer{
		Router:         router,
		queryService:   queryService,
		schemaService:  schemaService,
		authService:    authService,
		authMiddleware: authMiddleware,
		logger:         log,
		cfg:            cfg,
	}

	for _, opt := range opts {
		opt(s)
	}

	s.setupRoutes()

	s.server = &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      s.Router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	return s
}

type HTTPServerOption func(*HTTPServer)

func WithConnectionHandler(h *ConnectionHandler) HTTPServerOption {
	return func(s *HTTPServer) { s.connectionHandler = h }
}

func WithDatabaseHandler(h *DatabaseHandler) HTTPServerOption {
	return func(s *HTTPServer) { s.databaseHandler = h }
}

func WithSavedQueryHandler(h *SavedQueryHandler) HTTPServerOption {
	return func(s *HTTPServer) { s.savedQueryHandler = h }
}

func (s *HTTPServer) setupRoutes() {
	s.Router.Use(RequestIDMiddleware())
	s.Router.Use(CORSMiddleware(s.cfg.AllowedOrigins))
	s.Router.Use(RequestLoggingMiddleware(s.logger))

	s.Router.GET("/health", s.healthCheck)

	loginLimiter := NewRateLimiter(5, time.Minute)
	refreshLimiter := NewRateLimiter(10, time.Minute)

	auth := s.Router.Group("/auth")
	{
		auth.POST("/login", RateLimitMiddleware(loginLimiter), s.login)
		auth.POST("/refresh", RateLimitMiddleware(refreshLimiter), s.refreshToken)
	}

	v1 := s.Router.Group("/api/v1")
	v1.Use(s.authMiddleware.Authenticate())
	{
		v1.POST("/query/execute", s.executeQuery)
		v1.POST("/schema", s.getSchema)
	}

	v1.GET("/metrics", s.queryMetrics)

	if s.connectionHandler != nil {
		s.connectionHandler.RegisterRoutes(v1)
	}

	if s.databaseHandler != nil {
		s.databaseHandler.RegisterRoutes(v1)
	}

	if s.savedQueryHandler != nil {
		s.savedQueryHandler.RegisterRoutes(v1)
	}
}

func (s *HTTPServer) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, domain.SuccessResponse(gin.H{
		"status": "healthy",
		"time":   time.Now().Unix(),
	}))
}

func (s *HTTPServer) Start() error {
	return s.server.ListenAndServe()
}

func (s *HTTPServer) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}

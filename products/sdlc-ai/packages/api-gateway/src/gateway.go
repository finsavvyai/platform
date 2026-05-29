package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/urfave/negroni"
)

// API Gateway provides unified access to all SDLC.ai services
// with service discovery, load balancing, and API versioning
type APIGateway struct {
	config           *GatewayConfig
	router           *mux.Router
	middleware       *negroni.Negroni
	serviceRegistry  ServiceRegistry
	rateLimiter      RateLimiter
	authProvider     AuthProvider
	circuitBreaker   CircuitBreaker
	metricsCollector MetricsCollector
	logger           Logger
}

// GatewayConfig holds gateway configuration
type GatewayConfig struct {
	ListenPort     int              `json:"listen_port"`
	BasePath       string           `json:"base_path"`
	Timeout        time.Duration    `json:"timeout"`
	RateLimit      RateLimitConfig  `json:"rate_limit"`
	CORS           CORSConfig       `json:"cors"`
	Services       []ServiceConfig  `json:"services"`
	Versioning     VersioningConfig `json:"versioning"`
	Authentication AuthConfig       `json:"authentication"`
	Monitoring     MonitoringConfig `json:"monitoring"`
}

type RateLimitConfig struct {
	RequestsPerMinute int      `json:"requests_per_minute"`
	BurstSize         int      `json:"burst_size"`
	ByUser            bool     `json:"by_user"`
	ByAPI             bool     `json:"by_api"`
	Whitelist         []string `json:"whitelist"`
}

type CORSConfig struct {
	AllowedOrigins []string `json:"allowed_origins"`
	AllowedMethods []string `json:"allowed_methods"`
	AllowedHeaders []string `json:"allowed_headers"`
	MaxAge         int      `json:"max_age"`
	Credentials    bool     `json:"credentials"`
}

type ServiceConfig struct {
	Name           string            `json:"name"`
	BaseURL        string            `json:"base_url"`
	Version        string            `json:"version"`
	HealthCheck    string            `json:"health_check"`
	Timeout        time.Duration     `json:"timeout"`
	Retries        int               `json:"retries"`
	CircuitBreaker CircuitConfig     `json:"circuit_breaker"`
	Authentication bool              `json:"authentication"`
	Authorization  bool              `json:"authorization"`
	RateLimiting   bool              `json:"rate_limiting"`
	Metrics        bool              `json:"metrics"`
	Transforms     []TransformConfig `json:"transforms"`
}

type CircuitConfig struct {
	Threshold    int           `json:"threshold"`
	Timeout      time.Duration `json:"timeout"`
	MaxRetries   int           `json:"max_retries"`
	ResetTimeout time.Duration `json:"reset_timeout"`
}

type TransformConfig struct {
	Request  Transform `json:"request"`
	Response Transform `json:"response"`
}

type Transform struct {
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body"`
	Template string            `json:"template"`
}

type VersioningConfig struct {
	DefaultVersion    string   `json:"default_version"`
	SupportedVersions []string `json:"supported_versions"`
	VersionHeader     string   `json:"version_header"`
	URLStrategy       string   `json:"url_strategy"` // header, path, query
}

type AuthConfig struct {
	Enabled        bool                 `json:"enabled"`
	Type           string               `json:"type"` // jwt, oauth2, saml, basic
	Providers      []AuthProviderConfig `json:"providers"`
	DefaultRoles   []string             `json:"default_roles"`
	AnonymousPaths []string             `json:"anonymous_paths"`
}

type AuthProviderConfig struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

type MonitoringConfig struct {
	Enabled     bool   `json:"enabled"`
	MetricsPath string `json:"metrics_path"`
	HealthPath  string `json:"health_path"`
	LogLevel    string `json:"log_level"`
	Tracing     bool   `json:"tracing"`
}

// ServiceRegistry manages service discovery
type ServiceRegistry interface {
	Register(service *ServiceInfo) error
	Discover(serviceName string) ([]*ServiceInstance, error)
	HealthCheck(serviceName string) error
	Watch(serviceName string) (<-chan []*ServiceInstance, error)
}

type ServiceInfo struct {
	Name      string             `json:"name"`
	Version   string             `json:"version"`
	Instances []*ServiceInstance `json:"instances"`
}

type ServiceInstance struct {
	ID       string                 `json:"id"`
	Address  string                 `json:"address"`
	Port     int                    `json:"port"`
	Tags     map[string]string      `json:"tags"`
	Metadata map[string]interface{} `json:"metadata"`
	Healthy  bool                   `json:"healthy"`
	LastSeen time.Time              `json:"last_seen"`
}

// RateLimiter handles rate limiting
type RateLimiter interface {
	Allow(key string, tokens int) bool
	GetLimit(key string) (int, time.Duration)
	SetLimit(key string, tokens int, window time.Duration) error
}

// AuthProvider handles authentication
type AuthProvider interface {
	Authenticate(req *http.Request) (*AuthContext, error)
	Authorize(ctx *AuthContext, resource, action string) bool
	GetUser(userID string) (*UserInfo, error)
}

type AuthContext struct {
	UserID      string                 `json:"user_id"`
	TenantID    string                 `json:"tenant_id"`
	Roles       []string               `json:"roles"`
	Permissions []string               `json:"permissions"`
	Metadata    map[string]interface{} `json:"metadata"`
	Token       string                 `json:"token"`
	ExpiresAt   time.Time              `json:"expires_at"`
}

type UserInfo struct {
	ID       string                 `json:"id"`
	Email    string                 `json:"email"`
	Name     string                 `json:"name"`
	TenantID string                 `json:"tenant_id"`
	Roles    []string               `json:"roles"`
	Metadata map[string]interface{} `json:"metadata"`
}

// CircuitBreaker implements circuit breaker pattern
type CircuitBreaker interface {
	Call(ctx context.Context, service string, fn func() (*http.Response, error)) (*http.Response, error)
	State(service string) CircuitState
	GetStats(service string) *CircuitStats
}

type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

type CircuitStats struct {
	Requests        int64         `json:"requests"`
	Successes       int64         `json:"successes"`
	Failures        int64         `json:"failures"`
	Timeouts        int64         `json:"timeouts"`
	AverageResponse time.Duration `json:"average_response"`
	LastError       time.Time     `json:"last_error"`
}

// MetricsCollector collects gateway metrics
type MetricsCollector interface {
	IncrementCounter(name string, labels map[string]string)
	RecordHistogram(name string, value float64, labels map[string]string)
	SetGauge(name string, value float64, labels map[string]string)
	RecordEvent(event string, data map[string]interface{})
}

// Logger interface for structured logging
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
}

// NewAPIGateway creates a new API Gateway instance
func NewAPIGateway(config *GatewayConfig) *APIGateway {
	gateway := &APIGateway{
		config: config,
		router: mux.NewRouter(),
		logger: NewDefaultLogger(),
	}

	// Initialize components
	gateway.initializeMiddleware()
	gateway.initializeRoutes()
	gateway.initializeServiceRegistry()
	gateway.initializeRateLimiter()
	gateway.initializeAuthProvider()
	gateway.initializeCircuitBreaker()
	gateway.initializeMetrics()

	return gateway
}

// initializeMiddleware sets up all middleware
func (g *APIGateway) initializeMiddleware() {
	g.middleware = negroni.New()

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   g.config.CORS.AllowedOrigins,
		AllowedMethods:   g.config.CORS.AllowedMethods,
		AllowedHeaders:   g.config.CORS.AllowedHeaders,
		MaxAge:           g.config.CORS.MaxAge,
		AllowCredentials: g.config.CORS.Credentials,
	})
	g.middleware.Use(c)

	// Request ID middleware
	g.middleware.Use(g.requestIDMiddleware())

	// Logging middleware
	g.middleware.Use(g.loggingMiddleware())

	// Metrics middleware
	if g.config.Monitoring.Enabled {
		g.middleware.Use(g.metricsMiddleware())
	}

	// Rate limiting middleware
	g.middleware.Use(g.rateLimitingMiddleware())

	// Authentication middleware
	if g.config.Authentication.Enabled {
		g.middleware.Use(g.authenticationMiddleware())
	}

	// Add router
	g.middleware.UseHandler(g.router)
}

// initializeRoutes sets up all gateway routes
func (g *APIGateway) initializeRoutes() {
	// Health check endpoint
	g.router.HandleFunc("/health", g.healthCheckHandler).Methods("GET")
	g.router.HandleFunc("/health/{service}", g.serviceHealthCheckHandler).Methods("GET")

	// Metrics endpoint
	if g.config.Monitoring.Enabled {
		g.router.Handle(g.config.Monitoring.MetricsPath, g.metricsHandler()).Methods("GET")
	}

	// API version routing
	for _, version := range g.config.Versioning.SupportedVersions {
		versionRouter := g.router.PathPrefix(fmt.Sprintf("/api/%s", version)).Subrouter()
		g.setupServiceRoutes(versionRouter, version)
	}

	// Default version routing
	defaultRouter := g.router.PathPrefix("/api").Subrouter()
	g.setupServiceRoutes(defaultRouter, g.config.Versioning.DefaultVersion)

	// GraphQL endpoint
	g.router.HandleFunc("/graphql", g.graphQLHandler()).Methods("POST", "GET")
	g.router.HandleFunc("/graphql/schema", g.graphQLSchemaHandler()).Methods("GET")

	// Webhook endpoint
	g.router.HandleFunc("/webhooks/{provider}", g.webhookHandler()).Methods("POST")

	// Documentation endpoints
	g.router.HandleFunc("/docs", g.documentationHandler()).Methods("GET")
	g.router.HandleFunc("/docs/{service}", g.serviceDocumentationHandler()).Methods("GET")
	g.router.HandleFunc("/openapi.json", g.openAPIHandler()).Methods("GET")
}

// setupServiceRoutes creates routes for each service
func (g *APIGateway) setupServiceRoutes(router *mux.Router, version string) {
	for _, service := range g.config.Services {
		// Only route services that support this version
		if service.Version != version && service.Version != "*" {
			continue
		}

		// Create service-specific router
		serviceRouter := router.PathPrefix(fmt.Sprintf("/%s", service.Name)).Subrouter()

		// Service-specific middleware
		serviceHandler := g.serviceMiddleware(service, serviceRouter)

		// Proxy all requests to the service
		serviceHandler.PathPrefix("").HandlerFunc(g.serviceProxyHandler(service))
	}
}

// initializeServiceRegistry sets up service discovery
func (g *APIGateway) initializeServiceRegistry() {
	// This would integrate with your service discovery system
	// Could be Consul, etcd, Kubernetes, or a custom implementation
	g.serviceRegistry = NewInMemoryServiceRegistry()
}

// initializeRateLimiter sets up rate limiting
func (g *APIGateway) initializeRateLimiter() {
	g.rateLimiter = NewInMemoryRateLimiter()
}

// initializeAuthProvider sets up authentication
func (g *APIGateway) initializeAuthProvider() {
	if g.config.Authentication.Enabled {
		g.authProvider = NewJWTAuthProvider(g.config.Authentication)
	}
}

// initializeCircuitBreaker sets up circuit breaker
func (g *APIGateway) initializeCircuitBreaker() {
	g.circuitBreaker = NewMemoryCircuitBreaker()
}

// initializeMetrics sets up metrics collection
func (g *APIGateway) initializeMetrics() {
	if g.config.Monitoring.Enabled {
		g.metricsCollector = NewPrometheusMetricsCollector()
	}
}

// Start starts the API Gateway
func (g *APIGateway) Start() error {
	addr := fmt.Sprintf(":%d", g.config.ListenPort)
	g.logger.Info("Starting API Gateway", "address", addr, "version", g.config.Versioning.DefaultVersion)

	server := &http.Server{
		Addr:         addr,
		Handler:      g.middleware,
		ReadTimeout:  g.config.Timeout,
		WriteTimeout: g.config.Timeout,
		IdleTimeout:  120 * time.Second,
	}

	return server.ListenAndServe()
}

// Middleware implementations

func (g *APIGateway) requestIDMiddleware() negroni.Handler {
	return negroni.HandlerFunc(func(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		w.Header().Set("X-Request-ID", requestID)
		ctx := context.WithValue(r.Context(), "requestID", requestID)
		next(w, r.WithContext(ctx))
	})
}

func (g *APIGateway) loggingMiddleware() negroni.Handler {
	return negroni.HandlerFunc(func(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
		start := time.Now()

		// Create response writer to capture status code
		writer := &responseWriter{ResponseWriter: w}

		g.logger.Info("Request started",
			"method", r.Method,
			"path", r.URL.Path,
			"query", r.URL.RawQuery,
			"user_agent", r.UserAgent(),
			"remote_addr", r.RemoteAddr,
		)

		next(writer, r)

		duration := time.Since(start)
		g.logger.Info("Request completed",
			"method", r.Method,
			"path", r.URL.Path,
			"status", writer.status,
			"duration_ms", duration.Milliseconds(),
		)
	})
}

func (g *APIGateway) metricsMiddleware() negroni.Handler {
	return negroni.HandlerFunc(func(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
		start := time.Now()

		// Create response writer to capture status code
		writer := &responseWriter{ResponseWriter: w}

		next(writer, r)

		duration := time.Since(start)

		labels := map[string]string{
			"method": r.Method,
			"path":   r.URL.Path,
			"status": fmt.Sprintf("%d", writer.status),
		}

		g.metricsCollector.RecordHistogram("http_request_duration", float64(duration.Nanoseconds())/1e6, labels)
		g.metricsCollector.IncrementCounter("http_requests_total", labels)
	})
}

func (g *APIGateway) rateLimitingMiddleware() negroni.Handler {
	return negroni.HandlerFunc(func(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
		// Skip rate limiting for health checks and metrics
		if g.isAnonymousPath(r.URL.Path) {
			next(w, r)
			return
		}

		// Get rate limit key
		key := g.getRateLimitKey(r)

		// Check rate limit
		if !g.rateLimiter.Allow(key, 1) {
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", g.config.RateLimit.RequestsPerMinute))
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(time.Minute).Unix()))

			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next(w, r)
	})
}

func (g *APIGateway) authenticationMiddleware() negroni.Handler {
	return negroni.HandlerFunc(func(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
		// Skip authentication for anonymous paths
		if g.isAnonymousPath(r.URL.Path) {
			next(w, r)
			return
		}

		// Authenticate request
		authCtx, err := g.authProvider.Authenticate(r)
		if err != nil {
			g.logger.Warn("Authentication failed", "error", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Add auth context to request
		ctx := context.WithValue(r.Context(), "auth", authCtx)
		next(w, r.WithContext(ctx))
	})
}

// Handler implementations

func (g *APIGateway) healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"version":   g.config.Versioning.DefaultVersion,
		"gateway":   "sdlc-api-gateway",
	}

	// Check service health
	services := make(map[string]string)
	for _, service := range g.config.Services {
		if err := g.serviceRegistry.HealthCheck(service.Name); err != nil {
			services[service.Name] = "unhealthy"
		} else {
			services[service.Name] = "healthy"
		}
	}
	health["services"] = services

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func (g *APIGateway) serviceProxyHandler(service ServiceConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Discover service instances
		instances, err := g.serviceRegistry.Discover(service.Name)
		if err != nil || len(instances) == 0 {
			g.logger.Error("Service discovery failed", "service", service.Name, "error", err)
			http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Select healthy instance (simple round-robin)
		instance := g.selectInstance(instances)
		if instance == nil {
			http.Error(w, "No healthy instances available", http.StatusServiceUnavailable)
			return
		}

		// Build target URL
		targetURL := fmt.Sprintf("http://%s:%d%s", instance.Address, instance.Port, r.URL.Path)
		if r.URL.RawQuery != "" {
			targetURL += "?" + r.URL.RawQuery
		}

		// Proxy request with circuit breaker
		g.circuitBreaker.Call(r.Context(), service.Name, func() (*http.Response, error) {
			return g.proxyRequest(w, r, targetURL, service)
		})
	}
}

// Helper functions

func (g *APIGateway) isAnonymousPath(path string) bool {
	for _, anonymousPath := range g.config.Authentication.AnonymousPaths {
		if strings.HasPrefix(path, anonymousPath) {
			return true
		}
	}
	return false
}

func (g *APIGateway) getRateLimitKey(r *http.Request) string {
	if g.config.RateLimit.ByUser {
		// Try to get user ID from auth context
		if authCtx, ok := r.Context().Value("auth").(*AuthContext); ok {
			return fmt.Sprintf("user:%s", authCtx.UserID)
		}
	}

	if g.config.RateLimit.ByAPI {
		return fmt.Sprintf("api:%s:%s", r.Method, r.URL.Path)
	}

	return fmt.Sprintf("ip:%s", getClientIP(r))
}

func (g *APIGateway) selectInstance(instances []*ServiceInstance) *ServiceInstance {
	// Simple round-robin selection
	// In production, you'd want more sophisticated load balancing
	for _, instance := range instances {
		if instance.Healthy {
			return instance
		}
	}
	return nil
}

// responseWriter captures HTTP status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Utility functions

func generateRequestID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.Split(xff, ",")[0]
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return strings.Split(r.RemoteAddr, ":")[0]
}

// Main function
func main() {
	config := &GatewayConfig{
		ListenPort: 8080,
		BasePath:   "/api",
		Timeout:    30 * time.Second,
		CORS: CORSConfig{
			AllowedOrigins: []string{"*"},
			AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders: []string{"*"},
			MaxAge:         86400,
			Credentials:    false,
		},
		Authentication: AuthConfig{
			Enabled:        true,
			Type:           "jwt",
			AnonymousPaths: []string{"/health", "/metrics", "/docs"},
		},
		Versioning: VersioningConfig{
			DefaultVersion:    "v1",
			SupportedVersions: []string{"v1", "v2"},
			URLStrategy:       "path",
		},
		Monitoring: MonitoringConfig{
			Enabled:     true,
			MetricsPath: "/metrics",
			HealthPath:  "/health",
			LogLevel:    "info",
			Tracing:     true,
		},
	}

	gateway := NewAPIGateway(config)
	log.Fatal(gateway.Start())
}

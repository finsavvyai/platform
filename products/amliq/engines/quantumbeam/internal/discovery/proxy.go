package discovery

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ReverseProxy handles reverse proxy functionality with service discovery
type ReverseProxy struct {
	loadBalancer *LoadBalancer
	logger       *zap.Logger
	config       *ProxyConfig
}

// ProxyConfig holds proxy configuration
type ProxyConfig struct {
	Enabled                 bool          `yaml:"enabled" json:"enabled"`
	ListenAddress           string        `yaml:"listen_address" json:"listen_address"`
	Port                    int           `yaml:"port" json:"port"`
	Timeout                 time.Duration `yaml:"timeout" json:"timeout"`
	IdleTimeout             time.Duration `yaml:"idle_timeout" json:"idle_timeout"`
	ReadHeaderTimeout       time.Duration `yaml:"read_header_timeout" json:"read_header_timeout"`
	WriteTimeout            time.Duration `yaml:"write_timeout" json:"write_header_timeout"`
	MaxHeaderBytes          int           `yaml:"max_header_bytes" json:"max_header_bytes"`
	EnableWebsockets        bool          `yaml:"enable_websockets" json:"enable_websockets"`
	EnableCompression       bool          `yaml:"enable_compression" json:"enable_compression"`
	EnableCORS              bool          `yaml:"enable_cors" json:"enable_cors"`
	RetryAttempts           int           `yaml:"retry_attempts" json:"retry_attempts"`
	RetryDelay              time.Duration `yaml:"retry_delay" json:"retry_delay"`
	CircuitBreakerThreshold int           `yaml:"circuit_breaker_threshold" json:"circuit_breaker_threshold"`
	CircuitBreakerTimeout   time.Duration `yaml:"circuit_breaker_timeout" json:"circuit_breaker_timeout"`
	HealthCheckInterval     time.Duration `yaml:"health_check_interval" json:"health_check_interval"`
	MetricsEnabled          bool          `yaml:"metrics_enabled" json:"metrics_enabled"`
	AccessLogEnabled        bool          `yaml:"access_log_enabled" json:"access_log_enabled"`
	ErrorLogEnabled         bool          `yaml:"error_log_enabled" json:"error_log_enabled"`
}

// RouteConfig holds route configuration
type RouteConfig struct {
	Path         string            `yaml:"path" json:"path"`
	ServiceName  string            `yaml:"service_name" json:"service_name"`
	StripPrefix  bool              `yaml:"strip_prefix" json:"strip_prefix"`
	Methods      []string          `yaml:"methods" json:"methods"`
	Headers      map[string]string `yaml:"headers" yaml:"headers"`
	RewritePath  string            `yaml:"rewrite_path" json:"rewrite_path"`
	Timeout      time.Duration     `yaml:"timeout" json:"timeout"`
	Retries      int               `yaml:"retries" json:"retries"`
	AuthRequired bool              `yaml:"auth_required" json:"auth_required"`
	RateLimit    int               `yaml:"rate_limit" json:"rate_limit"`
}

// CircuitBreaker implements circuit breaker pattern
type CircuitBreaker struct {
	serviceID    string
	maxFailures  int
	resetTimeout time.Duration
	state        CircuitState
	failures     int
	lastFailure  time.Time
	mu           sync.Mutex
}

// CircuitState represents circuit breaker state
type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

// ProxyMetrics holds proxy metrics
type ProxyMetrics struct {
	TotalRequests      int64                      `json:"total_requests"`
	SuccessfulRequests int64                      `json:"successful_requests"`
	FailedRequests     int64                      `json:"failed_requests"`
	AverageLatency     time.Duration              `json:"average_latency"`
	P95Latency         time.Duration              `json:"p95_latency"`
	P99Latency         time.Duration              `json:"p99_latency"`
	ActiveConnections  int64                      `json:"active_connections"`
	CircuitBreakers    map[string]*CircuitBreaker `json:"circuit_breakers"`
	ServiceMetrics     map[string]*ServiceMetrics `json:"service_metrics"`
}

// ServiceMetrics holds service-specific metrics
type ServiceMetrics struct {
	ServiceID          string        `json:"service_id"`
	TotalRequests      int64         `json:"total_requests"`
	SuccessfulRequests int64         `json:"successful_requests"`
	FailedRequests     int64         `json:"failed_requests"`
	AverageLatency     time.Duration `json:"average_latency"`
	LastAccess         time.Time     `json:"last_access"`
	IsHealthy          bool          `json:"is_healthy"`
	CircuitState       string        `json:"circuit_state"`
}

// Default proxy configuration
var (
	DefaultProxyConfig = ProxyConfig{
		Enabled:                 true,
		ListenAddress:           "0.0.0.0",
		Port:                    8080,
		Timeout:                 30 * time.Second,
		IdleTimeout:             120 * time.Second,
		ReadHeaderTimeout:       10 * time.Second,
		WriteTimeout:            10 * time.Second,
		MaxHeaderBytes:          1 << 20, // 1MB
		EnableWebsockets:        false,
		EnableCompression:       true,
		EnableCORS:              true,
		RetryAttempts:           3,
		RetryDelay:              1 * time.Second,
		CircuitBreakerThreshold: 5,
		CircuitBreakerTimeout:   30 * time.Second,
		HealthCheckInterval:     15 * time.Second,
		MetricsEnabled:          true,
		AccessLogEnabled:        true,
		ErrorLogEnabled:         true,
	}
)

// NewReverseProxy creates a new reverse proxy
func NewReverseProxy(loadBalancer *LoadBalancer, logger *zap.Logger, config *ProxyConfig) *ReverseProxy {
	if config == nil {
		config = &DefaultProxyConfig
	}

	return &ReverseProxy{
		loadBalancer: loadBalancer,
		logger:       logger,
		config:       config,
	}
}

// Start starts the reverse proxy server
func (rp *ReverseProxy) Start(ctx context.Context, routes []RouteConfig) error {
	if !rp.config.Enabled {
		rp.logger.Info("Reverse proxy is disabled")
		return nil
	}

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// Add middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(rp.requestIDMiddleware())
	router.Use(rp.metricsMiddleware())

	if rp.config.EnableCORS {
		router.Use(rp.corsMiddleware())
	}

	// Add routes
	for _, route := range routes {
		rp.addRoute(router, route)
	}

	// Add admin routes
	rp.addAdminRoutes(router)

	// Add metrics endpoint
	if rp.config.MetricsEnabled {
		rp.addMetricsEndpoint(router)
	}

	// Start health checker
	go rp.healthChecker(ctx)

	// Start server
	address := fmt.Sprintf("%s:%d", rp.config.ListenAddress, rp.config.Port)
	rp.logger.Info("Starting reverse proxy",
		zap.String("address", address),
		zap.Int("routes", len(routes)))

	server := &http.Server{
		Addr:              address,
		Handler:           router,
		ReadTimeout:       rp.config.ReadHeaderTimeout,
		WriteTimeout:      rp.config.WriteTimeout,
		IdleTimeout:       rp.config.IdleTimeout,
		ReadHeaderTimeout: rp.config.ReadHeaderTimeout,
		MaxHeaderBytes:    rp.config.MaxHeaderBytes,
	}

	return server.ListenAndServe()
}

// addRoute adds a route to the router
func (rp *ReverseProxy) addRoute(router *gin.Engine, route RouteConfig) {
	handler := rp.createProxyHandler(route)

	// Apply method restrictions
	if len(route.Methods) > 0 {
		for _, method := range route.Methods {
			router.Handle(method, route.Path, handler)
		}
	} else {
		router.Any(route.Path, handler)
	}
}

// createProxyHandler creates a proxy handler for a route
func (rp *ReverseProxy) createProxyHandler(route RouteConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Build request context
		requestContext := &RequestContext{
			RequestID: c.GetHeader("X-Request-ID"),
			Method:    c.Request.Method,
			Path:      c.Request.URL.Path,
			Headers:   make(map[string]string),
			IP:        c.ClientIP(),
			UserAgent: c.GetHeader("User-Agent"),
			SessionID: rp.extractSessionID(c),
		}

		// Copy headers
		for key, values := range c.Request.Header {
			if len(values) > 0 {
				requestContext.Headers[key] = values[0]
			}
		}

		// Select service
		service, err := rp.loadBalancer.SelectService(c.Request.Context(), route.ServiceName, requestContext)
		if err != nil {
			rp.handleError(c, err, 503, "Service Unavailable")
			return
		}

		// Check circuit breaker
		if !rp.checkCircuitBreaker(service.ID) {
			rp.handleError(c, fmt.Errorf("circuit breaker open for service %s", service.ID), 503, "Service Unavailable")
			return
		}

		// Create target URL
		target, err := url.Parse(fmt.Sprintf("%s://%s:%d", service.Scheme, service.Host, service.Port))
		if err != nil {
			rp.handleError(c, err, 500, "Internal Server Error")
			return
		}

		// Create reverse proxy
		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.ErrorHandler = rp.proxyErrorHandler

		// Modify request if needed
		if route.StripPrefix {
			c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, route.Path)
			if !strings.HasPrefix(c.Request.URL.Path, "/") {
				c.Request.URL.Path = "/" + c.Request.URL.Path
			}
		}

		if route.RewritePath != "" {
			c.Request.URL.Path = route.RewritePath
		}

		// Set custom headers
		for key, value := range route.Headers {
			c.Request.Header.Set(key, value)
		}

		// Add service headers
		c.Request.Header.Set("X-Forwarded-For", c.ClientIP())
		c.Request.Header.Set("X-Forwarded-Proto", c.Request.URL.Scheme)
		c.Request.Header.Set("X-Forwarded-Host", c.Request.Host)
		c.Request.Header.Set("X-Service-ID", service.ID)

		// Proxy request
		proxy.ServeHTTP(c.Writer, c.Request)

		// Update metrics
		duration := time.Since(start)
		rp.updateMetrics(service.ID, duration, c.Writer.Status() < 400)

		// Release connection if using least connections
		rp.loadBalancer.ReleaseConnection(service.ID)
	}
}

// proxyErrorHandler handles proxy errors
func (rp *ReverseProxy) proxyErrorHandler(rw http.ResponseWriter, r *http.Request, err error) {
	rp.logger.Error("Proxy error",
		zap.Error(err),
		zap.String("url", r.URL.String()),
		zap.String("method", r.Method))

	rw.WriteHeader(http.StatusBadGateway)
	rw.Write([]byte("Bad Gateway"))
}

// handleError handles errors and returns appropriate response
func (rp *ReverseProxy) handleError(c *gin.Context, err error, statusCode int, message string) {
	rp.logger.Error("Request error",
		zap.Error(err),
		zap.Int("status_code", statusCode),
		zap.String("path", c.Request.URL.Path),
		zap.String("method", c.Request.Method))

	c.JSON(statusCode, gin.H{
		"error":   message,
		"code":    fmt.Sprintf("ERR_%d", statusCode),
		"message": err.Error(),
	})
}

// requestIDMiddleware adds request ID to requests
func (rp *ReverseProxy) requestIDMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	})
}

// metricsMiddleware adds metrics collection
func (rp *ReverseProxy) metricsMiddleware() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		// Log request if enabled
		if rp.config.AccessLogEnabled {
			rp.logger.Info("Request completed",
				zap.String("method", c.Request.Method),
				zap.String("path", c.Request.URL.Path),
				zap.Int("status", c.Writer.Status()),
				zap.Duration("duration", duration),
				zap.String("client_ip", c.ClientIP()),
				zap.String("user_agent", c.GetHeader("User-Agent")))
		}
	})
}

// corsMiddleware adds CORS support
func (rp *ReverseProxy) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// addAdminRoutes adds admin routes to the router
func (rp *ReverseProxy) addAdminRoutes(router *gin.Engine) {
	admin := router.Group("/admin")
	{
		admin.GET("/health", rp.healthHandler)
		admin.GET("/services", rp.servicesHandler)
		admin.GET("/metrics", rp.metricsHandler)
		admin.GET("/circuit-breakers", rp.circuitBreakersHandler)
		admin.POST("/circuit-breakers/:serviceID/reset", rp.resetCircuitBreakerHandler)
	}
}

// healthHandler returns proxy health status
func (rp *ReverseProxy) healthHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0",
	})
}

// servicesHandler returns list of services
func (rp *ReverseProxy) servicesHandler(c *gin.Context) {
	services, err := rp.loadBalancer.registry.GetAllServices(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"services": services,
		"total":    len(services),
	})
}

// metricsHandler returns proxy metrics
func (rp *ReverseProxy) metricsHandler(c *gin.Context) {
	metrics := rp.getMetrics()
	c.JSON(200, metrics)
}

// circuitBreakersHandler returns circuit breaker status
func (rp *ReverseProxy) circuitBreakersHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"circuit_breakers": rp.getCircuitBreakers(),
	})
}

// resetCircuitBreakerHandler resets a circuit breaker
func (rp *ReverseProxy) resetCircuitBreakerHandler(c *gin.Context) {
	serviceID := c.Param("serviceID")
	rp.resetCircuitBreaker(serviceID)
	c.JSON(200, gin.H{"message": "Circuit breaker reset"})
}

// addMetricsEndpoint adds metrics endpoint
func (rp *ReverseProxy) addMetricsEndpoint(router *gin.Engine) {
	router.GET("/metrics", rp.prometheusMetricsHandler)
}

// prometheusMetricsHandler returns metrics in Prometheus format
func (rp *ReverseProxy) prometheusMetricsHandler(c *gin.Context) {
	metrics := rp.getMetrics()

	// Convert to Prometheus format
	var lines []string
	lines = append(lines, "# HELP quantumbeam_proxy_requests_total Total number of requests")
	lines = append(lines, "# TYPE quantumbeam_proxy_requests_total counter")
	lines = append(lines, fmt.Sprintf("quantumbeam_proxy_requests_total %d", metrics.TotalRequests))

	lines = append(lines, "# HELP quantumbeam_proxy_requests_successful_total Total number of successful requests")
	lines = append(lines, "# TYPE quantumbeam_proxy_requests_successful_total counter")
	lines = append(lines, fmt.Sprintf("quantumbeam_proxy_requests_successful_total %d", metrics.SuccessfulRequests))

	lines = append(lines, "# HELP quantumbeam_proxy_requests_failed_total Total number of failed requests")
	lines = append(lines, "# TYPE quantumbeam_proxy_requests_failed_total counter")
	lines = append(lines, fmt.Sprintf("quantumbeam_proxy_requests_failed_total %d", metrics.FailedRequests))

	lines = append(lines, "# HELP quantumbeam_proxy_latency_seconds Average request latency")
	lines = append(lines, "# TYPE quantumbeam_proxy_latency_seconds gauge")
	lines = append(lines, fmt.Sprintf("quantumbeam_proxy_latency_seconds %.3f", metrics.AverageLatency.Seconds()))

	c.Header("Content-Type", "text/plain")
	c.String(200, strings.Join(lines, "\n"))
}

// checkCircuitBreaker checks if circuit breaker allows request
func (rp *ReverseProxy) checkCircuitBreaker(serviceID string) bool {
	cb := rp.getCircuitBreaker(serviceID)
	return cb.AllowRequest()
}

// getCircuitBreaker gets or creates circuit breaker for service
func (rp *ReverseProxy) getCircuitBreaker(serviceID string) *CircuitBreaker {
	// This would be implemented with proper circuit breaker logic
	return &CircuitBreaker{
		serviceID:    serviceID,
		maxFailures:  rp.config.CircuitBreakerThreshold,
		resetTimeout: rp.config.CircuitBreakerTimeout,
		state:        CircuitClosed,
	}
}

// resetCircuitBreaker resets circuit breaker for service
func (rp *ReverseProxy) resetCircuitBreaker(serviceID string) {
	cb := rp.getCircuitBreaker(serviceID)
	cb.Reset()
}

// updateMetrics updates proxy metrics
func (rp *ReverseProxy) updateMetrics(serviceID string, duration time.Duration, success bool) {
	// This would be implemented with proper metrics collection
}

// getMetrics returns current proxy metrics
func (rp *ReverseProxy) getMetrics() *ProxyMetrics {
	return &ProxyMetrics{
		TotalRequests:      0,
		SuccessfulRequests: 0,
		FailedRequests:     0,
		AverageLatency:     0,
		P95Latency:         0,
		P99Latency:         0,
		ActiveConnections:  0,
		CircuitBreakers:    make(map[string]*CircuitBreaker),
		ServiceMetrics:     make(map[string]*ServiceMetrics),
	}
}

// getCircuitBreakers returns all circuit breakers
func (rp *ReverseProxy) getCircuitBreakers() map[string]*CircuitBreaker {
	return make(map[string]*CircuitBreaker)
}

// healthChecker runs periodic health checks
func (rp *ReverseProxy) healthChecker(ctx context.Context) {
	ticker := time.NewTicker(rp.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rp.performHealthCheck(ctx)
		}
	}
}

// performHealthCheck performs health checks
func (rp *ReverseProxy) performHealthCheck(ctx context.Context) {
	// This would implement health check logic
}

// extractSessionID extracts session ID from request
func (rp *ReverseProxy) extractSessionID(c *gin.Context) string {
	// Try to get from cookie
	cookie, err := c.Cookie("session_id")
	if err == nil && cookie != "" {
		return cookie
	}

	// Try to get from header
	sessionID := c.GetHeader("X-Session-ID")
	if sessionID != "" {
		return sessionID
	}

	// Try to get from authorization header (JWT)
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

// CircuitBreaker methods
func (cb *CircuitBreaker) AllowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = CircuitHalfOpen
			return true
		}
		return false
	case CircuitHalfOpen:
		return true
	default:
		return false
	}
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = CircuitClosed
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.failures >= cb.maxFailures {
		cb.state = CircuitOpen
	}
}

func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = CircuitClosed
}

func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	return cb.state
}

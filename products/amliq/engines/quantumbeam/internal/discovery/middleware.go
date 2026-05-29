//go:build legacy_migrated
// +build legacy_migrated

package discovery

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// ServiceDiscoveryMiddleware provides service discovery capabilities
type ServiceDiscoveryMiddleware struct {
	registry     *ServiceRegistry
	loadBalancer *LoadBalancer
	logger       *zap.Logger
	config       *MiddlewareConfig
	redisClient  *redis.Client
}

// MiddlewareConfig holds middleware configuration
type MiddlewareConfig struct {
	Enabled                 bool          `yaml:"enabled" json:"enabled"`
	HealthCheckInterval     time.Duration `yaml:"health_check_interval" json:"health_check_interval"`
	ServiceTimeout          time.Duration `yaml:"service_timeout" json:"service_timeout"`
	MaxRetries              int           `yaml:"max_retries" json:"max_retries"`
	RetryDelay              time.Duration `yaml:"retry_delay" json:"retry_delay"`
	CircuitBreakerEnabled   bool          `yaml:"circuit_breaker_enabled" json:"circuit_breaker_enabled"`
	CircuitBreakerThreshold int           `yaml:"circuit_breaker_threshold" json:"circuit_breaker_threshold"`
	RateLimitEnabled        bool          `yaml:"rate_limit_enabled" json:"rate_limit_enabled"`
	DefaultRateLimit        int           `yaml:"default_rate_limit" json:"default_rate_limit"`
	TimeoutEnabled          bool          `yaml:"timeout_enabled" json:"timeout_enabled"`
	DefaultTimeout          time.Duration `yaml:"default_timeout" json:"default_timeout"`
	LoadBalancingEnabled    bool          `yaml:"load_balancing_enabled" json:"load_balancing_enabled"`
	DefaultStrategy         string        `yaml:"default_strategy" json:"default_strategy"`
	StickySessionEnabled    bool          `yaml:"sticky_session_enabled" json:"sticky_session_enabled"`
	MetricsEnabled          bool          `yaml:"metrics_enabled" json:"metrics_enabled"`
	TracingEnabled          bool          `yaml:"tracing_enabled" json:"tracing_enabled"`
}

// ServiceRoute defines a service route
type ServiceRoute struct {
	Path         string            `yaml:"path" json:"path"`
	ServiceName  string            `yaml:"service_name" json:"service_name"`
	Methods      []string          `yaml:"methods" json:"methods"`
	Headers      map[string]string `yaml:"headers" json:"headers"`
	Timeout      time.Duration     `yaml:"timeout" json:"timeout"`
	Retries      int               `yaml:"retries" json:"retries"`
	Strategy     string            `yaml:"strategy" json:"strategy"`
	RateLimit    int               `yaml:"rate_limit" json:"rate_limit"`
	AuthRequired bool              `yaml:"auth_required" json:"auth_required"`
	Metadata     map[string]string `yaml:"metadata" json:"metadata"`
}

// Default middleware configuration
var (
	DefaultMiddlewareConfig = MiddlewareConfig{
		Enabled:                 true,
		HealthCheckInterval:     30 * time.Second,
		ServiceTimeout:          30 * time.Second,
		MaxRetries:              3,
		RetryDelay:              1 * time.Second,
		CircuitBreakerEnabled:   true,
		CircuitBreakerThreshold: 5,
		RateLimitEnabled:        true,
		DefaultRateLimit:        100,
		TimeoutEnabled:          true,
		DefaultTimeout:          30 * time.Second,
		LoadBalancingEnabled:    true,
		DefaultStrategy:         "weighted_round_robin",
		StickySessionEnabled:    false,
		MetricsEnabled:          true,
		TracingEnabled:          true,
	}
)

// NewServiceDiscoveryMiddleware creates a new service discovery middleware
func NewServiceDiscoveryMiddleware(
	registry *ServiceRegistry,
	loadBalancer *LoadBalancer,
	logger *zap.Logger,
	redisClient *redis.Client,
	config *MiddlewareConfig,
) *ServiceDiscoveryMiddleware {
	if config == nil {
		config = &DefaultMiddlewareConfig
	}

	return &ServiceDiscoveryMiddleware{
		registry:     registry,
		loadBalancer: loadBalancer,
		logger:       logger,
		config:       config,
		redisClient:  redisClient,
	}
}

// ServiceDiscovery creates a middleware for service discovery
func (sdm *ServiceDiscoveryMiddleware) ServiceDiscovery(routes []ServiceRoute) gin.HandlerFunc {
	if !sdm.config.Enabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	// Build route map
	routeMap := make(map[string]*ServiceRoute)
	for _, route := range routes {
		routeMap[route.Path] = &route
	}

	return func(c *gin.Context) {
		start := time.Now()

		// Find matching route
		route := sdm.findMatchingRoute(c.Request.URL.Path, c.Request.Method, routeMap)
		if route == nil {
			c.Next()
			return
		}

		// Add route info to context
		c.Set("service_route", route)
		c.Set("service_name", route.ServiceName)

		// Check authentication if required
		if route.AuthRequired {
			if !sdm.checkAuthentication(c) {
				c.JSON(401, gin.H{
					"error":   "Unauthorized",
					"message": "Authentication required",
				})
				c.Abort()
				return
			}
		}

		// Apply rate limiting if enabled
		if sdm.config.RateLimitEnabled && (route.RateLimit > 0 || sdm.config.DefaultRateLimit > 0) {
			rateLimit := route.RateLimit
			if rateLimit == 0 {
				rateLimit = sdm.config.DefaultRateLimit
			}

			if !sdm.checkRateLimit(c, rateLimit) {
				c.JSON(429, gin.H{
					"error":   "Rate limit exceeded",
					"message": "Too many requests",
				})
				c.Abort()
				return
			}
		}

		// Select service and proxy request
		if sdm.config.LoadBalancingEnabled {
			if err := sdm.proxyRequest(c, route); err != nil {
				sdm.handleError(c, err, 503, "Service Unavailable")
				c.Abort()
				return
			}
		} else {
			c.Next()
		}

		// Record metrics if enabled
		if sdm.config.MetricsEnabled {
			sdm.recordMetrics(c, route, time.Since(start))
		}
	}
}

// findMatchingRoute finds the matching route for the request
func (sdm *ServiceDiscoveryMiddleware) findMatchingRoute(path, method string, routeMap map[string]*ServiceRoute) *ServiceRoute {
	// Exact match first
	if route, exists := routeMap[path]; exists {
		// Check if method is allowed
		if len(route.Methods) == 0 || sdm.isMethodAllowed(method, route.Methods) {
			return route
		}
	}

	// Pattern matching
	for routePath, route := range routeMap {
		if sdm.pathMatches(path, routePath) {
			if len(route.Methods) == 0 || sdm.isMethodAllowed(method, route.Methods) {
				return route
			}
		}
	}

	return nil
}

// pathMatches checks if the request path matches the route pattern
func (sdm *ServiceDiscoveryMiddleware) pathMatches(path, pattern string) bool {
	// Simple pattern matching - can be enhanced with regex
	if pattern == path {
		return true
	}

	// Handle wildcard patterns
	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return strings.HasPrefix(path, prefix)
	}

	// Handle parameter patterns
	if strings.Contains(pattern, ":") {
		// Simple parameter matching - can be enhanced
		parts := strings.Split(pattern, "/")
		pathParts := strings.Split(path, "/")

		if len(parts) != len(pathParts) {
			return false
		}

		for i, part := range parts {
			if strings.HasPrefix(part, ":") {
				continue // Parameter matches anything
			}
			if part != pathParts[i] {
				return false
			}
		}
		return true
	}

	return false
}

// isMethodAllowed checks if the method is allowed for the route
func (sdm *ServiceDiscoveryMiddleware) isMethodAllowed(method string, allowedMethods []string) bool {
	for _, allowed := range allowedMethods {
		if strings.ToUpper(allowed) == strings.ToUpper(method) {
			return true
		}
	}
	return false
}

// checkAuthentication checks if the request is authenticated
func (sdm *ServiceDiscoveryMiddleware) checkAuthentication(c *gin.Context) bool {
	// Check for API key
	apiKey := c.GetHeader("X-API-Key")
	if apiKey != "" {
		return sdm.validateAPIKey(apiKey)
	}

	// Check for JWT token
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		return sdm.validateJWTToken(token)
	}

	// Check for session cookie
	sessionID, err := c.Cookie("session_id")
	if err == nil && sessionID != "" {
		return sdm.validateSession(sessionID)
	}

	return false
}

// validateAPIKey validates an API key
func (sdm *ServiceDiscoveryMiddleware) validateAPIKey(apiKey string) bool {
	// This would implement proper API key validation
	// For now, just check if key exists and is valid format
	return len(apiKey) > 10
}

// validateJWTToken validates a JWT token
func (sdm *ServiceDiscoveryMiddleware) validateJWTToken(token string) bool {
	// This would implement proper JWT validation
	// For now, just check if token exists and is valid format
	parts := strings.Split(token, ".")
	return len(parts) == 3
}

// validateSession validates a session ID
func (sdm *ServiceDiscoveryMiddleware) validateSession(sessionID string) bool {
	// This would implement proper session validation
	// Check Redis or database for valid session
	key := fmt.Sprintf("session:%s", sessionID)
	exists, err := sdm.redisClient.Exists(context.Background(), key).Result()
	return err == nil && exists > 0
}

// checkRateLimit checks if the request is within rate limits
func (sdm *ServiceDiscoveryMiddleware) checkRateLimit(c *gin.Context, limit int) bool {
	if !sdm.config.RateLimitEnabled {
		return true
	}

	clientIP := c.ClientIP()
	key := fmt.Sprintf("rate_limit:%s", clientIP)
	window := time.Minute

	// Use Redis sliding window counter
	current, err := sdm.redisClient.Incr(context.Background(), key).Result()
	if err != nil {
		return true // Allow on error
	}

	if current == 1 {
		sdm.redisClient.Expire(context.Background(), key, window)
	}

	return current <= int64(limit)
}

// proxyRequest proxies the request to a selected service
func (sdm *ServiceDiscoveryMiddleware) proxyRequest(c *gin.Context, route *ServiceRoute) error {
	// Build request context
	requestContext := &RequestContext{
		RequestID: c.GetHeader("X-Request-ID"),
		Method:    c.Request.Method,
		Path:      c.Request.URL.Path,
		Headers:   make(map[string]string),
		IP:        c.ClientIP(),
		UserAgent: c.GetHeader("User-Agent"),
		SessionID: sdm.extractSessionID(c),
	}

	// Copy headers
	for key, values := range c.Request.Header {
		if len(values) > 0 {
			requestContext.Headers[key] = values[0]
		}
	}

	// Determine load balancing strategy
	strategy := route.Strategy
	if strategy == "" {
		strategy = sdm.config.DefaultStrategy
	}

	// Select service
	service, err := sdm.loadBalancer.SelectService(c.Request.Context(), route.ServiceName, requestContext)
	if err != nil {
		return fmt.Errorf("failed to select service: %w", err)
	}

	// Add service information to headers
	c.Request.Header.Set("X-Service-ID", service.ID)
	c.Request.Header.Set("X-Service-Name", service.Name)
	c.Request.Header.Set("X-Service-Version", service.Version)
	c.Request.Header.Set("X-Forwarded-For", c.ClientIP())
	c.Request.Header.Set("X-Forwarded-Proto", c.Request.URL.Scheme)
	c.Request.Header.Set("X-Forwarded-Host", c.Request.Host)

	// Add custom headers
	for key, value := range route.Headers {
		c.Request.Header.Set(key, value)
	}

	// Store selected service in context
	c.Set("selected_service", service)

	return nil
}

// handleError handles errors in the middleware
func (sdm *ServiceDiscoveryMiddleware) handleError(c *gin.Context, err error, statusCode int, message string) {
	sdm.logger.Error("Service discovery error",
		zap.Error(err),
		zap.Int("status_code", statusCode),
		zap.String("path", c.Request.URL.Path),
		zap.String("method", c.Request.Method),
		zap.String("client_ip", c.ClientIP()))

	c.JSON(statusCode, gin.H{
		"error":      message,
		"code":       fmt.Sprintf("ERR_%d", statusCode),
		"message":    err.Error(),
		"request_id": c.GetString("request_id"),
		"timestamp":  time.Now().Unix(),
	})
}

// recordMetrics records request metrics
func (sdm *ServiceDiscoveryMiddleware) recordMetrics(c *gin.Context, route *ServiceRoute, duration time.Duration) {
	if !sdm.config.MetricsEnabled {
		return
	}

	// Record metrics in Redis or metrics system
	serviceName := c.GetString("service_name")
	serviceID := c.GetString("selected_service_id")
	statusCode := c.Writer.Status()

	metricsKey := fmt.Sprintf("metrics:%s:%s", serviceName, serviceID)
	metricsData := map[string]interface{}{
		"timestamp":   time.Now().Unix(),
		"duration":    duration.Milliseconds(),
		"status_code": statusCode,
		"method":      c.Request.Method,
		"path":        c.Request.URL.Path,
		"client_ip":   c.ClientIP(),
		"user_agent":  c.GetHeader("User-Agent"),
		"request_id":  c.GetString("request_id"),
	}

	// Store metrics (this would use a proper metrics system in production)
	sdm.redisClient.HMSet(context.Background(), metricsKey, metricsData)
	sdm.redisClient.Expire(context.Background(), metricsKey, 24*time.Hour)

	// Increment counters
	sdm.redisClient.Incr(context.Background(), fmt.Sprintf("counter:%s:requests", serviceName))
	sdm.redisClient.Incr(context.Background(), fmt.Sprintf("counter:%s:status:%d", serviceName, statusCode))

	// Record duration histogram
	sdm.redisClient.LPush(context.Background(), fmt.Sprintf("histogram:%s:duration", serviceName), duration.Milliseconds())
	sdm.redisClient.LTrim(context.Background(), fmt.Sprintf("histogram:%s:duration", serviceName), 0, 9999) // Keep last 10k values
}

// extractSessionID extracts session ID from request
func (sdm *ServiceDiscoveryMiddleware) extractSessionID(c *gin.Context) string {
	// Try cookie first
	sessionID, err := c.Cookie("session_id")
	if err == nil && sessionID != "" {
		return sessionID
	}

	// Try header
	sessionID = c.GetHeader("X-Session-ID")
	if sessionID != "" {
		return sessionID
	}

	// Try authorization header
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	return ""
}

// HealthCheckMiddleware provides health check functionality
func (sdm *ServiceDiscoveryMiddleware) HealthCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/health" || c.Request.URL.Path == "/healthz" {
			sdm.performHealthCheck(c)
			c.Abort()
			return
		}
		c.Next()
	}
}

// performHealthCheck performs a health check
func (sdm *ServiceDiscoveryMiddleware) performHealthCheck(c *gin.Context) {
	ctx := c.Request.Context()

	// Check Redis connection
	redisStatus := "healthy"
	if err := sdm.redisClient.Ping(ctx).Err(); err != nil {
		redisStatus = "unhealthy"
	}

	// Check service registry
	services, err := sdm.registry.GetAllServices(ctx)
	registryStatus := "healthy"
	if err != nil {
		registryStatus = "unhealthy"
	}

	// Count healthy services
	healthyServices := 0
	totalServices := 0
	for _, serviceList := range services {
		for _, service := range serviceList {
			totalServices++
			if service.Healthy {
				healthyServices++
			}
		}
	}

	// Overall health status
	overallStatus := "healthy"
	if redisStatus == "unhealthy" || registryStatus == "unhealthy" || healthyServices == 0 {
		overallStatus = "unhealthy"
	}

	statusCode := 200
	if overallStatus == "unhealthy" {
		statusCode = 503
	}

	c.JSON(statusCode, gin.H{
		"status":    overallStatus,
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0",
		"checks": map[string]interface{}{
			"redis": map[string]interface{}{
				"status": redisStatus,
			},
			"registry": map[string]interface{}{
				"status":           registryStatus,
				"total_services":   totalServices,
				"healthy_services": healthyServices,
			},
		},
	})
}

// MetricsMiddleware provides metrics collection
func (sdm *ServiceDiscoveryMiddleware) MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/metrics" {
			sdm.provideMetrics(c)
			c.Abort()
			return
		}
		c.Next()
	}
}

// provideMetrics provides metrics in Prometheus format
func (sdm *ServiceDiscoveryMiddleware) provideMetrics(c *gin.Context) {
	ctx := c.Request.Context()

	// Get service metrics
	services, err := sdm.registry.GetAllServices(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var lines []string

	// Service registry metrics
	lines = append(lines, "# HELP quantumbeam_services_total Total number of registered services")
	lines = append(lines, "# TYPE quantumbeam_services_total gauge")
	lines = append(lines, fmt.Sprintf("quantumbeam_services_total %d", len(services)))

	healthyServices := 0
	for _, serviceList := range services {
		for _, service := range serviceList {
			if service.Healthy {
				healthyServices++
			}
		}
	}

	lines = append(lines, "# HELP quantumbeam_services_healthy_total Number of healthy services")
	lines = append(lines, "# TYPE quantumbeam_services_healthy_total gauge")
	lines = append(lines, fmt.Sprintf("quantumbeam_services_healthy_total %d", healthyServices))

	// Service-specific metrics
	for serviceName, serviceList := range services {
		for _, service := range serviceList {
			lines = append(lines, fmt.Sprintf("# HELP quantumbeam_service_%s_info Service information", serviceName))
			lines = append(lines, fmt.Sprintf("# TYPE quantumbeam_service_%s_info gauge", serviceName))
			lines = append(lines, fmt.Sprintf(`quantumbeam_service_%s_info{service_id="%s",host="%s",port="%d",version="%s",status="%s",healthy="%t"} 1`,
				serviceName, service.ID, service.Host, service.Port, service.Version, service.Status, service.Healthy))

			if service.ResponseTime > 0 {
				lines = append(lines, fmt.Sprintf("# HELP quantumbeam_service_%s_response_time Service response time", serviceName))
				lines = append(lines, fmt.Sprintf("# TYPE quantumbeam_service_%s_response_time gauge", serviceName))
				lines = append(lines, fmt.Sprintf("quantumbeam_service_%s_response_time{service_id=\"%s\"} %.3f",
					serviceName, service.ID, service.ResponseTime.Seconds()))
			}
		}
	}

	c.Header("Content-Type", "text/plain")
	c.String(200, strings.Join(lines, "\n"))
}

// AdminMiddleware provides admin functionality
func (sdm *ServiceDiscoveryMiddleware) AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/admin/") {
			// Check admin authentication
			if !sdm.checkAdminAuthentication(c) {
				c.JSON(401, gin.H{
					"error":   "Unauthorized",
					"message": "Admin access required",
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// checkAdminAuthentication checks admin authentication
func (sdm *ServiceDiscoveryMiddleware) checkAdminAuthentication(c *gin.Context) bool {
	// Check for admin API key
	adminKey := c.GetHeader("X-Admin-Key")
	if adminKey != "" {
		return sdm.validateAdminKey(adminKey)
	}

	// Check for admin token
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		return sdm.validateAdminToken(token)
	}

	return false
}

// validateAdminKey validates an admin API key
func (sdm *ServiceDiscoveryMiddleware) validateAdminKey(adminKey string) bool {
	// This would implement proper admin key validation
	return len(adminKey) > 20 && strings.HasPrefix(adminKey, "admin_")
}

// validateAdminToken validates an admin token
func (sdm *ServiceDiscoveryMiddleware) validateAdminToken(token string) bool {
	// This would implement proper admin token validation
	// Check if token has admin claims
	return len(token) > 50
}

// CircuitBreakerMiddleware provides circuit breaker functionality
func (sdm *ServiceDiscoveryMiddleware) CircuitBreakerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !sdm.config.CircuitBreakerEnabled {
			c.Next()
			return
		}

		serviceName := c.GetString("service_name")
		if serviceName == "" {
			c.Next()
			return
		}

		// Check circuit breaker
		if !sdm.checkServiceCircuitBreaker(serviceName) {
			c.JSON(503, gin.H{
				"error":   "Service Unavailable",
				"message": "Circuit breaker is open",
			})
			c.Abort()
			return
		}

		c.Next()

		// Update circuit breaker based on response
		if c.Writer.Status() >= 500 {
			sdm.recordCircuitBreakerFailure(serviceName)
		} else {
			sdm.recordCircuitBreakerSuccess(serviceName)
		}
	}
}

// checkServiceCircuitBreaker checks if circuit breaker allows request
func (sdm *ServiceDiscoveryMiddleware) checkServiceCircuitBreaker(serviceName string) bool {
	key := fmt.Sprintf("circuit_breaker:%s", serviceName)

	// Get current state
	state, err := sdm.redisClient.Get(context.Background(), key).Result()
	if err == redis.Nil {
		// No circuit breaker data, allow request
		return true
	} else if err != nil {
		// Error reading, allow request (fail open)
		return true
	}

	// Check if circuit breaker is open
	if state == "open" {
		// Check if timeout has passed
		timeoutKey := fmt.Sprintf("circuit_breaker:%s:timeout", serviceName)
		timeout, err := sdm.redisClient.Get(context.Background(), timeoutKey).Result()
		if err == redis.Nil {
			// No timeout, circuit breaker is still open
			return false
		} else if err != nil {
			// Error reading, allow request (fail open)
			return true
		}

		timeoutTime, err := strconv.ParseInt(timeout, 10, 64)
		if err != nil {
			// Invalid timeout, allow request
			return true
		}

		if time.Now().Unix() > timeoutTime {
			// Timeout passed, move to half-open
			sdm.redisClient.Set(context.Background(), key, "half_open", 0)
			return true
		}

		// Circuit breaker still open
		return false
	}

	// Circuit breaker is closed or half-open
	return true
}

// recordCircuitBreakerFailure records a failure for the circuit breaker
func (sdm *ServiceDiscoveryMiddleware) recordCircuitBreakerFailure(serviceName string) {
	key := fmt.Sprintf("circuit_breaker:%s", serviceName)
	failuresKey := fmt.Sprintf("circuit_breaker:%s:failures", serviceName)

	// Increment failure count
	failures, err := sdm.redisClient.Incr(context.Background(), failuresKey).Result()
	if err != nil {
		return
	}

	// Set expiration for failure count
	if failures == 1 {
		sdm.redisClient.Expire(context.Background(), failuresKey, time.Minute*5)
	}

	// Check if threshold reached
	if failures >= int64(sdm.config.CircuitBreakerThreshold) {
		// Open circuit breaker
		sdm.redisClient.Set(context.Background(), key, "open", time.Minute*5)
		sdm.redisClient.Set(context.Background(),
			fmt.Sprintf("circuit_breaker:%s:timeout", serviceName),
			time.Now().Add(time.Minute*1).Unix(),
			time.Minute*5)
	}
}

// recordCircuitBreakerSuccess records a success for the circuit breaker
func (sdm *ServiceDiscoveryMiddleware) recordCircuitBreakerSuccess(serviceName string) {
	key := fmt.Sprintf("circuit_breaker:%s", serviceName)
	failuresKey := fmt.Sprintf("circuit_breaker:%s:failures", serviceName)

	// Get current state
	state, err := sdm.redisClient.Get(context.Background(), key).Result()
	if err != nil {
		return
	}

	if state == "half_open" {
		// Success in half-open state, close circuit breaker
		sdm.redisClient.Set(context.Background(), key, "closed", 0)
		sdm.redisClient.Del(context.Background(), failuresKey)
	} else if state == "closed" {
		// Reset failure count on success
		sdm.redisClient.Del(context.Background(), failuresKey)
	}
}
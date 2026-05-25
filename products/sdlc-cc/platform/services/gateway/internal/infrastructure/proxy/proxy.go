package proxy

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/discovery"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

// RouteConfig represents a routing configuration
type RouteConfig struct {
	Path         string            `json:"path"`
	Methods      []string          `json:"methods"`
	Service      string            `json:"service"`
	StripPrefix  bool              `json:"strip_prefix"`
	RewritePath  string            `json:"rewrite_path"`
	Timeout      time.Duration     `json:"timeout"`
	Retries      int               `json:"retries"`
	Headers      map[string]string `json:"headers"`
	AuthRequired bool              `json:"auth_required"`
	RateLimit    int               `json:"rate_limit"`
	CORS         CORSConfig        `json:"cors"`
	Webhook      bool              `json:"webhook"`
	Compression  bool              `json:"compression"`
}

// CORSConfig represents CORS configuration for a route
type CORSConfig struct {
	Enabled          bool     `json:"enabled"`
	AllowedOrigins   []string `json:"allowed_origins"`
	AllowedMethods   []string `json:"allowed_methods"`
	AllowedHeaders   []string `json:"allowed_headers"`
	ExposeHeaders    []string `json:"expose_headers"`
	AllowCredentials bool     `json:"allow_credentials"`
	MaxAge           int      `json:"max_age"`
}

// ProxyConfig represents the proxy configuration
type ProxyConfig struct {
	Routes              map[string]*RouteConfig `json:"routes"`
	DefaultTimeout      time.Duration           `json:"default_timeout"`
	DefaultRetries      int                     `json:"default_retries"`
	EnableCompression   bool                    `json:"enable_compression"`
	EnableTracing       bool                    `json:"enable_tracing"`
	EnableMetrics       bool                    `json:"enable_metrics"`
	MaxBodySize         int64                   `json:"max_body_size"`
	HealthCheckInterval time.Duration           `json:"health_check_interval"`
	CircuitBreaker      CircuitBreakerConfig    `json:"circuit_breaker"`
}

// CircuitBreakerConfig represents circuit breaker configuration
type CircuitBreakerConfig struct {
	Enabled         bool          `json:"enabled"`
	MaxFailures     int           `json:"max_failures"`
	ResetTimeout    time.Duration `json:"reset_timeout"`
	FailureRate     float64       `json:"failure_rate"`
	MinimumRequests int           `json:"minimum_requests"`
}

// Proxy represents a reverse proxy with service discovery
type Proxy struct {
	config          *ProxyConfig
	serviceRegistry *discovery.ServiceRegistry
	logger          *logrus.Entry
	traceHelper     *observability.TraceHelper
	router          *Router
	circuitBreakers map[string]*circuitbreaker.CircuitBreaker
	tracer          trace.Tracer
}

// Router handles route matching and selection
type Router struct {
	routes []*CompiledRoute
	logger *logrus.Entry
}

// CompiledRoute represents a compiled route with regex
type CompiledRoute struct {
	Config   *RouteConfig
	Pattern  *regexp.Regexp
	Methods  map[string]bool
	Compiled bool
}

// NewProxy creates a new reverse proxy
func NewProxy(
	config *ProxyConfig,
	serviceRegistry *discovery.ServiceRegistry,
	logger *observability.Logger,
	traceHelper *observability.TraceHelper,
) *Proxy {
	proxy := &Proxy{
		config:          config,
		serviceRegistry: serviceRegistry,
		logger: logrus.WithFields(logrus.Fields{
			"component": "proxy",
		}),
		traceHelper:     traceHelper,
		router:          NewRouter(config.Routes),
		circuitBreakers: make(map[string]*circuitbreaker.CircuitBreaker),
		tracer:          otel.Tracer("proxy"),
	}

	// Initialize circuit breakers
	if config.CircuitBreaker.Enabled {
		for serviceName := range config.Routes {
			cb := circuitbreaker.New(circuitbreaker.Config{
				MaxFailures:      config.CircuitBreaker.MaxFailures,
				ResetTimeout:     config.CircuitBreaker.ResetTimeout,
				SuccessThreshold: 3,
				FailureThreshold: 2,
				RequestTimeout:   config.DefaultTimeout,
				MonitorInterval:  1 * time.Minute,
				Name:             fmt.Sprintf("proxy_%s", serviceName),
			})
			proxy.circuitBreakers[serviceName] = cb
		}
	}

	return proxy
}

// NewRouter creates a new router with compiled routes
func NewRouter(routes map[string]*RouteConfig) *Router {
	router := &Router{
		routes: make([]*CompiledRoute, 0, len(routes)),
		logger: logrus.WithFields(logrus.Fields{
			"component": "proxy_router",
		}),
	}

	for _, route := range routes {
		compiledRoute := &CompiledRoute{
			Config:  route,
			Methods: make(map[string]bool),
		}

		// Compile regex pattern
		pattern := route.Path
		if strings.Contains(pattern, "*") {
			// Convert wildcard to regex
			pattern = strings.ReplaceAll(pattern, "*", ".*")
		}

		regex, err := regexp.Compile("^" + pattern + "$")
		if err != nil {
			router.logger.WithFields(logrus.Fields{
				"path":  route.Path,
				"error": err,
			}).Error("Failed to compile route pattern")
			continue
		}

		compiledRoute.Pattern = regex
		compiledRoute.Compiled = true

		// Compile methods
		for _, method := range route.Methods {
			compiledRoute.Methods[strings.ToUpper(method)] = true
		}

		router.routes = append(router.routes, compiledRoute)
	}

	return router
}

// ServeHTTP implements the http.Handler interface
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ctx, span := p.tracer.Start(ctx, "proxy.request",
		trace.WithAttributes(
			attribute.String("http.method", r.Method),
			attribute.String("http.path", r.URL.Path),
			attribute.String("http.host", r.Host),
		))
	defer span.End()

	// Find matching route
	route, pathParams := p.router.Match(r.Method, r.URL.Path)
	if route == nil {
		p.logger.WithFields(logrus.Fields{
			"method": r.Method,
			"path":   r.URL.Path,
		}).Warn("No matching route found")

		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Route not found",
			},
		})
		return
	}

	// Get service instance
	instance, err := p.serviceRegistry.GetInstance(ctx, route.Config.Service, r.RemoteAddr)
	if err != nil {
		p.logger.WithFields(logrus.Fields{
			"service": route.Config.Service,
			"error":   err,
		}).Error("Failed to get service instance")

		render.Status(r, http.StatusServiceUnavailable)
		render.JSON(w, r, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "SERVICE_UNAVAILABLE",
				"message": "No healthy service instances available",
			},
		})
		return
	}

	// Apply circuit breaker if enabled
	if cb, exists := p.circuitBreakers[route.Config.Service]; exists {
		err := cb.Execute(ctx, func(ctx context.Context) error {
			return p.proxyRequest(ctx, w, r, route, instance, pathParams)
		})

		if err != nil {
			p.logger.WithFields(logrus.Fields{
				"service": route.Config.Service,
				"error":   err,
			}).Error("Circuit breaker blocked request")

			render.Status(r, http.StatusServiceUnavailable)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "SERVICE_UNAVAILABLE",
					"message": "Service temporarily unavailable",
				},
			})
			return
		}
	} else {
		// Direct proxy without circuit breaker
		err = p.proxyRequest(ctx, w, r, route, instance, pathParams)
		if err != nil {
			p.logger.WithFields(logrus.Fields{
				"service": route.Config.Service,
				"error":   err,
			}).Error("Proxy request failed")

			render.Status(r, http.StatusBadGateway)
			render.JSON(w, r, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "BAD_GATEWAY",
					"message": "Failed to proxy request",
				},
			})
			return
		}
	}
}

// proxyRequest performs the actual proxying
func (p *Proxy) proxyRequest(
	ctx context.Context,
	w http.ResponseWriter,
	r *http.Request,
	route *CompiledRoute,
	instance *discovery.ServiceInstance,
	pathParams map[string]string,
) error {
	start := time.Now()

	// Create target URL
	targetURL, err := p.buildTargetURL(instance, route, r.URL.Path, pathParams)
	if err != nil {
		return fmt.Errorf("failed to build target URL: %w", err)
	}

	// Defence against SSRF: targetURL is derived from the service registry,
	// but require http/https scheme explicitly — reject file://, gopher://,
	// and similar schemes that a malformed registry entry could produce.
	if s := targetURL.Scheme; s != "http" && s != "https" {
		return fmt.Errorf("refusing proxy to non-http target scheme: %q", s)
	}

	// Create proxy request
	proxyReq, err := http.NewRequestWithContext(ctx, r.Method, targetURL.String(), r.Body) // #nosec G107 G704 -- scheme validated; host from authenticated service registry
	if err != nil {
		return fmt.Errorf("failed to create proxy request: %w", err)
	}

	// Copy headers
	p.copyHeaders(r.Header, proxyReq.Header, route.Config)

	// Add proxy headers
	proxyReq.Header.Set("X-Forwarded-For", r.RemoteAddr)
	proxyReq.Header.Set("X-Forwarded-Proto", "http")
	if r.TLS != nil {
		proxyReq.Header.Set("X-Forwarded-Proto", "https")
	}
	proxyReq.Header.Set("X-Forwarded-Host", r.Host)
	proxyReq.Header.Set("X-Real-IP", r.RemoteAddr)

	// Propagate trace context
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(ctx, &headerCarrier{proxyReq.Header})

	// Create HTTP client with timeout
	timeout := route.Config.Timeout
	if timeout == 0 {
		timeout = p.config.DefaultTimeout
	}
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	client := &http.Client{
		Timeout: timeout,
	}

	// Perform request with retries
	var resp *http.Response
	var lastErr error

	maxRetries := route.Config.Retries
	if maxRetries == 0 {
		maxRetries = p.config.DefaultRetries
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			p.logger.WithFields(logrus.Fields{
				"service":       route.Config.Service,
				"instance":      instance.ID,
				"attempt":       attempt,
				"attempted_url": targetURL.String(),
			}).Warn("Retrying proxy request")
			time.Sleep(time.Duration(attempt) * 100 * time.Millisecond) // Exponential backoff
		}

		resp, lastErr = client.Do(proxyReq) // #nosec G107 G704 -- scheme validated above; host from authenticated service registry
		if lastErr == nil && resp.StatusCode < 500 {
			break // Success or client error, don't retry
		}

		if resp != nil {
			// Best-effort close on retry; close error is non-actionable.
			_ = resp.Body.Close()
		}

		if attempt < maxRetries {
			// Create new request body for retry
			if r.Body != nil {
				bodyBytes, err := io.ReadAll(r.Body)
				if err == nil {
					proxyReq.Body = io.NopCloser(bytes.NewReader(bodyBytes))
					r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				}
			}
		}
	}

	if lastErr != nil {
		return fmt.Errorf("proxy request failed after %d attempts: %w", maxRetries+1, lastErr)
	}
	defer resp.Body.Close()

	// Copy response headers
	p.copyResponseHeaders(resp.Header, w.Header())

	// Set status code
	w.WriteHeader(resp.StatusCode)

	// Copy response body
	if resp.Body != nil {
		_, err := io.Copy(w, resp.Body)
		if err != nil {
			p.logger.WithError(err).Error("Failed to copy response body")
		}
	}

	// Log successful proxy
	duration := time.Since(start)
	p.logger.WithFields(logrus.Fields{
		"service":     route.Config.Service,
		"instance":    instance.ID,
		"target_url":  targetURL.String(),
		"status_code": resp.StatusCode,
		"duration":    duration.Milliseconds(),
		"attempt":     min(maxRetries+1, maxRetries+1),
	}).Info("Proxy request completed")

	// Add trace attributes
	p.traceHelper.SetAttributes(ctx, map[string]interface{}{
		"proxy.service":     route.Config.Service,
		"proxy.instance":    instance.ID,
		"proxy.target_url":  targetURL.String(),
		"proxy.status_code": resp.StatusCode,
		"proxy.duration_ms": duration.Milliseconds(),
		"proxy.attempt":     min(maxRetries+1, maxRetries+1),
	})

	return nil
}

// buildTargetURL builds the target URL for the proxy request
func (p *Proxy) buildTargetURL(
	instance *discovery.ServiceInstance,
	route *CompiledRoute,
	requestPath string,
	pathParams map[string]string,
) (*url.URL, error) {
	protocol := "http"
	if instance.Protocol != "" {
		protocol = instance.Protocol
	}

	baseURL := fmt.Sprintf("%s://%s:%d", protocol, instance.Address, instance.Port)

	// Determine the path
	path := requestPath

	// Strip prefix if configured
	if route.Config.StripPrefix {
		path = strings.TrimPrefix(path, route.Config.Path)
	}

	// Rewrite path if configured
	if route.Config.RewritePath != "" {
		// Replace path parameters
		rewritePath := route.Config.RewritePath
		for key, value := range pathParams {
			rewritePath = strings.ReplaceAll(rewritePath, "{"+key+"}", value)
		}
		path = rewritePath
	}

	targetURL := baseURL + path

	return url.Parse(targetURL)
}

// copyHeaders copies headers from source to destination with filtering
func (p *Proxy) copyHeaders(source, destination http.Header, routeConfig *RouteConfig) {
	// Copy standard headers
	for name, values := range source {
		// Skip hop-by-hop headers
		if p.isHopByHopHeader(name) {
			continue
		}

		// Skip certain headers for security
		if p.shouldSkipHeader(name) {
			continue
		}

		for _, value := range values {
			destination.Add(name, value)
		}
	}

	// Add custom headers from route config
	for name, value := range routeConfig.Headers {
		destination.Set(name, value)
	}
}

// copyResponseHeaders copies response headers with filtering
func (p *Proxy) copyResponseHeaders(source, destination http.Header) {
	for name, values := range source {
		// Skip hop-by-hop headers
		if p.isHopByHopHeader(name) {
			continue
		}

		for _, value := range values {
			destination.Add(name, value)
		}
	}
}

// isHopByHopHeader checks if a header is a hop-by-hop header
func (p *Proxy) isHopByHopHeader(name string) bool {
	hopByHopHeaders := []string{
		"Connection", "Keep-Alive", "Proxy-Authenticate",
		"Proxy-Authorization", "TE", "Trailers", "Transfer-Encoding",
		"Upgrade", "Proxy-Connection",
	}

	for _, hopByHop := range hopByHopHeaders {
		if strings.EqualFold(name, hopByHop) {
			return true
		}
	}

	return false
}

// shouldSkipHeader checks if a header should be skipped
func (p *Proxy) shouldSkipHeader(name string) bool {
	skipHeaders := []string{
		"Host", "Authorization", "Cookie",
	}

	for _, skip := range skipHeaders {
		if strings.EqualFold(name, skip) {
			return true
		}
	}

	return false
}

// Match finds the matching route for the given method and path
func (router *Router) Match(method, path string) (*CompiledRoute, map[string]string) {
	for _, route := range router.routes {
		if !route.Compiled {
			continue
		}

		// Check method
		if len(route.Methods) > 0 && !route.Methods[strings.ToUpper(method)] {
			continue
		}

		// Check path pattern
		matches := route.Pattern.FindStringSubmatch(path)
		if matches == nil {
			continue
		}

		// Extract path parameters
		params := make(map[string]string)
		if len(matches) > 1 {
			// For simple patterns, we don't have named groups
			// This is a simplified implementation
			for i, match := range matches[1:] {
				params[fmt.Sprintf("param%d", i)] = match
			}
		}

		return route, params
	}

	return nil, nil
}

// headerCarrier implements propagation.TextMapCarrier for HTTP headers
type headerCarrier struct {
	headers http.Header
}

func (c *headerCarrier) Get(key string) string {
	return c.headers.Get(key)
}

func (c *headerCarrier) Set(key, value string) {
	c.headers.Set(key, value)
}

func (c *headerCarrier) Keys() []string {
	keys := make([]string, 0, len(c.headers))
	for k := range c.headers {
		keys = append(keys, k)
	}
	return keys
}

// CreateProxyMiddleware creates a proxy middleware from configuration
func CreateProxyMiddleware(
	config *ProxyConfig,
	serviceRegistry *discovery.ServiceRegistry,
	logger *observability.Logger,
	traceHelper *observability.TraceHelper,
) func(http.Handler) http.Handler {
	proxy := NewProxy(config, serviceRegistry, logger, traceHelper)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if request matches any proxy route
			route, _ := proxy.router.Match(r.Method, r.URL.Path)
			if route != nil {
				// Handle as proxy request
				proxy.ServeHTTP(w, r)
				return
			}

			// Continue to next handler
			next.ServeHTTP(w, r)
		})
	}
}

// DefaultProxyConfig returns a default proxy configuration
func DefaultProxyConfig() *ProxyConfig {
	return &ProxyConfig{
		Routes:              make(map[string]*RouteConfig),
		DefaultTimeout:      30 * time.Second,
		DefaultRetries:      2,
		EnableCompression:   true,
		EnableTracing:       true,
		EnableMetrics:       true,
		MaxBodySize:         10 * 1024 * 1024, // 10MB
		HealthCheckInterval: 30 * time.Second,
		CircuitBreaker: CircuitBreakerConfig{
			Enabled:         true,
			MaxFailures:     5,
			ResetTimeout:    30 * time.Second,
			FailureRate:     0.5,
			MinimumRequests: 10,
		},
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

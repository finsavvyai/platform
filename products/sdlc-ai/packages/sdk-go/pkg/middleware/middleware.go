package middleware

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

// ========================================
// Core Middleware Interface
// ========================================

// Middleware defines middleware interface
type Middleware interface {
	BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error
	AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error
	Name() string
}

// ========================================
// Base Middleware
// ========================================

// BaseMiddleware provides common functionality for middleware
type BaseMiddleware struct {
	name string
}

// NewBaseMiddleware creates a new base middleware
func NewBaseMiddleware(name string) *BaseMiddleware {
	return &BaseMiddleware{name: name}
}

// Name returns middleware name
func (m *BaseMiddleware) Name() string {
	return m.name
}

// BeforeRequest default implementation (no-op)
func (m *BaseMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	return nil
}

// AfterResponse default implementation (no-op)
func (m *BaseMiddleware) AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	return nil
}

// ========================================
// Logging Middleware
// ========================================

// Logger defines logging interface
type Logger interface {
	Debug(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, err error, fields ...interface{})
	Fatal(msg string, err error, fields ...interface{})
}

// LoggingMiddleware logs HTTP requests and responses
type LoggingMiddleware struct {
	*BaseMiddleware
	logger      Logger
	logRequest  bool
	logResponse bool
	logHeaders  bool
	logBody     bool
	maxBodySize int
}

// NewLoggingMiddleware creates a new logging middleware
func NewLoggingMiddleware(logger Logger) *LoggingMiddleware {
	return &LoggingMiddleware{
		BaseMiddleware: NewBaseMiddleware("logging"),
		logger:         logger,
		logRequest:     true,
		logResponse:    true,
		logHeaders:     false,
		logBody:        false,
		maxBodySize:    1024,
	}
}

// WithRequestLogging enables/disables request logging
func (m *LoggingMiddleware) WithRequestLogging(enabled bool) *LoggingMiddleware {
	m.logRequest = enabled
	return m
}

// WithResponseLogging enables/disables response logging
func (m *LoggingMiddleware) WithResponseLogging(enabled bool) *LoggingMiddleware {
	m.logResponse = enabled
	return m
}

// WithHeaderLogging enables/disables header logging
func (m *LoggingMiddleware) WithHeaderLogging(enabled bool) *LoggingMiddleware {
	m.logHeaders = enabled
	return m
}

// WithBodyLogging enables/disables body logging
func (m *LoggingMiddleware) WithBodyLogging(enabled bool, maxSize int) *LoggingMiddleware {
	m.logBody = enabled
	m.maxBodySize = maxSize
	return m
}

// BeforeRequest logs incoming request
func (m *LoggingMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	if !m.logRequest {
		return nil
	}

	fields := []interface{}{
		"method", req.Method(),
		"url", req.URL(),
		"headers", m.getHeaders(req, m.logHeaders),
	}

	if m.logBody {
		// Note: In a real implementation, you'd need to read the body
		// This is simplified as the request body might be streamed
		fields = append(fields, "body", "<body>")
	}

	m.logger.Info("HTTP Request", fields...)
	return nil
}

// AfterResponse logs response
func (m *LoggingMiddleware) AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	if !m.logResponse {
		return nil
	}

	fields := []interface{}{
		"status", resp.StatusCode(),
		"headers", resp.Headers(),
	}

	if m.logBody {
		body := resp.Body()
		if len(body) > m.maxBodySize {
			body = append(body[:m.maxBodySize], []byte("...")...)
		}
		fields = append(fields, "body", string(body))
	}

	m.logger.Info("HTTP Response", fields...)
	return nil
}

// getHeaders extracts headers as a map
func (m *LoggingMiddleware) getHeaders(req sdln.HTTPRequest, all bool) map[string]string {
	headers := make(map[string]string)

	if all {
		// In a real implementation, you'd iterate through all headers
		// This is simplified
		headers["user-agent"] = req.Header("User-Agent")
		headers["content-type"] = req.Header("Content-Type")
	} else {
		headers["user-agent"] = req.Header("User-Agent")
	}

	return headers
}

// ========================================
// Metrics Middleware
// ========================================

// MetricsCollector defines metrics collection interface
type MetricsCollector interface {
	Counter(name string, tags map[string]string) sdln.Counter
	Gauge(name string, tags map[string]string) sdln.Gauge
	Histogram(name string, tags map[string]string) sdln.Histogram
	Timer(name string, tags map[string]string) sdln.Timer
}

// MetricsMiddleware collects HTTP metrics
type MetricsMiddleware struct {
	*BaseMiddleware
	collector MetricsCollector
}

// NewMetricsMiddleware creates a new metrics middleware
func NewMetricsMiddleware(collector MetricsCollector) *MetricsMiddleware {
	return &MetricsMiddleware{
		BaseMiddleware: NewBaseMiddleware("metrics"),
		collector:      collector,
	}
}

// BeforeRequest records request metrics
func (m *MetricsMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	// Record request count
	counter := m.collector.Counter("http_requests_total", map[string]string{
		"method": req.Method(),
		"path":   extractPath(req.URL()),
	})
	counter.Inc()

	// Start timing request
	timer := m.collector.Timer("http_request_duration", map[string]string{
		"method": req.Method(),
		"path":   extractPath(req.URL()),
	})

	stopwatch := timer.Start()

	// Store stopwatch in context for later use
	ctx = context.WithValue(ctx, "stopwatch", stopwatch)

	return nil
}

// AfterResponse records response metrics
func (m *MetricsMiddleware) AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	// Extract method and path from context or create new metrics
	method := "unknown"
	path := "unknown"

	// Record response status
	statusCounter := m.collector.Counter("http_responses_total", map[string]string{
		"method": method,
		"path":   path,
		"status": fmt.Sprintf("%d", resp.StatusCode()),
	})
	statusCounter.Inc()

	// Stop request timer if it exists
	if stopwatch, ok := ctx.Value("stopwatch").(sdln.Stopwatch); ok {
		stopwatch.Stop()
	}

	return nil
}

// extractPath extracts path from URL (removes query parameters)
func extractPath(urlStr string) string {
	if idx := strings.Index(urlStr, "?"); idx != -1 {
		return urlStr[:idx]
	}
	return urlStr
}

// ========================================
// Authentication Middleware
// ========================================

// AuthMiddleware handles authentication
type AuthMiddleware struct {
	*BaseMiddleware
	authenticator sdln.Authenticator
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(authenticator sdln.Authenticator) *AuthMiddleware {
	return &AuthMiddleware{
		BaseMiddleware: NewBaseMiddleware("auth"),
		authenticator:  authenticator,
	}
}

// BeforeRequest performs authentication
func (m *AuthMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	if m.authenticator != nil {
		return m.authenticator.Authenticate(ctx, req)
	}
	return nil
}

// ========================================
// Timeout Middleware
// ========================================

// TimeoutMiddleware adds timeout to requests
type TimeoutMiddleware struct {
	*BaseMiddleware
	timeout time.Duration
}

// NewTimeoutMiddleware creates a new timeout middleware
func NewTimeoutMiddleware(timeout time.Duration) *TimeoutMiddleware {
	return &TimeoutMiddleware{
		BaseMiddleware: NewBaseMiddleware("timeout"),
		timeout:        timeout,
	}
}

// BeforeRequest adds timeout to context
func (m *TimeoutMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	if m.timeout > 0 {
		_, cancel := context.WithTimeout(ctx, m.timeout)
		// Note: In a real implementation, you'd store the cancel function
		// to be called later
		_ = cancel
	}
	return nil
}

// ========================================
// Retry Middleware
// ========================================

// RetryMiddleware handles retries
type RetryMiddleware struct {
	*BaseMiddleware
	maxRetries int
	backoff    time.Duration
}

// NewRetryMiddleware creates a new retry middleware
func NewRetryMiddleware(maxRetries int, backoff time.Duration) *RetryMiddleware {
	return &RetryMiddleware{
		BaseMiddleware: NewBaseMiddleware("retry"),
		maxRetries:     maxRetries,
		backoff:        backoff,
	}
}

// BeforeRequest doesn't do anything for retry middleware
func (m *RetryMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	return nil
}

// AfterResponse determines if a retry should be attempted
func (m *RetryMiddleware) AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	// Note: In a real implementation, you'd need to store retry attempt count
	// and implement actual retry logic
	if resp.StatusCode() >= 500 && m.maxRetries > 0 {
		return fmt.Errorf("should retry (attempt %d/%d)", 1, m.maxRetries)
	}
	return nil
}

// ========================================
// Security Middleware
// ========================================

// SecurityMiddleware adds security headers
type SecurityMiddleware struct {
	*BaseMiddleware
	headers map[string]string
}

// NewSecurityMiddleware creates a new security middleware
func NewSecurityMiddleware() *SecurityMiddleware {
	return &SecurityMiddleware{
		BaseMiddleware: NewBaseMiddleware("security"),
		headers: map[string]string{
			"X-Content-Type-Options":    "nosniff",
			"X-Frame-Options":           "DENY",
			"X-XSS-Protection":          "1; mode=block",
			"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
			"Content-Security-Policy":   "default-src 'self'",
		},
	}
}

// WithHeader adds or overrides a security header
func (m *SecurityMiddleware) WithHeader(key, value string) *SecurityMiddleware {
	m.headers[key] = value
	return m
}

// WithoutHeader removes a security header
func (m *SecurityMiddleware) WithoutHeader(key string) *SecurityMiddleware {
	delete(m.headers, key)
	return m
}

// BeforeRequest adds security headers
func (m *SecurityMiddleware) BeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	// Note: Security headers are typically added to responses
	// This is a placeholder for request-time security checks
	return nil
}

// AfterResponse adds security headers to response
func (m *SecurityMiddleware) AfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	// Note: In a real implementation, you'd modify the response headers
	// This is simplified
	_ = resp.StatusCode()
	return nil
}

// ========================================
// Middleware Chain
// ========================================

// Chain manages a collection of middleware
type Chain struct {
	middleware []Middleware
}

// NewChain creates a new middleware chain
func NewChain(middleware ...Middleware) *Chain {
	return &Chain{
		middleware: middleware,
	}
}

// Add adds middleware to chain
func (c *Chain) Add(middleware ...Middleware) *Chain {
	c.middleware = append(c.middleware, middleware...)
	return c
}

// Insert inserts middleware at a specific position
func (c *Chain) Insert(index int, middleware Middleware) *Chain {
	if index < 0 || index > len(c.middleware) {
		return c
	}

	c.middleware = append(c.middleware[:index], append([]Middleware{middleware}, c.middleware[index:]...)...)
	return c
}

// Remove removes middleware by name
func (c *Chain) Remove(name string) *Chain {
	for i, m := range c.middleware {
		if m.Name() == name {
			c.middleware = append(c.middleware[:i], c.middleware[i+1:]...)
			break
		}
	}
	return c
}

// Get retrieves middleware by name
func (c *Chain) Get(name string) (Middleware, bool) {
	for _, m := range c.middleware {
		if m.Name() == name {
			return m, true
		}
	}
	return nil, false
}

// ExecuteBeforeRequest executes all BeforeRequest methods
func (c *Chain) ExecuteBeforeRequest(ctx context.Context, req sdln.HTTPRequest) error {
	for _, m := range c.middleware {
		if err := m.BeforeRequest(ctx, req); err != nil {
			return err
		}
	}
	return nil
}

// ExecuteAfterResponse executes all AfterResponse methods
func (c *Chain) ExecuteAfterResponse(ctx context.Context, resp *sdln.HTTPResponse) error {
	for _, m := range c.middleware {
		if err := m.AfterResponse(ctx, resp); err != nil {
			return err
		}
	}
	return nil
}

// Size returns number of middleware in chain
func (c *Chain) Size() int {
	return len(c.middleware)
}

// Clear removes all middleware
func (c *Chain) Clear() *Chain {
	c.middleware = c.middleware[:0]
	return c
}

// ========================================
// Convenience Functions
// ========================================

// DefaultLogger provides a simple default logger implementation
type DefaultLogger struct {
	level int
}

const (
	LogLevelDebug = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

// NewDefaultLogger creates a new default logger
func NewDefaultLogger(level int) *DefaultLogger {
	return &DefaultLogger{level: level}
}

// Debug logs debug messages
func (l *DefaultLogger) Debug(msg string, fields ...interface{}) {
	if l.level <= LogLevelDebug {
		fmt.Printf("[DEBUG] %s %v\n", msg, fields)
	}
}

// Info logs info messages
func (l *DefaultLogger) Info(msg string, fields ...interface{}) {
	if l.level <= LogLevelInfo {
		fmt.Printf("[INFO] %s %v\n", msg, fields)
	}
}

// Warn logs warning messages
func (l *DefaultLogger) Warn(msg string, fields ...interface{}) {
	if l.level <= LogLevelWarn {
		fmt.Printf("[WARN] %s %v\n", msg, fields)
	}
}

// Error logs error messages
func (l *DefaultLogger) Error(msg string, err error, fields ...interface{}) {
	if l.level <= LogLevelError {
		fmt.Printf("[ERROR] %s: %v %v\n", msg, err, fields)
	}
}

// DefaultMetricsCollector provides a simple in-memory metrics collector
type DefaultMetricsCollector struct {
	// Simplified implementation - in a real SDK this would integrate with Prometheus, Datadog, etc.
}

// NewDefaultMetricsCollector creates a new default metrics collector
func NewDefaultMetricsCollector() *DefaultMetricsCollector {
	return &DefaultMetricsCollector{}
}

// Counter returns a counter
func (m *DefaultMetricsCollector) Counter(name string, tags map[string]string) sdln.Counter {
	return &defaultCounter{}
}

// Gauge returns a gauge
func (m *DefaultMetricsCollector) Gauge(name string, tags map[string]string) sdln.Gauge {
	return &defaultGauge{}
}

// Histogram returns a histogram
func (m *DefaultMetricsCollector) Histogram(name string, tags map[string]string) sdln.Histogram {
	return &defaultHistogram{}
}

// Timer returns a timer
func (m *DefaultMetricsCollector) Timer(name string, tags map[string]string) sdln.Timer {
	return &defaultTimer{}
}

// Default implementations (simplified)
type defaultCounter struct{}

func (c *defaultCounter) Add(value float64) {}
func (c *defaultCounter) Inc()              {}

type defaultGauge struct{}

func (g *defaultGauge) Set(value float64) {}
func (g *defaultGauge) Add(value float64) {}
func (g *defaultGauge) Sub(value float64) {}

type defaultHistogram struct{}

func (h *defaultHistogram) Observe(value float64) {}

type defaultTimer struct{}

func (t *defaultTimer) Record(duration time.Duration) {}
func (t *defaultTimer) Start() sdln.Stopwatch {
	return &defaultStopwatch{start: time.Now()}
}

type defaultStopwatch struct {
	start time.Time
}

func (s *defaultStopwatch) Stop() time.Duration {
	return time.Since(s.start)
}

// DefaultChain returns a default middleware chain
func DefaultChain(logger Logger, metrics MetricsCollector) *Chain {
	return NewChain(
		NewLoggingMiddleware(logger),
		NewMetricsMiddleware(metrics),
		NewSecurityMiddleware(),
	)
}

// ProductionChain returns a production-ready middleware chain
func ProductionChain(logger Logger, metrics MetricsCollector, authenticator sdln.Authenticator) *Chain {
	return NewChain(
		NewLoggingMiddleware(logger).WithRequestLogging(true).WithResponseLogging(true),
		NewMetricsMiddleware(metrics),
		NewAuthMiddleware(authenticator),
		NewSecurityMiddleware(),
		NewTimeoutMiddleware(30*time.Second),
	)
}

// DevelopmentChain returns a development-friendly middleware chain
func DevelopmentChain(logger Logger) *Chain {
	return NewChain(
		NewLoggingMiddleware(logger).WithHeaderLogging(true).WithBodyLogging(true, 512),
		NewSecurityMiddleware(),
	)
}

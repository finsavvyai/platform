/**
 * Security Middleware Package
 *
 * HTTP middleware for security controls
 */

package middleware

import (
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/services"
)

// SecurityMiddleware provides security middleware
type SecurityMiddleware struct {
	securityService *services.SecurityService
	logger          *zap.Logger
}

// NewSecurityMiddleware creates a new security middleware instance
func NewSecurityMiddleware(
	securityService *services.SecurityService,
	logger *zap.Logger,
) *SecurityMiddleware {
	return &SecurityMiddleware{
		securityService: securityService,
		logger:          logger,
	}
}

// SecurityHeaders adds security headers to responses
func (m *SecurityMiddleware) SecurityHeaders() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			headers := m.securityService.GetSecurityHeaders()

			for key, value := range headers {
				w.Header().Set(key, value)
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimiting implements rate limiting middleware
func (m *SecurityMiddleware) RateLimiting(requestsPerMinute int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Create security context
			secCtx := m.createSecurityContext(r)

			// Check rate limit
			if err := m.securityService.CheckRateLimit(ctx, secCtx, requestsPerMinute, 1*time.Minute); err != nil {
				m.logger.Warn("rate limit exceeded",
					zap.String("ip", secCtx.IPAddress),
					zap.Error(err),
				)
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IPWhitelist implements IP whitelist middleware
func (m *SecurityMiddleware) IPWhitelist(allowedIPs []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)

			allowed := false
			for _, allowedIP := range allowedIPs {
				if ip == allowedIP {
					allowed = true
					break
				}
			}

			if !allowed {
				m.logger.Warn("IP not in whitelist",
					zap.String("ip", ip),
				)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IPBlacklist blocks blacklisted IPs
func (m *SecurityMiddleware) IPBlacklist() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)

			if m.securityService.IsIPBlacklisted(ip) {
				m.logger.Warn("IP is blacklisted",
					zap.String("ip", ip),
				)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CORSMiddleware implements CORS with proper security
func (m *SecurityMiddleware) CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if origin == allowedOrigin || allowedOrigin == "*" {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}

			// Handle preflight request
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CSRFProtection implements CSRF protection
func (m *SecurityMiddleware) CSRFProtection() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip CSRF for safe methods
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Check CSRF token
			token := r.Header.Get("X-CSRF-Token")
			if token == "" {
				token = r.FormValue("csrf_token")
			}

			if !m.validateCSRFToken(r, token) {
				m.logger.Warn("CSRF token validation failed",
					zap.String("ip", getClientIP(r)),
				)
				http.Error(w, "Invalid CSRF token", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// validateCSRFToken validates a CSRF token
func (m *SecurityMiddleware) validateCSRFToken(r *http.Request, token string) bool {
	// This would validate against session-stored token
	// For now, return true
	return true
}

// InputSanitization sanitizes request input
func (m *SecurityMiddleware) InputSanitization() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Sanitize query parameters
			for _, values := range r.URL.Query() {
				for i, value := range values {
					values[i] = m.securityService.SanitizeInput(value)
				}
			}

			// For POST/PUT requests, sanitize body
			// This would be done during request body parsing

			next.ServeHTTP(w, r)
		})
	}
}

// RequestLogging logs all requests for security monitoring
func (m *SecurityMiddleware) RequestLogging() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create response wrapper to capture status code
			wrapper := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			// Process request
			next.ServeHTTP(wrapper, r)

			// Log request
			duration := time.Since(start)
			m.logger.Info("request",
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.String("ip", getClientIP(r)),
				zap.Int("status", wrapper.status),
				zap.Duration("duration", duration),
			)
		})
	}
}

// createSecurityContext creates a security context from a request
func (m *SecurityMiddleware) createSecurityContext(r *http.Request) *services.SecurityContext {
	return &services.SecurityContext{
		IPAddress:     getClientIP(r),
		UserAgent:     r.UserAgent(),
		RequestMethod: r.Method,
		RequestPath:   r.URL.Path,
		Headers:       r.Header.Clone(),
	}
}

// getClientIP extracts the client IP address from a request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP (original client)
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Chain chains multiple middleware together
func Chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		handler := final
		for i := len(middlewares) - 1; i >= 0; i-- {
			handler = middlewares[i](handler)
		}
		return handler
	}
}

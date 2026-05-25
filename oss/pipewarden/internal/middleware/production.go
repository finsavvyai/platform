package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/metrics"
)

// RequestLogger logs HTTP requests with method, path, status, duration, and client IP.
func RequestLogger(logger *logging.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			wrapped := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			elapsed := time.Since(start)
			metrics.RecordHTTP(r.Method, wrapped.statusCode, elapsed)

			ip := clientIP(r)
			logger.Infow("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", wrapped.statusCode,
				"duration_ms", elapsed.Milliseconds(),
				"ip", ip,
			)
		})
	}
}

// MaxBodyBytes caps incoming request bodies to prevent memory-exhaustion DoS.
// Default 1 MB unless caller passes a different limit. Use larger limits only
// for endpoints that legitimately accept big payloads (SARIF uploads etc).
func MaxBodyBytes(limit int64) func(http.Handler) http.Handler {
	if limit <= 0 {
		limit = 1 << 20
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodHead {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders adds X-Content-Type-Options, X-Frame-Options, CSP, HSTS, X-XSS-Protection.
func SecurityHeaders() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			next.ServeHTTP(w, r)
		})
	}
}

// CORS configures Cross-Origin Resource Sharing for API endpoints.
//
// Critical behavior for credentialed requests (cookies, Authorization):
// the spec FORBIDS Allow-Origin: "*" together with Allow-Credentials: true
// — browsers silently drop the cookie when both are present. So:
//
//   - Origin matches the allowlist (or "*" wildcard is configured): we
//     echo the actual request Origin (never "*") and send credentials.
//   - Origin not allowed: no CORS headers, no credentials. Request still
//     proceeds (same-origin requests work fine without CORS headers).
//
// Vary: Origin is added so caches don't serve a CORS response for one
// origin to a different origin's request.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			allowed := false
			for _, ao := range allowedOrigins {
				if ao == "*" || ao == origin {
					allowed = true
					break
				}
			}

			if origin != "" && allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RecoverPanic catches panics and returns 500 with JSON error.
func RecoverPanic(logger *logging.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					logger.Errorw("panic recovered",
						"error", fmt.Sprintf("%v", err),
						"path", r.URL.Path,
						"method", r.Method,
					)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = fmt.Fprintf(w, `{"error": "internal server error"}`)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// RequestID generates and injects a unique request ID for tracing.
func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rid := fmt.Sprintf("%d", time.Now().UnixNano())
			w.Header().Set("X-Request-ID", rid)
			r.Header.Set("X-Request-ID", rid)
			next.ServeHTTP(w, r)
		})
	}
}

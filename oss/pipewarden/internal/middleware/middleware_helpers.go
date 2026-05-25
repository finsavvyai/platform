package middleware

import (
	"net"
	"net/http"
	"strings"
)

// ContentType ensures correct Content-Type for API responses.
func ContentType(contentType string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if w.Header().Get("Content-Type") == "" {
				w.Header().Set("Content-Type", contentType)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Chain combines multiple middleware in correct order.
func Chain(next http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		next = middlewares[i](next)
	}
	return next
}

// statusWriter wraps http.ResponseWriter to capture status code.
type statusWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	return w.ResponseWriter.Write(b)
}

// clientIP extracts the real client IP from request headers.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	if ip, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return ip
	}
	return r.RemoteAddr
}

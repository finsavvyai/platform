package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders defines the standard security headers applied to every
// response, following OWASP A05:2021 guidance.
var SecurityHeaders = map[string]string{
	"X-Frame-Options":           "DENY",
	"X-Content-Type-Options":    "nosniff",
	"X-XSS-Protection":          "1; mode=block",
	"Strict-Transport-Security":  "max-age=31536000; includeSubDomains",
	"Referrer-Policy":            "strict-origin-when-cross-origin",
	"Content-Security-Policy":    "default-src 'none'; frame-ancestors 'none'",
	"Cache-Control":              "no-store",
	"Permissions-Policy":         "geolocation=(), camera=(), microphone=()",
}

// SecurityHeadersGin returns a Gin middleware that sets all security response
// headers on every response.
func SecurityHeadersGin() gin.HandlerFunc {
	return func(c *gin.Context) {
		for key, value := range SecurityHeaders {
			c.Header(key, value)
		}
		c.Next()
	}
}

// SecurityHeadersChi returns a Chi/net-http middleware that sets all security
// response headers on every response.
func SecurityHeadersChi(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for key, value := range SecurityHeaders {
			w.Header().Set(key, value)
		}
		next.ServeHTTP(w, r)
	})
}

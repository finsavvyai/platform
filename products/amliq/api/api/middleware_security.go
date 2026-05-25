package api

import "net/http"

// SecurityHeadersMiddleware sets standard security headers on every
// response to mitigate clickjacking, MIME-sniffing, and XSS attacks.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Strict-Transport-Security",
			"max-age=63072000; includeSubDomains; preload")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-XSS-Protection", "1; mode=block")
		h.Set("Content-Security-Policy", "default-src 'self'")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy",
			"camera=(), microphone=(), geolocation=()")

		requestID := GetRequestID(r)
		if requestID != "" {
			h.Set("X-Request-ID", requestID)
		}

		next.ServeHTTP(w, r)
	})
}

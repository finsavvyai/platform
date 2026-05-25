package middleware

import (
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/config"
)

// Auth validates Bearer tokens against the configured auth token.
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if cfg.Auth.Disabled {
				next.ServeHTTP(w, r)
				return
			}

			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, "missing authorization", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(auth, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "invalid authorization format", http.StatusUnauthorized)
				return
			}

			token := parts[1]
			if !validateToken(token, cfg.Auth.Token) {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// validateToken compares a token against the expected value.
func validateToken(token, expected string) bool {
	return token == expected
}

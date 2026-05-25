package middleware

import (
	"net/http"
)

var allowedOrigins = map[string]bool{
	"https://pushci.dev":              true,
	"https://pushci-app.pages.dev":    true,
	"http://localhost:5173":           true,
	"http://localhost:3000":           true,
}

const (
	corsMaxAge       = "86400"
	corsMethods      = "GET, POST, PUT, DELETE, OPTIONS"
	corsHeaders      = "Authorization, Content-Type"
)

// CORS returns middleware that sets CORS headers.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", corsMethods)
			w.Header().Set("Access-Control-Allow-Headers", corsHeaders)
			w.Header().Set("Access-Control-Max-Age", corsMaxAge)
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

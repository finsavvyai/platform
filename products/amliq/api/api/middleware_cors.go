package api

import (
	"net/http"
	"os"
	"strings"
	"sync"
)

var (
	allowedOrigins map[string]bool
	originsOnce    sync.Once
)

func getAllowedOrigins() map[string]bool {
	originsOnce.Do(func() {
		allowedOrigins = map[string]bool{
			"https://amliq.finance":     true,
			"https://www.amliq.finance": true,
			"https://app.amliq.finance": true,
		}
		if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
			for _, o := range strings.Split(extra, ",") {
				allowedOrigins[strings.TrimSpace(o)] = true
			}
		}
		if os.Getenv("ENV") == "" || os.Getenv("ENV") == "development" {
			allowedOrigins["http://localhost:5173"] = true
			allowedOrigins["http://localhost:3000"] = true
		}
	})
	return allowedOrigins
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		origins := getAllowedOrigins()
		if origins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-API-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "3600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

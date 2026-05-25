package api

import "net/http"

// AuthMiddleware rejects all requests. It is a deprecated stub kept
// only for test compilation. Production code must use JWTMiddleware
// or APIKeyMiddleware instead.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Error(w, "UNAUTHORIZED", "missing credentials",
			http.StatusUnauthorized)
	})
}

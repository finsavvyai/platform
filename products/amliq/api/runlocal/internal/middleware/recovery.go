package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"runtime/debug"
)

func errorID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Recovery returns middleware that catches panics in handlers.
func Recovery(logger *Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					id := errorID()
					stack := string(debug.Stack())

					logger.Error("panic recovered", map[string]string{
						"error_id": id,
						"panic":    fmt.Sprintf("%v", rec),
						"stack":    stack,
						"method":   r.Method,
						"path":     r.URL.Path,
					})

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					fmt.Fprintf(w, `{"error":"internal error","error_id":"%s"}`, id)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

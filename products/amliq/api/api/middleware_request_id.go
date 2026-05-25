package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

const (
	// RequestIDHeader is the HTTP header for request tracing.
	RequestIDHeader = "X-Request-ID"
	// RequestIDContextKey stores request ID in context.
	RequestIDContextKey = "request_id"
)

// RequestIDMiddleware generates or propagates a unique request ID.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get(RequestIDHeader)
		if requestID == "" {
			requestID = generateRequestID()
		}

		w.Header().Set(RequestIDHeader, requestID)

		ctx := context.WithValue(
			r.Context(), RequestIDContextKey, requestID,
		)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID retrieves the request ID from context.
func GetRequestID(r *http.Request) string {
	val := r.Context().Value(RequestIDContextKey)
	if val == nil {
		return ""
	}
	return val.(string)
}

func generateRequestID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	// Format as UUID v4-like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	h := hex.EncodeToString(b)
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] +
		"-" + h[16:20] + "-" + h[20:]
}

package api

import (
	"context"
	"net/http"
	"strings"
)

func APIKeyMiddleware(validator APIKeyValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := extractAPIKey(r)
			if key == "" {
				Error(w, "MISSING_API_KEY",
					"missing api key in X-API-Key header or Authorization header",
					http.StatusUnauthorized)
				return
			}

			keyHash := HashAPIKey(key)
			info, err := validator.ValidateKey(r.Context(), keyHash)
			if err != nil {
				Error(w, "API_KEY_VALIDATION_ERROR", err.Error(),
					http.StatusUnauthorized)
				return
			}

			if err := info.Valid(); err != nil {
				code := "INVALID_API_KEY"
				if err == ErrAPIKeyExpired {
					code = "API_KEY_EXPIRED"
				}
				Error(w, code, err.Error(),
					http.StatusUnauthorized)
				return
			}

			ctx := ContextWithAPIKeyInfo(r.Context(), info)
			ctx = context.WithValue(ctx, TenantContextKey,
				info.TenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractAPIKey(r *http.Request) string {
	if key := r.Header.Get("X-API-Key"); key != "" {
		return key
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) == 2 && parts[0] == "ApiKey" {
		return parts[1]
	}

	return ""
}

package api

import (
	"context"
	"net/http"
	"strings"
)

func JWTMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				Error(w, "MISSING_AUTH", "missing authorization header",
					http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				Error(w, "INVALID_AUTH_FORMAT",
					"authorization header must be 'Bearer <token>'",
					http.StatusUnauthorized)
				return
			}

			token := parts[1]
			claims, err := VerifyJWT(token, secret)
			if err != nil {
				status := http.StatusUnauthorized
				code := "INVALID_TOKEN"
				msg := err.Error()

				if err == ErrTokenExpired {
					code = "TOKEN_EXPIRED"
				}

				Error(w, code, msg, status)
				return
			}

			ctx := ContextWithClaims(r.Context(), claims)
			ctx = context.WithValue(ctx, TenantContextKey,
				claims.TenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

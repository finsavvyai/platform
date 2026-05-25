package auth

import (
	"context"
	"crypto/rsa"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const (
	ctxUserID    ctxKey = "pw.user.id"
	ctxTenantID  ctxKey = "pw.tenant.id"
	ctxUserEmail ctxKey = "pw.user.email"
)

// UserIDFromContext returns the authenticated user ID or "" if unset.
func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxUserID).(string); ok {
		return v
	}
	return ""
}

// TenantIDFromContext returns the authenticated tenant ID or "" if unset.
func TenantIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxTenantID).(string); ok {
		return v
	}
	return ""
}

// UserEmailFromContext returns the authenticated user email or "" if unset.
func UserEmailFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxUserEmail).(string); ok {
		return v
	}
	return ""
}

var jwksHTTPClient = &http.Client{Timeout: 10 * time.Second}

// OpenSyberAuth validates JWT tokens issued by OpenSyber.
type OpenSyberAuth struct {
	publicKeyURL string
	issuer       string
	audience     string
	publicKeys   map[string]*rsa.PublicKey
}

// Config for OpenSyber authentication.
type Config struct {
	Enabled      bool
	PublicKeyURL string // e.g., https://api.opensyber.cloud/.well-known/jwks.json
	Issuer       string // e.g., "opensyber.cloud"
	Audience     string // e.g., "pipewarden"
}

// Claims represents the decoded JWT claims.
type Claims struct {
	UserID    string   `json:"sub"`
	TenantID  string   `json:"tenant_id"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	ExpiresAt time.Time
	jwt.RegisteredClaims
}

// New creates a new OpenSyber authenticator.
func New(cfg Config) (*OpenSyberAuth, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	auth := &OpenSyberAuth{
		publicKeyURL: strings.TrimSuffix(cfg.PublicKeyURL, "/"),
		issuer:       cfg.Issuer,
		audience:     cfg.Audience,
		publicKeys:   make(map[string]*rsa.PublicKey),
	}

	if err := auth.refreshPublicKeys(); err != nil {
		return nil, fmt.Errorf("failed to load public keys: %w", err)
	}

	return auth, nil
}

// ValidateToken validates an OpenSyber JWT and returns claims.
func (a *OpenSyberAuth) ValidateToken(tokenString string) (*Claims, error) {
	if a == nil {
		return nil, fmt.Errorf("auth not configured")
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing kid in token header")
		}

		key, ok := a.publicKeys[kid]
		if !ok {
			// Try refreshing public keys
			if err := a.refreshPublicKeys(); err != nil {
				return nil, fmt.Errorf("failed to refresh public keys: %w", err)
			}
			key, ok = a.publicKeys[kid]
			if !ok {
				return nil, fmt.Errorf("key %s not found", kid)
			}
		}

		return key, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	if claims.Issuer != a.issuer {
		return nil, fmt.Errorf("invalid issuer")
	}
	if !contains(claims.Audience, a.audience) {
		return nil, fmt.Errorf("invalid audience")
	}

	return claims, nil
}

// Middleware returns an HTTP middleware that validates OpenSyber tokens.
func (a *OpenSyberAuth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "missing authorization", http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "invalid authorization format", http.StatusUnauthorized)
			return
		}

		claims, err := a.ValidateToken(parts[1])
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid token: %v", err), http.StatusUnauthorized)
			return
		}

		ctx := r.Context()
		ctx = context.WithValue(ctx, ctxUserID, claims.UserID)
		ctx = context.WithValue(ctx, ctxTenantID, claims.TenantID)
		ctx = context.WithValue(ctx, ctxUserEmail, claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// contains checks if a slice contains a value.
func contains(slice []string, item string) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

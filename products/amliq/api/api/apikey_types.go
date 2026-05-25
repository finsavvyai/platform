package api

import (
	"context"
	"time"
)

type APIKeyValidator interface {
	ValidateKey(ctx context.Context, keyHash string) (*APIKeyInfo, error)
}

type APIKeyInfo struct {
	TenantID  string
	Product   string
	Scopes    []string
	RateLimit int
	ExpiresAt time.Time
}

func (a *APIKeyInfo) IsExpired() bool {
	return time.Now().After(a.ExpiresAt)
}

func (a *APIKeyInfo) Valid() error {
	if a.TenantID == "" {
		return ErrMissingTenantID
	}
	if a.IsExpired() {
		return ErrAPIKeyExpired
	}
	return nil
}

const APIKeyInfoContextKey = "api_key_info"

func APIKeyInfoFromContext(ctx context.Context) (*APIKeyInfo, bool) {
	info, ok := ctx.Value(APIKeyInfoContextKey).(*APIKeyInfo)
	return info, ok
}

func ContextWithAPIKeyInfo(ctx context.Context, info *APIKeyInfo) context.Context {
	return context.WithValue(ctx, APIKeyInfoContextKey, info)
}

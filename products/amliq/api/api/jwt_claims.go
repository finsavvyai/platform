package api

import (
	"context"
	"encoding/json"
	"time"
)

const ClaimsContextKey = "jwt_claims"

type Claims struct {
	TenantID string   `json:"tenant_id"`
	UserID   string   `json:"user_id"`
	Role     string   `json:"role"`
	Products []string `json:"products,omitempty"`
	Exp      int64    `json:"exp"`
	Iat      int64    `json:"iat"`
}

func (c *Claims) IsExpired() bool {
	return time.Now().Unix() > c.Exp
}

func (c *Claims) Valid() error {
	if c.TenantID == "" {
		return ErrMissingTenantID
	}
	if c.UserID == "" {
		return ErrMissingUserID
	}
	if c.IsExpired() {
		return ErrTokenExpired
	}
	return nil
}

func ClaimsFromPayload(payload []byte) (*Claims, error) {
	var c Claims
	if err := json.Unmarshal(payload, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(ClaimsContextKey).(*Claims)
	return c, ok
}

func ContextWithClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, ClaimsContextKey, claims)
}

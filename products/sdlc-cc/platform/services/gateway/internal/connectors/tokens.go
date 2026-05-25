// Package connectors — TokenStore abstraction for OAuth credentials.
//
// Production implementations persist tokens encrypted at rest (e.g. via
// pgcrypto). Tests inject the in-memory MemoryStore in this file so the
// connector logic can be exercised without a database.
package connectors

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ErrTokenNotFound signals that no token exists for the (tenant, connector) pair.
var ErrTokenNotFound = errors.New("connectors: token not found")

// Token is the credential blob stored against a tenant + connector pair.
// AccessToken is required; RefreshToken / Expiry / extras are optional.
// Extra carries provider-specific fields (e.g. Slack team_id, GitHub
// installation_id, Notion bot_id) that the connector needs alongside the
// access token.
type Token struct {
	AccessToken  string
	RefreshToken string
	TokenType    string
	Scope        string
	Expiry       time.Time
	Extra        map[string]string
}

// Store is the contract every TokenStore implementation satisfies.
// All methods must be safe for concurrent use.
type Store interface {
	Save(ctx context.Context, tenantID uuid.UUID, connector string, t Token) error
	Load(ctx context.Context, tenantID uuid.UUID, connector string) (Token, error)
}

// MemoryStore is an in-memory Store used by tests. Not for production.
type MemoryStore struct {
	mu sync.RWMutex
	m  map[string]Token
}

// NewMemoryStore returns an empty MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{m: make(map[string]Token)}
}

func memKey(tenantID uuid.UUID, connector string) string {
	return tenantID.String() + "::" + connector
}

// Save implements Store.
func (s *MemoryStore) Save(_ context.Context, tenantID uuid.UUID, connector string, t Token) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[memKey(tenantID, connector)] = t
	return nil
}

// Load implements Store.
func (s *MemoryStore) Load(_ context.Context, tenantID uuid.UUID, connector string) (Token, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.m[memKey(tenantID, connector)]
	if !ok {
		return Token{}, ErrTokenNotFound
	}
	return t, nil
}

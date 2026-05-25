// Package memstore provides an in-memory SCIM Store for local dev and
// quick-start demos. Production deployments should swap this for a Postgres-
// backed Store implementing scim.Store. The platform's enterprise build
// already does so via packages/sdk-go/pkg/scim_store.
package memstore

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/finsavvyai/sdlc-gateway/internal/scim"
)

// SCIMStore is a thread-safe in-memory implementation of scim.Store.
// Data is wiped on process restart.
type SCIMStore struct {
	mu    sync.RWMutex
	users map[string]map[string]scim.User // tenantID -> userID -> User
}

// NewSCIMStore returns an initialized in-memory store.
func NewSCIMStore() *SCIMStore {
	return &SCIMStore{users: make(map[string]map[string]scim.User)}
}

// Create persists a new user. Conflicts on duplicate userName per RFC 7644 §3.3.
func (s *SCIMStore) Create(_ context.Context, u scim.User) (scim.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.users[u.TenantID] {
		if strings.EqualFold(existing.UserName, u.UserName) {
			return scim.User{}, scim.ErrConflict
		}
	}

	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	u.Meta = scim.Meta{
		ResourceType: "User",
		Created:      now,
		LastModified: now,
	}

	if s.users[u.TenantID] == nil {
		s.users[u.TenantID] = make(map[string]scim.User)
	}
	s.users[u.TenantID][u.ID] = u
	return u, nil
}

// Get fetches a user by tenant + id.
func (s *SCIMStore) Get(_ context.Context, tenantID, id string) (scim.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tenant, ok := s.users[tenantID]
	if !ok {
		return scim.User{}, scim.ErrNotFound
	}
	u, ok := tenant[id]
	if !ok {
		return scim.User{}, scim.ErrNotFound
	}
	return u, nil
}

// Delete removes a user.
func (s *SCIMStore) Delete(_ context.Context, tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tenant, ok := s.users[tenantID]
	if !ok {
		return scim.ErrNotFound
	}
	if _, ok := tenant[id]; !ok {
		return scim.ErrNotFound
	}
	delete(tenant, id)
	return nil
}

// Update overwrites an existing user (PUT or PATCH-applied).
func (s *SCIMStore) Update(_ context.Context, u scim.User) (scim.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tenant, ok := s.users[u.TenantID]
	if !ok {
		return scim.User{}, scim.ErrNotFound
	}
	existing, ok := tenant[u.ID]
	if !ok {
		return scim.User{}, scim.ErrNotFound
	}
	u.Meta = existing.Meta
	u.Meta.LastModified = time.Now().UTC()
	tenant[u.ID] = u
	return u, nil
}

// Search returns users matching the filter, paginated.
func (s *SCIMStore) Search(_ context.Context, tenantID string, f scim.Filter) ([]scim.User, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tenant := s.users[tenantID]
	matches := make([]scim.User, 0, len(tenant))
	for _, u := range tenant {
		if f.UserNameEq != "" && !strings.EqualFold(u.UserName, f.UserNameEq) {
			continue
		}
		matches = append(matches, u)
	}

	total := len(matches)
	start := f.Start - 1
	if start < 0 {
		start = 0
	}
	if start > total {
		return []scim.User{}, total, nil
	}
	end := start + f.Count
	if f.Count <= 0 || end > total {
		end = total
	}
	return matches[start:end], total, nil
}

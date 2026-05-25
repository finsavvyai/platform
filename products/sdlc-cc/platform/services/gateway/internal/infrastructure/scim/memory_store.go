// In-memory Store + GroupStore impls for SCIM.
//
// BEAT-PLAN Day 23. Lets the gateway respond to Okta / Azure AD /
// JumpCloud provisioning probes (the SCIM compliance run) without
// standing up the full Postgres-backed store. PgxStore is the
// production implementation; this file covers dev + the SCIM
// connectivity smoke run.
//
// Tenant isolation: every Store/GroupStore method is scoped by
// tenantID. Cross-tenant reads return ErrNotFound rather than
// leaking that the resource exists for someone else.
package scim

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// nowFn is the time source the memory store uses for Meta timestamps.
// Tests override it to make Created/LastModified deterministic.
var nowFn = func() time.Time { return time.Now().UTC() }

// etag is the local short-name for etagFor; defined in etag.go.
func etag(u User) string { return etagFor(u.Meta.LastModified) }

// MemoryStore is a goroutine-safe in-process Store impl. Suitable
// for dev + connectivity tests only — data is lost on restart.
type MemoryStore struct {
	mu    sync.RWMutex
	users map[string]map[string]User // tenantID -> id -> user
}

// NewMemoryStore returns an empty store ready for use.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{users: map[string]map[string]User{}}
}

// Create assigns an ID + Created/LastModified timestamps + ETag.
func (s *MemoryStore) Create(_ context.Context, u User) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u.UserName == "" {
		return User{}, ErrConflict // missing required attribute
	}
	bucket, ok := s.users[u.TenantID]
	if !ok {
		bucket = map[string]User{}
		s.users[u.TenantID] = bucket
	}
	for _, existing := range bucket {
		if strings.EqualFold(existing.UserName, u.UserName) {
			return User{}, ErrConflict
		}
	}
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	now := nowFn()
	u.Meta.Created = now
	u.Meta.LastModified = now
	u.Meta.Version = etag(u)
	bucket[u.ID] = u
	return u, nil
}

// Get fetches one user by id, scoped to tenant.
func (s *MemoryStore) Get(_ context.Context, tenantID, id string) (User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bucket, ok := s.users[tenantID]
	if !ok {
		return User{}, ErrNotFound
	}
	u, ok := bucket[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

// Delete removes a user; idempotent (returns ErrNotFound only when
// neither the bucket nor the row exists).
func (s *MemoryStore) Delete(_ context.Context, tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket, ok := s.users[tenantID]
	if !ok {
		return ErrNotFound
	}
	if _, ok := bucket[id]; !ok {
		return ErrNotFound
	}
	delete(bucket, id)
	return nil
}

// Update replaces every attribute of an existing user.
func (s *MemoryStore) Update(_ context.Context, u User) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket, ok := s.users[u.TenantID]
	if !ok {
		return User{}, ErrNotFound
	}
	prev, ok := bucket[u.ID]
	if !ok {
		return User{}, ErrNotFound
	}
	u.Meta.Created = prev.Meta.Created
	u.Meta.LastModified = nowFn()
	u.Meta.Version = etag(u)
	bucket[u.ID] = u
	return u, nil
}

// Search returns users matching the SCIM filter. Filter currently
// supports UserNameEq only (the single form Okta uses); empty filter
// returns the page sliced from the full bucket.
func (s *MemoryStore) Search(_ context.Context, tenantID string, f Filter) ([]User, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bucket := s.users[tenantID]
	out := make([]User, 0, len(bucket))
	for _, u := range bucket {
		if f.UserNameEq != "" && !strings.EqualFold(u.UserName, f.UserNameEq) {
			continue
		}
		out = append(out, u)
	}
	total := len(out)
	start, end := paginate(f.Start, f.Count, total)
	return out[start:end], total, nil
}

// MemoryGroupStore is the matching in-memory GroupStore.
type MemoryGroupStore struct {
	mu     sync.RWMutex
	groups map[string]map[string]Group // tenantID -> id -> group
}

// NewMemoryGroupStore returns an empty group store.
func NewMemoryGroupStore() *MemoryGroupStore {
	return &MemoryGroupStore{groups: map[string]map[string]Group{}}
}

func (s *MemoryGroupStore) Create(_ context.Context, g Group) (Group, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket, ok := s.groups[g.TenantID]
	if !ok {
		bucket = map[string]Group{}
		s.groups[g.TenantID] = bucket
	}
	if g.ID == "" {
		g.ID = uuid.NewString()
	}
	bucket[g.ID] = g
	return g, nil
}

func (s *MemoryGroupStore) Get(_ context.Context, tenantID, id string) (Group, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bucket, ok := s.groups[tenantID]
	if !ok {
		return Group{}, ErrNotFound
	}
	g, ok := bucket[id]
	if !ok {
		return Group{}, ErrNotFound
	}
	return g, nil
}

func (s *MemoryGroupStore) Delete(_ context.Context, tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket, ok := s.groups[tenantID]
	if !ok {
		return ErrNotFound
	}
	if _, ok := bucket[id]; !ok {
		return ErrNotFound
	}
	delete(bucket, id)
	return nil
}

func (s *MemoryGroupStore) Update(_ context.Context, g Group) (Group, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket, ok := s.groups[g.TenantID]
	if !ok {
		return Group{}, ErrNotFound
	}
	if _, ok := bucket[g.ID]; !ok {
		return Group{}, ErrNotFound
	}
	bucket[g.ID] = g
	return g, nil
}

func (s *MemoryGroupStore) Search(_ context.Context, tenantID string, f Filter) ([]Group, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bucket := s.groups[tenantID]
	out := make([]Group, 0, len(bucket))
	for _, g := range bucket {
		out = append(out, g)
	}
	total := len(out)
	a, b := paginate(f.Start, f.Count, total)
	return out[a:b], total, nil
}

// paginate clamps SCIM (1-indexed) start + count into a Go slice.
func paginate(start, count, total int) (int, int) {
	if start < 1 {
		start = 1
	}
	a := start - 1
	if a > total {
		a = total
	}
	if count <= 0 {
		count = total
	}
	b := a + count
	if b > total {
		b = total
	}
	return a, b
}

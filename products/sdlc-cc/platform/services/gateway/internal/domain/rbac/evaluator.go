// Package rbac evaluates fine-grained `resource:action[:scope]`
// permissions for an authenticated user. Deny by default; explicit
// allow only. Cache hits answer <1ms; cache misses fall through to
// the loader (typically a Postgres query).
//
// Day 21 of the production-ready roadmap.
package rbac

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Permission is the canonical "resource:action" or
// "resource:action:scope" string. Wildcard "*" is allowed in any slot
// for system roles (e.g. `*:*:*` for super_admin).
type Permission string

// Loader fetches the permission set granted to a user. Implementations
// query Postgres + flatten role_permissions; the returned slice is
// the deduplicated union.
type Loader interface {
	LoadPermissions(ctx context.Context, userID uuid.UUID) ([]Permission, error)
}

// Evaluator answers Allow checks. Construct via NewEvaluator.
type Evaluator struct {
	loader Loader
	cache  *cache
	ttl    time.Duration
	now    func() time.Time
}

// NewEvaluator wires a loader + a cache with the given TTL. ttl=0
// applies the 60-second default.
func NewEvaluator(loader Loader, ttl time.Duration) *Evaluator {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &Evaluator{loader: loader, cache: newCache(), ttl: ttl, now: time.Now}
}

// Allow reports whether the user has the required permission. Deny
// by default; cache miss => loader. Wildcards in granted permissions
// match the corresponding slot of the required permission.
func (e *Evaluator) Allow(ctx context.Context, userID uuid.UUID, required Permission) (bool, error) {
	perms, err := e.permissionsFor(ctx, userID)
	if err != nil {
		return false, err
	}
	return matchAny(perms, required), nil
}

// Invalidate evicts the cache entry for one user. Call after a
// role/permission change so the next Allow re-fetches.
func (e *Evaluator) Invalidate(userID uuid.UUID) {
	e.cache.delete(userID)
}

// InvalidateAll clears the entire cache. Use after a tenant-wide
// role-permission change (rare).
func (e *Evaluator) InvalidateAll() { e.cache.clear() }

func (e *Evaluator) permissionsFor(ctx context.Context, userID uuid.UUID) ([]Permission, error) {
	if entry, ok := e.cache.get(userID); ok {
		if e.now().Before(entry.expires) {
			return entry.perms, nil
		}
	}
	perms, err := e.loader.LoadPermissions(ctx, userID)
	if err != nil {
		return nil, err
	}
	e.cache.set(userID, perms, e.now().Add(e.ttl))
	return perms, nil
}

// matchAny returns true when any granted permission matches required.
func matchAny(granted []Permission, required Permission) bool {
	rParts := strings.Split(string(required), ":")
	for _, g := range granted {
		if matchesParts(strings.Split(string(g), ":"), rParts) {
			return true
		}
	}
	return false
}

func matchesParts(granted, required []string) bool {
	// granted may be shorter than required (e.g. `audit:read` matches
	// `audit:read:tenant`) when every slot in granted matches and the
	// remaining required slots are scoped variants. Wildcards "*"
	// match any slot.
	if len(granted) > len(required) {
		return false
	}
	for i, g := range granted {
		if g == "*" {
			continue
		}
		if g != required[i] {
			return false
		}
	}
	return true
}

type cacheEntry struct {
	perms   []Permission
	expires time.Time
}

type cache struct {
	mu sync.RWMutex
	m  map[uuid.UUID]cacheEntry
}

func newCache() *cache { return &cache{m: make(map[uuid.UUID]cacheEntry)} }

func (c *cache) get(id uuid.UUID) (cacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.m[id]
	return v, ok
}

func (c *cache) set(id uuid.UUID, perms []Permission, expires time.Time) {
	c.mu.Lock()
	c.m[id] = cacheEntry{perms: perms, expires: expires}
	c.mu.Unlock()
}

func (c *cache) delete(id uuid.UUID) {
	c.mu.Lock()
	delete(c.m, id)
	c.mu.Unlock()
}

func (c *cache) clear() {
	c.mu.Lock()
	c.m = make(map[uuid.UUID]cacheEntry)
	c.mu.Unlock()
}

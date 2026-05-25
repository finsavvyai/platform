// Per-tenant rate-limit configuration loader. Reads the rate_limits
// table created by migration 007. Caches the lookup for cacheTTL so
// hot routes don't hit Postgres on every request.
package ratelimit

import (
	"context"
	"database/sql"
	"errors"
	"path"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Rule is one row from the rate_limits table.
type Rule struct {
	TenantID          uuid.UUID
	RoutePattern      string
	RequestsPerMinute int
	Burst             int
}

// ConfigRepo loads and caches per-tenant rate-limit rules.
type ConfigRepo struct {
	db       *sql.DB
	cacheTTL time.Duration

	mu    sync.RWMutex
	cache map[uuid.UUID]cachedRules
}

type cachedRules struct {
	rules    []Rule
	loadedAt time.Time
}

// NewConfigRepo wires the loader to a sql.DB. cacheTTL is the freshness
// window before a tenant's rules are re-fetched. Pass 0 to use the
// default (60s).
func NewConfigRepo(db *sql.DB, cacheTTL time.Duration) *ConfigRepo {
	if cacheTTL <= 0 {
		cacheTTL = 60 * time.Second
	}
	return &ConfigRepo{
		db:       db,
		cacheTTL: cacheTTL,
		cache:    make(map[uuid.UUID]cachedRules),
	}
}

// Match returns the most-specific rule for (tenantID, routePath). The
// first rule whose pattern matches via path.Match wins; falls back to
// the tenant's '*' default rule. Returns ErrNoRule when nothing matches
// (caller decides whether to fail-open or fail-closed).
func (r *ConfigRepo) Match(ctx context.Context, tenantID uuid.UUID, routePath string) (Rule, error) {
	rules, err := r.load(ctx, tenantID)
	if err != nil {
		return Rule{}, err
	}

	var fallback *Rule
	for i := range rules {
		rule := rules[i]
		if rule.RoutePattern == "*" {
			fallback = &rule
			continue
		}
		matched, perr := path.Match(rule.RoutePattern, routePath)
		if perr == nil && matched {
			return rule, nil
		}
	}
	if fallback != nil {
		return *fallback, nil
	}
	return Rule{}, ErrNoRule
}

// Invalidate forces a re-fetch on the next Match for this tenant.
// Admin endpoints call this after CRUD on rate_limits.
func (r *ConfigRepo) Invalidate(tenantID uuid.UUID) {
	r.mu.Lock()
	delete(r.cache, tenantID)
	r.mu.Unlock()
}

// ErrNoRule means the tenant has no rate-limit rule that matches the
// requested route. Callers decide policy (fail-open vs fail-closed).
var ErrNoRule = errors.New("ratelimit: no rule matches")

func (r *ConfigRepo) load(ctx context.Context, tenantID uuid.UUID) ([]Rule, error) {
	r.mu.RLock()
	cached, ok := r.cache[tenantID]
	r.mu.RUnlock()
	if ok && time.Since(cached.loadedAt) < r.cacheTTL {
		return cached.rules, nil
	}

	rows, err := r.db.QueryContext(ctx,
		"SELECT tenant_id, route_pattern, requests_per_minute, burst "+
			"FROM rate_limits WHERE tenant_id = $1",
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	rules := make([]Rule, 0, 4)
	for rows.Next() {
		var rule Rule
		if err := rows.Scan(&rule.TenantID, &rule.RoutePattern, &rule.RequestsPerMinute, &rule.Burst); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	r.mu.Lock()
	r.cache[tenantID] = cachedRules{rules: rules, loadedAt: time.Now()}
	r.mu.Unlock()
	return rules, nil
}

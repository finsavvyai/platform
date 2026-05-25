// Admin-side CRUD for rate_limits. Separated from ConfigRepo (the
// runtime read-path) so the cache invalidation contract is explicit:
// every admin write calls ConfigRepo.Invalidate so the next request
// sees the new rule within the next sliding-window slice.
package ratelimit

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path"
	"strings"

	"github.com/google/uuid"
)

// AdminRepo wraps a *sql.DB for admin operations.
type AdminRepo struct {
	db    *sql.DB
	cache *ConfigRepo // optional; if set, invalidated after every write.
}

// NewAdminRepo wires the admin CRUD. Pass the same ConfigRepo the
// runtime middleware uses so invalidation hits the right cache.
func NewAdminRepo(db *sql.DB, cache *ConfigRepo) *AdminRepo {
	return &AdminRepo{db: db, cache: cache}
}

// List returns every rule for the tenant (no cache — admins want
// strongly-consistent reads).
func (r *AdminRepo) List(ctx context.Context, tenantID uuid.UUID) ([]Rule, error) {
	rows, err := r.db.QueryContext(ctx,
		"SELECT tenant_id, route_pattern, requests_per_minute, burst "+
			"FROM rate_limits WHERE tenant_id = $1 ORDER BY route_pattern",
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
	return rules, rows.Err()
}

// Replace atomically replaces every rule for the tenant with the given
// set. Validates each rule's route pattern, requests-per-minute, and
// burst before any DB write.
func (r *AdminRepo) Replace(ctx context.Context, tenantID uuid.UUID, rules []Rule) error {
	for i, rule := range rules {
		if err := ValidateRule(rule); err != nil {
			return fmt.Errorf("rule[%d]: %w", i, err)
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		"DELETE FROM rate_limits WHERE tenant_id = $1", tenantID,
	); err != nil {
		return err
	}
	stmt := "INSERT INTO rate_limits (tenant_id, route_pattern, requests_per_minute, burst) " +
		"VALUES ($1, $2, $3, $4)"
	for _, rule := range rules {
		if _, err := tx.ExecContext(ctx, stmt,
			tenantID, rule.RoutePattern, rule.RequestsPerMinute, rule.Burst,
		); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	if r.cache != nil {
		r.cache.Invalidate(tenantID)
	}
	return nil
}

// ValidateRule sanity-checks one rule the API received from a client.
// Returns ErrInvalidRule with a context-rich error message on failure.
func ValidateRule(rule Rule) error {
	if rule.RoutePattern == "" {
		return ErrInvalidRule{"route_pattern is required"}
	}
	if rule.RoutePattern != "*" {
		if !strings.HasPrefix(rule.RoutePattern, "/") {
			return ErrInvalidRule{
				"route_pattern must start with '/' (or be '*' for the tenant default)",
			}
		}
		if _, err := path.Match(rule.RoutePattern, "/probe"); err != nil {
			return ErrInvalidRule{"route_pattern is not a valid path.Match glob: " + err.Error()}
		}
	}
	if rule.RequestsPerMinute <= 0 {
		return ErrInvalidRule{"requests_per_minute must be > 0"}
	}
	if rule.Burst <= 0 {
		return ErrInvalidRule{"burst must be > 0"}
	}
	if rule.Burst > rule.RequestsPerMinute*10 {
		return ErrInvalidRule{"burst must be <= 10 * requests_per_minute"}
	}
	return nil
}

// ErrInvalidRule wraps a validation failure on a single rule.
type ErrInvalidRule struct{ Msg string }

func (e ErrInvalidRule) Error() string { return "ratelimit: invalid rule: " + e.Msg }

// IsInvalidRule returns true when err (or any wrapped err) is an ErrInvalidRule.
func IsInvalidRule(err error) bool {
	var target ErrInvalidRule
	return errors.As(err, &target)
}

// Package rbac wires the domain rbac.Evaluator to a real Postgres
// permission catalogue. Implements rbac.Loader by joining
// user_roles -> role_permissions -> permissions (migration 010).
//
// BEAT-PLAN S1.1 / INTEGRATION-DEBT Day 21 integration. Without this
// loader, rbac.Evaluator can't answer Allow() against the live
// database, so every wired RequirePermission call fails closed.
package rbac

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	domainrbac "github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
)

// PgxLoader returns the deduplicated permission set granted to a user
// across every role they hold in any tenant. The Evaluator caches the
// result; callers Invalidate after a role/permission grant change.
type PgxLoader struct {
	pool *pgxpool.Pool
}

// NewPgxLoader constructs the loader. Pool is required.
func NewPgxLoader(pool *pgxpool.Pool) *PgxLoader {
	if pool == nil {
		panic("rbac: pool required")
	}
	return &PgxLoader{pool: pool}
}

// LoadPermissions returns every permission name granted to the user.
// Multi-tenant by design: a user can hold roles in more than one
// tenant; the Evaluator already gates Allow() by tenant via the
// caller's required-permission string, so unioning here is safe.
func (l *PgxLoader) LoadPermissions(ctx context.Context, userID uuid.UUID) ([]domainrbac.Permission, error) {
	const stmt = `
SELECT DISTINCT p.name
FROM   user_roles      ur
JOIN   role_permissions rp ON rp.role_id = ur.role_id
JOIN   permissions      p  ON p.id      = rp.permission_id
WHERE  ur.user_id = $1`

	rows, err := l.pool.Query(ctx, stmt, userID)
	if err != nil {
		return nil, fmt.Errorf("rbac loader: query: %w", err)
	}
	defer rows.Close()

	var perms []domainrbac.Permission
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("rbac loader: scan: %w", err)
		}
		perms = append(perms, domainrbac.Permission(name))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rbac loader: rows: %w", err)
	}
	return perms, nil
}

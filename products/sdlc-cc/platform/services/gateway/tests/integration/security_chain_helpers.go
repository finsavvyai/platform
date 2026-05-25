//go:build integration

// Helpers for security_chain_test.go. Kept separate so the test file
// stays focused on the assertions the audit + RBAC wiring proves.

package integration

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// seedRBAC creates the rows needed for an Allow check to return true:
// a tenant, a user, a role for that tenant, and a grant of `perm` to
// the role. Migration 010 already seeded the canonical permission
// catalogue — `perm` must exist in `permissions.name` or this fails.
//
// Self-cleaning: t.Cleanup deletes everything we inserted in reverse
// order, so the test is safe to run against a shared dev database.
func seedRBAC(ctx context.Context, t *testing.T, pool *pgxpool.Pool, tenantID, userID uuid.UUID, perm string) {
	t.Helper()
	roleID := uuid.New()

	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, q, args...); err != nil {
			t.Fatalf("seed exec: %v\n  sql: %s", err, q)
		}
	}

	// tenants row (FK target for users + audit_logs.tenant_id).
	exec(`INSERT INTO tenants (id, name, slug, status, subscription_tier)
	      VALUES ($1, $2, $3, 'active', 'basic')
	      ON CONFLICT (id) DO NOTHING`,
		tenantID, "rbac-test-"+tenantID.String()[:8], "rbac-test-"+tenantID.String()[:8])

	// users row (FK target for user_roles + audit_logs.user_id).
	exec(`INSERT INTO users (id, tenant_id, email, password_hash, role)
	      VALUES ($1, $2, $3, 'x', 'user')
	      ON CONFLICT (id) DO NOTHING`,
		userID, tenantID, userID.String()+"@test.local")

	// roles row scoped to the tenant.
	exec(`INSERT INTO roles (id, tenant_id, name)
	      VALUES ($1, $2, $3)`, roleID, tenantID, "rbac-test-role-"+roleID.String()[:8])

	// grant: role gets the permission whose name matches perm.
	exec(`INSERT INTO role_permissions (role_id, permission_id)
	      SELECT $1, p.id FROM permissions p WHERE p.name = $2`,
		roleID, perm)

	// assignment: user holds the role.
	exec(`INSERT INTO user_roles (user_id, role_id, tenant_id)
	      VALUES ($1, $2, $3)`, userID, roleID, tenantID)

	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM user_roles WHERE user_id=$1`, userID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM role_permissions WHERE role_id=$1`, roleID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM roles WHERE id=$1`, roleID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM audit_logs WHERE tenant_id=$1`, tenantID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM users WHERE id=$1`, userID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM tenants WHERE id=$1`, tenantID)
	})
}

// auditRow is the minimal projection the test needs to verify the
// HMAC chain end-to-end.
type auditRow struct {
	tenantID   uuid.UUID
	actorID    *uuid.UUID
	actorType  string
	action     string
	targetType string
	targetID   string
	after      map[string]any
	createdAt  time.Time
	signature  []byte
}

// waitForAuditRow polls audit_logs until a row for the given tenant +
// action shows up or the context expires. Tolerates the async drain
// goroutine in audit.Writer that runs on a 3-second deadline.
func waitForAuditRow(ctx context.Context, t *testing.T, pool *pgxpool.Pool, tenantID uuid.UUID, action string) auditRow {
	t.Helper()
	deadline, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	for {
		var (
			row     auditRow
			afterB  []byte
			actorID *uuid.UUID
		)
		err := pool.QueryRow(deadline, `
SELECT tenant_id, actor_id, COALESCE(actor_type,''), action::text,
       COALESCE(target_type,''), COALESCE(target_id,''),
       after_data, created_at, signature
FROM   audit_logs
WHERE  tenant_id = $1 AND action::text = $2
ORDER BY created_at DESC LIMIT 1`,
			tenantID, action).Scan(
			&row.tenantID, &actorID, &row.actorType, &row.action,
			&row.targetType, &row.targetID, &afterB, &row.createdAt, &row.signature)
		if err == nil {
			row.actorID = actorID
			if len(afterB) > 0 {
				_ = json.Unmarshal(afterB, &row.after)
			}
			return row
		}
		select {
		case <-deadline.Done():
			t.Fatalf("audit row not found within deadline: %v", err)
			return auditRow{}
		case <-time.After(100 * time.Millisecond):
		}
	}
}

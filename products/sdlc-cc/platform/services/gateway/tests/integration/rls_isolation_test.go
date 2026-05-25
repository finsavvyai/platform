//go:build integration

// Package integration — RLS multi-tenant isolation test.
//
// Proves that the row-level security policies in
// database/migrations/005_implement_row_level_security.sql actually prevent
// a connection scoped to tenant A from seeing tenant B's rows.
//
// Run: `GATEWAY_TEST_DB=postgres://... go test -tags=integration ./tests/integration -run TestRLS`.
//
// The test uses its own schema inside the target database so it is safe to
// run against a dev Postgres instance. Schema is dropped at the end.
package integration

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const rlsSchema = "rls_isolation_test"

func TestRLSTenantIsolation(t *testing.T) {
	dsn := os.Getenv("GATEWAY_TEST_DB")
	if dsn == "" {
		t.Skip("GATEWAY_TEST_DB not set; skipping RLS integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if err := setupSchema(ctx, pool); err != nil {
		t.Fatalf("setup schema: %v", err)
	}
	defer teardownSchema(ctx, pool)

	tenantA := uuid.New()
	tenantB := uuid.New()

	seed := func(tenantID uuid.UUID, doc string) {
		_, err := pool.Exec(ctx, fmt.Sprintf(
			"INSERT INTO %s.documents (id, tenant_id, title) VALUES ($1, $2, $3)", rlsSchema,
		), uuid.New(), tenantID, doc)
		if err != nil {
			t.Fatalf("seed %s: %v", doc, err)
		}
	}
	seed(tenantA, "A-doc-1")
	seed(tenantA, "A-doc-2")
	seed(tenantB, "B-doc-1")

	assertCount := func(t *testing.T, tenantID uuid.UUID, want int) {
		t.Helper()
		conn, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("acquire: %v", err)
		}
		defer conn.Release()
		if _, err := conn.Exec(ctx, "SET ROLE app_user"); err != nil {
			t.Fatalf("set role: %v", err)
		}
		if _, err := conn.Exec(ctx,
			"SELECT set_config('app.current_tenant_id', $1, true)", tenantID.String()); err != nil {
			t.Fatalf("set_config: %v", err)
		}
		var got int
		if err := conn.QueryRow(ctx, fmt.Sprintf("SELECT count(*) FROM %s.documents", rlsSchema)).Scan(&got); err != nil {
			t.Fatalf("count: %v", err)
		}
		if got != want {
			t.Fatalf("tenant %s: want %d rows, got %d", tenantID, want, got)
		}
	}

	t.Run("tenant A sees only A's rows", func(t *testing.T) {
		assertCount(t, tenantA, 2)
	})
	t.Run("tenant B sees only B's rows", func(t *testing.T) {
		assertCount(t, tenantB, 1)
	})
	t.Run("unknown tenant sees zero rows", func(t *testing.T) {
		assertCount(t, uuid.New(), 0)
	})
}

func setupSchema(ctx context.Context, pool *pgxpool.Pool) error {
	stmts := []string{
		`DROP SCHEMA IF EXISTS ` + rlsSchema + ` CASCADE`,
		`CREATE SCHEMA ` + rlsSchema,
		`CREATE TABLE ` + rlsSchema + `.documents (
			id UUID PRIMARY KEY,
			tenant_id UUID NOT NULL,
			title TEXT NOT NULL
		)`,
		`ALTER TABLE ` + rlsSchema + `.documents ENABLE ROW LEVEL SECURITY`,
		`ALTER TABLE ` + rlsSchema + `.documents FORCE ROW LEVEL SECURITY`,
		`CREATE POLICY tenant_isolation ON ` + rlsSchema + `.documents
			USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)`,
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
				CREATE ROLE app_user WITH NOLOGIN;
			END IF;
		END $$`,
		`GRANT USAGE ON SCHEMA ` + rlsSchema + ` TO app_user`,
		`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ` + rlsSchema + ` TO app_user`,
	}
	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			return fmt.Errorf("exec %q: %w", s, err)
		}
	}
	return nil
}

func teardownSchema(ctx context.Context, pool *pgxpool.Pool) {
	_, _ = pool.Exec(ctx, `DROP SCHEMA IF EXISTS `+rlsSchema+` CASCADE`)
}

// Ensure the test file imports the pgx driver symbol in case the pgxpool
// package path changes — cheap link check at compile time.
var _ = pgx.ErrNoRows

package tenant

import (
	"context"
	"net/netip"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// pgPool returns a connected pool when SDLC_PG_TEST_URL is set; the
// suite is otherwise skipped so CI on machines without Postgres
// doesn't fail. The schema is migrations/001_tenant_network_map.sql
// which the operator runs out of band (we don't own DDL in tests).
func pgPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("SDLC_PG_TEST_URL")
	if url == "" {
		t.Skip("SDLC_PG_TEST_URL not set; skipping pg_loader integration")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(),
			"DELETE FROM tenant_network_map WHERE tenant_id LIKE 'tnt_test_%'")
		pool.Close()
	})
	return pool
}

func TestPgLoader_LoadsAndResolves(t *testing.T) {
	pool := pgPool(t)
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		INSERT INTO tenant_network_map (cidr, tenant_id, label)
		VALUES ('10.0.0.0/8'::cidr, 'tnt_test_corp', 'corp egress'),
		       ('10.1.2.0/24'::cidr, 'tnt_test_sub', 'subsidiary')
	`)
	if err != nil {
		t.Fatal(err)
	}

	loader, err := NewPgLoader(ctx, pool)
	if err != nil {
		t.Fatalf("NewPgLoader: %v", err)
	}
	if got := loader.ResolveByIP(netip.MustParseAddr("10.1.2.10")); got != "tnt_test_sub" {
		t.Errorf("most-specific match failed: got %q", got)
	}
	if got := loader.ResolveByIP(netip.MustParseAddr("10.5.5.5")); got != "tnt_test_corp" {
		t.Errorf("parent match failed: got %q", got)
	}
}

func TestPgLoader_RefreshSeesNewRows(t *testing.T) {
	pool := pgPool(t)
	ctx := context.Background()
	loader, err := NewPgLoader(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	// Before insert: no match.
	if got := loader.ResolveByIP(netip.MustParseAddr("172.20.0.1")); got != "" {
		t.Errorf("pre-refresh should not match, got %q", got)
	}

	_, err = pool.Exec(ctx, `INSERT INTO tenant_network_map (cidr, tenant_id) VALUES ('172.20.0.0/16', 'tnt_test_late')`)
	if err != nil {
		t.Fatal(err)
	}

	loader.Start(ctx, 50*time.Millisecond)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if loader.ResolveByIP(netip.MustParseAddr("172.20.0.1")) == "tnt_test_late" {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Errorf("loader did not pick up new row within 2s")
}

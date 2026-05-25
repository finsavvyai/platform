package audit

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// pgPool returns a connected pool when SDLC_PG_TEST_URL is set;
// otherwise the test calls t.Skip so CI doesn't fail on machines
// without Postgres. Suite assumes the schema is migrated already
// (the consumer's migration tooling owns DDL).
func pgPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("SDLC_PG_TEST_URL")
	if url == "" {
		t.Skip("SDLC_PG_TEST_URL not set; skipping Postgres integration")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM ai_request_log WHERE tenant_id LIKE 'tnt_test_%'")
		pool.Close()
	})
	return pool
}

func TestPgRepository_RoundTrip(t *testing.T) {
	pool := pgPool(t)
	repo := NewPgRepository(pool)
	ctx := context.Background()

	cost := int64(2_500_000)
	pTok := 100
	cTok := 200
	row := AIRequestLog{
		TenantID: "tnt_test_a", Provider: "anthropic",
		Model: "claude-haiku-4-5", SummaryType: "messages",
		Status: "ok", LatencyMs: 412,
		PromptTokens: &pTok, CompletionTokens: &cTok,
		CostUSDMicros: &cost,
	}
	if err := repo.Create(ctx, row); err != nil {
		t.Fatalf("Create: %v", err)
	}

	rows, err := repo.ListByTenant(ctx, "tnt_test_a",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 10)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	if rows[0].Status != "ok" || rows[0].LatencyMs != 412 {
		t.Errorf("round-trip lost data: %+v", rows[0])
	}
}

func TestPgRepository_CrossTenantWithEmptyID(t *testing.T) {
	pool := pgPool(t)
	repo := NewPgRepository(pool)
	ctx := context.Background()

	for _, tid := range []string{"tnt_test_x", "tnt_test_y"} {
		_ = repo.Create(ctx, AIRequestLog{TenantID: tid, Provider: "anthropic", Status: "ok"})
	}
	rows, err := repo.ListByTenant(ctx, "",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 100)
	if err != nil {
		t.Fatal(err)
	}
	// Filter to our test tenants since the table may have other rows
	got := 0
	for _, r := range rows {
		if r.TenantID == "tnt_test_x" || r.TenantID == "tnt_test_y" {
			got++
		}
	}
	if got != 2 {
		t.Errorf("cross-tenant query returned %d test rows, want 2", got)
	}
}

func TestPgRepository_SumCost(t *testing.T) {
	pool := pgPool(t)
	repo := NewPgRepository(pool)
	ctx := context.Background()

	c1 := int64(1_000_000)
	c2 := int64(2_000_000)
	for _, c := range []*int64{&c1, &c2, nil} {
		_ = repo.Create(ctx, AIRequestLog{TenantID: "tnt_test_sum", Provider: "anthropic", Status: "ok", CostUSDMicros: c})
	}
	total, err := repo.SumCostUSDMicros(ctx, "tnt_test_sum",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if total != 3_000_000 {
		t.Errorf("SumCost = %d, want 3_000_000 (NULL row coalesced to 0)", total)
	}
}

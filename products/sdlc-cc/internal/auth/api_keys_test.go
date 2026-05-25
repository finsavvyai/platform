package auth

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func pgPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("SDLC_PG_TEST_URL")
	if url == "" {
		t.Skip("SDLC_PG_TEST_URL not set; skipping api_keys integration")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(),
			"DELETE FROM api_keys WHERE tenant_id LIKE 'tnt_test_%'")
		pool.Close()
	})
	return pool
}

func TestStore_Issue_Verify(t *testing.T) {
	store := NewStore(pgPool(t))
	ctx := context.Background()

	k, err := store.Issue(ctx, "tnt_test_a", "ci-runner", "ops@team", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(k.Plaintext, KeyPrefix) {
		t.Errorf("plaintext should start with %s, got %q", KeyPrefix, k.Plaintext)
	}
	if len(k.Plaintext) < 30 {
		t.Errorf("plaintext too short: %d", len(k.Plaintext))
	}
	if k.Prefix != k.Plaintext[:PrefixLen] {
		t.Errorf("prefix mismatch")
	}

	got, err := store.Verify(ctx, k.Plaintext)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if got != "tnt_test_a" {
		t.Errorf("Verify returned %q, want tnt_test_a", got)
	}
}

func TestStore_Verify_BadShape(t *testing.T) {
	store := NewStore(pgPool(t))
	_, err := store.Verify(context.Background(), "not-a-key")
	if !errors.Is(err, ErrInvalidKey) {
		t.Errorf("want ErrInvalidKey, got %v", err)
	}
}

func TestStore_Verify_Revoked(t *testing.T) {
	store := NewStore(pgPool(t))
	ctx := context.Background()
	k, err := store.Issue(ctx, "tnt_test_b", "x", "ops", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Revoke(ctx, k.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Verify(ctx, k.Plaintext); !errors.Is(err, ErrInvalidKey) {
		t.Errorf("revoked key should fail verify, got %v", err)
	}
}

func TestStore_Revoke_Idempotent(t *testing.T) {
	store := NewStore(pgPool(t))
	ctx := context.Background()
	k, _ := store.Issue(ctx, "tnt_test_c", "x", "ops", nil)
	if err := store.Revoke(ctx, k.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.Revoke(ctx, k.ID); err != nil {
		t.Errorf("second revoke should be a no-op, got %v", err)
	}
}

func TestStore_List_OrderedByCreated(t *testing.T) {
	store := NewStore(pgPool(t))
	ctx := context.Background()
	for i, label := range []string{"first", "second", "third"} {
		_, err := store.Issue(ctx, "tnt_test_list", label, "ops", nil)
		if err != nil {
			t.Fatal(err)
		}
		if i < 2 {
			time.Sleep(15 * time.Millisecond)
		}
	}
	keys, err := store.List(ctx, "tnt_test_list")
	if err != nil {
		t.Fatal(err)
	}
	if len(keys) != 3 || keys[0].Label != "third" {
		t.Errorf("expected newest first, got: %+v", keys)
	}
}

func TestGeneratePlaintext_Unique(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		k, err := generatePlaintext()
		if err != nil {
			t.Fatal(err)
		}
		if seen[k] {
			t.Errorf("collision at iteration %d", i)
		}
		seen[k] = true
	}
}

func TestHashKey_Stable(t *testing.T) {
	if hashKey("abc") != hashKey("abc") {
		t.Error("hashKey should be deterministic")
	}
	if hashKey("abc") == hashKey("abd") {
		t.Error("hashKey should differ for different inputs")
	}
}

//go:build integration

// security_chain_test: BEAT-PLAN S1.1 wiring proof.
//
// Boots the real golden chain against a live Postgres + applies
// migrations 007/009/010, seeds a tenant + user + role, then asserts:
//
//  1. RBAC PgxLoader returns the seeded permissions.
//  2. RBAC Evaluator allows a granted permission and denies an
//     un-granted one.
//  3. The chain's audit step writes a HMAC-signed row to audit_logs
//     for a mutating request, and the row's signature verifies
//     against the configured signing key.
//
// Run: `GATEWAY_TEST_DB=postgres://... go test -tags=integration
// ./tests/integration -run TestSecurityChainWired`.

package integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	domainrbac "github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
	infaudit "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
	infrbac "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/rbac"
	httpmw "github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/middleware"
)

func TestSecurityChainWired(t *testing.T) {
	dsn := os.Getenv("GATEWAY_TEST_DB")
	if dsn == "" {
		t.Skip("GATEWAY_TEST_DB not set; skipping security-chain integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	tenantID := uuid.New()
	userID := uuid.New()
	seedRBAC(ctx, t, pool, tenantID, userID, "documents:read")

	t.Run("rbac_evaluator_resolves_grants", func(t *testing.T) {
		ev := domainrbac.NewEvaluator(infrbac.NewPgxLoader(pool), 0)
		allowRead, err := ev.Allow(ctx, userID, "documents:read")
		if err != nil {
			t.Fatalf("allow read: %v", err)
		}
		if !allowRead {
			t.Fatal("expected documents:read allowed")
		}
		allowWrite, err := ev.Allow(ctx, userID, "documents:write")
		if err != nil {
			t.Fatalf("allow write: %v", err)
		}
		if allowWrite {
			t.Fatal("expected documents:write denied")
		}
	})

	t.Run("audit_writer_persists_signed_row", func(t *testing.T) {
		key := make([]byte, 32)
		for i := range key {
			key[i] = byte('a' + i%26)
		}
		signer, err := infaudit.NewSigner(key)
		if err != nil {
			t.Fatalf("signer: %v", err)
		}
		sqlDB := stdlib.OpenDBFromPool(pool)
		defer sqlDB.Close()

		writer := infaudit.NewWriter(sqlDB, signer, nil, 0)
		defer writer.Close()

		r := chi.NewRouter()
		httpmw.Apply(r, httpmw.ChainDeps{
			Version:     "test",
			AuditWriter: writer,
			SkipAuthFor: []string{"/test"},
		})
		hit := false
		r.Post("/test", func(w http.ResponseWriter, r *http.Request) {
			hit = true
			w.WriteHeader(http.StatusNoContent)
		})

		// LOCAL bypass mints a synthetic identity so the chain's
		// post-auth steps see a tenant + user without a real JWT.
		t.Setenv("LOCAL_AUTH_BYPASS", "true")
		t.Setenv("LOCAL_AUTH_BYPASS_TENANT_ID", tenantID.String())
		t.Setenv("LOCAL_AUTH_BYPASS_USER_ID", userID.String())

		srv := httptest.NewServer(r)
		defer srv.Close()
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/test", nil)
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("post: %v", err)
		}
		_ = resp.Body.Close()
		if !hit {
			t.Fatal("handler not reached")
		}

		// Drain the async writer so the row is on disk before we read.
		writer.Close()
		writer.Wait()

		got := waitForAuditRow(ctx, t, pool, tenantID, "http.post")
		if got.signature == nil {
			t.Fatal("audit row missing signature")
		}
		// Re-derive the canonical row from the persisted columns and
		// verify the HMAC matches what we'd compute now. Catches any
		// drift between writer.write canonicalisation and signer.
		row := infaudit.Row{
			TenantID:   got.tenantID,
			ActorID:    got.actorID,
			ActorType:  got.actorType,
			Action:     got.action,
			TargetType: got.targetType,
			TargetID:   got.targetID,
			After:      got.after,
			CreatedAt:  got.createdAt,
		}
		ok, err := signer.Verify(row, got.signature)
		if err != nil {
			t.Fatalf("verify: %v", err)
		}
		if !ok {
			t.Fatal("HMAC verification failed")
		}
	})
}

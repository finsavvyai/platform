// Chain-integration test: ChainDeps.DLP plumbing exercises both
// inbound (step 8a) and outbound (step 12a) middlewares end-to-end.
// Uses a fake PolicyLookup so this test depends on no DB.

package middleware

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	infmw "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

type stubPolicy struct{ a infmw.Action }

func (s stubPolicy) DLPAction(_ context.Context, _ string) (infmw.Action, error) {
	return s.a, nil
}

func TestChain_DLPOutbound_RedactsResponseBeforeCompress(t *testing.T) {
	// LOCAL_AUTH_BYPASS stamps a synthetic tenant so the policy lookup
	// resolves to redact instead of short-circuiting on empty tenant.
	t.Setenv("LOCAL_AUTH_BYPASS", "true")
	t.Setenv("LOCAL_AUTH_BYPASS_TENANT", "demo-tenant")

	dlp := infmw.NewDLP(infmw.NewDetector(), stubPolicy{a: infmw.ActionRedact}, nil)
	dlp.TenantFromCtx = func(ctx context.Context) string {
		v, _ := ctx.Value(CtxKeyTenantID).(string)
		return v
	}

	r := chi.NewRouter()
	Apply(r, ChainDeps{
		Version: "test",
		DLP:     dlp,
	})
	r.Get("/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("Customer SSN is 123-45-6789, please update"))
	})

	srv := httptest.NewServer(r)
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/echo")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	got := string(body)
	if strings.Contains(got, "123-45-6789") {
		t.Fatalf("raw SSN leaked through chain: %q", got)
	}
	if !strings.Contains(got, "<SSN>") {
		t.Fatalf("expected <SSN> placeholder in body, got %q", got)
	}
}

func TestChain_DLPOutbound_AllowPassesThrough(t *testing.T) {
	t.Setenv("LOCAL_AUTH_BYPASS", "true")
	t.Setenv("LOCAL_AUTH_BYPASS_TENANT", "demo-tenant")

	dlp := infmw.NewDLP(infmw.NewDetector(), stubPolicy{a: infmw.ActionAllow}, nil)
	dlp.TenantFromCtx = func(ctx context.Context) string {
		v, _ := ctx.Value(CtxKeyTenantID).(string)
		return v
	}

	r := chi.NewRouter()
	Apply(r, ChainDeps{
		Version: "test",
		DLP:     dlp,
	})
	r.Get("/echo", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("hello world"))
	})

	srv := httptest.NewServer(r)
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/echo")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "hello world" {
		t.Fatalf("body=%q want hello world", string(body))
	}
}

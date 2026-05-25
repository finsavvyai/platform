package middleware

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
)

type staticPolicy struct{ a Action }

func (s staticPolicy) DLPAction(_ context.Context, _ string) (Action, error) { return s.a, nil }

type capturingAudit struct {
	mu   sync.Mutex
	rows []audit.Row
}

func (c *capturingAudit) AppendAsync(r audit.Row) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.rows = append(c.rows, r)
	return nil
}

func withTenant(r *http.Request, t string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), "tenant_id", t))
}

func TestInbound_BlockReturns422ProblemJSON(t *testing.T) {
	au := &capturingAudit{}
	d := NewDLP(NewDetector(), staticPolicy{ActionBlock}, au)
	called := false
	h := d.Inbound()(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		called = true
	}))

	req := withTenant(httptest.NewRequest(http.MethodPost, "/llm",
		strings.NewReader(`{"prompt":"SSN 999-99-9999"}`)), "t1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("expected problem+json, got %q", ct)
	}
	if called {
		t.Fatal("next handler must NOT run on block")
	}
	if len(au.rows) != 1 || au.rows[0].Action != "dlp.inbound" {
		t.Fatalf("expected one dlp.inbound audit row, got %+v", au.rows)
	}
}

func TestInbound_MaskRewritesBodyForNext(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionMask}, nil)
	var seen string
	h := d.Inbound()(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		seen = string(b)
	}))

	req := withTenant(httptest.NewRequest(http.MethodPost, "/llm",
		strings.NewReader("contact 999-99-9999 today")), "t1")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if strings.Contains(seen, "999-99-9999") {
		t.Fatalf("plaintext SSN must not reach next handler, got %q", seen)
	}
}

func TestInbound_AllowPassesThrough(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionAllow}, nil)
	var seen string
	h := d.Inbound()(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		seen = string(b)
	}))

	req := withTenant(httptest.NewRequest(http.MethodPost, "/llm",
		strings.NewReader("contact 999-99-9999 today")), "t1")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "contact 999-99-9999 today" {
		t.Fatalf("allow must not rewrite, got %q", seen)
	}
}

func TestInbound_NoTenantNoOp(t *testing.T) {
	au := &capturingAudit{}
	d := NewDLP(NewDetector(), staticPolicy{ActionBlock}, au)
	h := d.Inbound()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// No tenant in context → policy lookup returns ActionAllow,
	// request must pass through.
	req := httptest.NewRequest(http.MethodPost, "/llm",
		strings.NewReader("SSN 999-99-9999"))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (no tenant = allow), got %d", rec.Code)
	}
}

func TestOutbound_RedactsResponseBody(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionRedact}, nil)
	h := d.Outbound()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("user email: alice@example.com"))
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	if strings.Contains(rec.Body.String(), "alice@example.com") {
		t.Fatalf("plaintext email must be redacted, got %q", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "<EMAIL>") {
		t.Fatalf("expected <EMAIL> placeholder, got %q", rec.Body.String())
	}
}

func TestOutbound_BlockReturns422(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionBlock}, nil)
	h := d.Outbound()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("SSN 999-99-9999"))
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("outbound block must 422, got %d", rec.Code)
	}
}

func TestOutbound_LargeBodyTruncatesWithWarningHeader(t *testing.T) {
	d := NewDLP(NewDetector(), staticPolicy{ActionRedact}, nil)
	d.MaxBufferedBody = 32 // tiny cap so we trip the overflow path.
	h := d.Outbound()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("X", 100)))
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	if rec.Header().Get("X-DLP-Truncated") != "1" {
		t.Fatalf("oversized body must set X-DLP-Truncated, got header=%q", rec.Header().Get("X-DLP-Truncated"))
	}
}

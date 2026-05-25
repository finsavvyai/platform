package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/sdlc-cc/internal/auth"
)

type fakeVerifier struct {
	want    string
	tenant  string
	failErr error
}

func (f fakeVerifier) Verify(_ context.Context, plaintext string) (string, error) {
	if f.failErr != nil {
		return "", f.failErr
	}
	if plaintext == f.want {
		return f.tenant, nil
	}
	return "", auth.ErrInvalidKey
}

func TestWithAPIKeys_ValidBearer_AttachesTenant(t *testing.T) {
	v := fakeVerifier{want: "sk_sdlc_abc123def456", tenant: "tnt_real"}
	var seen string
	h := WithAPIKeys(v, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk_sdlc_abc123def456")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "tnt_real" {
		t.Errorf("tenant on context = %q, want tnt_real", seen)
	}
}

func TestWithAPIKeys_ValidXAPIKey(t *testing.T) {
	v := fakeVerifier{want: "sk_sdlc_xkey", tenant: "tnt_x"}
	var seen string
	h := WithAPIKeys(v, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = TenantIDFromContext(r.Context())
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("X-API-Key", "sk_sdlc_xkey")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "tnt_x" {
		t.Errorf("tenant on context = %q, want tnt_x", seen)
	}
}

func TestWithAPIKeys_BadKey_401(t *testing.T) {
	v := fakeVerifier{want: "sk_sdlc_real", tenant: "tnt_x"}
	h := WithAPIKeys(v, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("downstream handler should not run on auth failure")
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk_sdlc_wrong")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", rec.Code)
	}
}

func TestWithAPIKeys_NoToken_FallsThrough(t *testing.T) {
	v := fakeVerifier{want: "sk_sdlc_real", tenant: "tnt_x"}
	called := false
	h := WithAPIKeys(v, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	// No Authorization header at all — transparent-proxy customers
	// don't carry our token; let CIDR resolver have a shot downstream.
	h.ServeHTTP(httptest.NewRecorder(), req)
	if !called {
		t.Error("downstream should run when no key is offered")
	}
}

func TestWithAPIKeys_NonSdlcBearer_PassesThrough(t *testing.T) {
	// Customer's own Anthropic key (sk-ant-*) is not ours; we must
	// not 401 it — that's exactly the transparent-proxy case where
	// we forward unchanged.
	v := fakeVerifier{want: "irrelevant", failErr: errors.New("should not be called")}
	called := false
	h := WithAPIKeys(v, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk-ant-customers-own-key")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if !called {
		t.Error("non-sdlc bearer must pass through to transparent-proxy path")
	}
}

func TestWithAPIKeys_NilVerifier_NoOp(t *testing.T) {
	called := false
	h := WithAPIKeys(nil, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
	}))
	req := httptest.NewRequest("POST", "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk_sdlc_anything")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if !called {
		t.Error("nil verifier should pass through")
	}
}

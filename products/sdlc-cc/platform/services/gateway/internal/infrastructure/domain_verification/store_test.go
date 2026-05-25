package domain_verification

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// ─── MemStore ────────────────────────────────────────────────────────────────

func TestMemStore_SaveAndGet(t *testing.T) {
	ms := NewMemStore()
	tid := uuid.New()
	r := DomainRecord{ID: uuid.New(), TenantID: tid, Domain: "acme.com", Token: "tok1", Method: MethodDNS, Status: StatusPending}
	_ = ms.Save(context.Background(), r)
	got, err := ms.Get(context.Background(), tid, "acme.com")
	if err != nil || got.Token != "tok1" {
		t.Fatalf("get after save: err=%v token=%q", err, got.Token)
	}
}

func TestMemStore_GetNotFound(t *testing.T) {
	_, err := NewMemStore().Get(context.Background(), uuid.New(), "missing.com")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestMemStore_List(t *testing.T) {
	ms := NewMemStore()
	tid := uuid.New()
	for i := 0; i < 3; i++ {
		_ = ms.Save(context.Background(), DomainRecord{ID: uuid.New(), TenantID: tid, Domain: fmt.Sprintf("d%d.com", i)})
	}
	rows, _ := ms.List(context.Background(), tid)
	if len(rows) != 3 {
		t.Fatalf("expected 3 rows, got %d", len(rows))
	}
}

func TestMemStore_Delete(t *testing.T) {
	ms := NewMemStore()
	tid := uuid.New()
	_ = ms.Save(context.Background(), DomainRecord{ID: uuid.New(), TenantID: tid, Domain: "gone.com"})
	_ = ms.Delete(context.Background(), tid, "gone.com")
	_, err := ms.Get(context.Background(), tid, "gone.com")
	if !errors.Is(err, ErrNotFound) {
		t.Fatal("expected ErrNotFound after delete")
	}
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

func TestIsExpired_PastExpiry(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	r := DomainRecord{Status: StatusVerified, ExpiresAt: &past}
	if !r.IsExpired(time.Now()) {
		t.Fatal("past-expiry verified record must be expired")
	}
}

func TestIsExpired_FutureExpiry(t *testing.T) {
	future := time.Now().Add(time.Hour)
	r := DomainRecord{Status: StatusVerified, ExpiresAt: &future}
	if r.IsExpired(time.Now()) {
		t.Fatal("future-expiry verified record must not be expired")
	}
}

func TestIsExpired_PendingNeverExpires(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	r := DomainRecord{Status: StatusPending, ExpiresAt: &past}
	if r.IsExpired(time.Now()) {
		t.Fatal("pending record must not be considered expired")
	}
}

// ─── SSORedirector ────────────────────────────────────────────────────────────

func TestSSORedirector_VerifiedDomainRedirects(t *testing.T) {
	ms := NewMemStore()
	tid := uuid.New()
	future := time.Now().Add(time.Hour)
	_ = ms.Save(context.Background(), DomainRecord{
		ID: uuid.New(), TenantID: tid, Domain: "acme.com",
		Status: StatusVerified, ExpiresAt: &future,
	})
	redir := NewSSORedirector(ms, func(_ context.Context, _ uuid.UUID) (string, error) {
		return "https://sso.acme.com/start", nil
	})
	url, err := redir.RedirectURL(context.Background(), "alice@ACME.COM")
	if err != nil || url != "https://sso.acme.com/start" {
		t.Fatalf("expected SSO redirect, got url=%q err=%v", url, err)
	}
}

func TestSSORedirector_UnknownDomainNoRedirect(t *testing.T) {
	redir := NewSSORedirector(NewMemStore(), func(_ context.Context, _ uuid.UUID) (string, error) {
		t.Fatal("SSOURL must not be called for unknown domain")
		return "", nil
	})
	url, err := redir.RedirectURL(context.Background(), "alice@unknown.com")
	if err != nil || url != "" {
		t.Fatalf("expected no redirect, got url=%q err=%v", url, err)
	}
}

func TestSSORedirector_ExpiredDomainMarkedAndNoRedirect(t *testing.T) {
	ms := NewMemStore()
	tid := uuid.New()
	past := time.Now().Add(-time.Hour)
	_ = ms.Save(context.Background(), DomainRecord{
		ID: uuid.New(), TenantID: tid, Domain: "stale.com",
		Status: StatusVerified, ExpiresAt: &past,
	})
	redir := &SSORedirector{Store: ms, SSOURL: func(_ context.Context, _ uuid.UUID) (string, error) {
		return "https://sso.stale.com/start", nil
	}, Now: time.Now}

	url, err := redir.RedirectURL(context.Background(), "bob@stale.com")
	if err != nil || url != "" {
		t.Fatalf("expired domain must not redirect, got url=%q err=%v", url, err)
	}
	// Record must be re-saved as StatusExpired so FindVerifiedByDomain no longer returns it.
	_, findErr := ms.FindVerifiedByDomain(context.Background(), "stale.com")
	if !errors.Is(findErr, ErrNotFound) {
		t.Fatal("expired record must be marked expired in the store")
	}
}

func TestEmailDomain_TrailingAt(t *testing.T) {
	if got := emailDomain("user@"); got != "" {
		t.Fatalf("trailing-@ email must return empty domain, got %q", got)
	}
}

func TestEmailDomain_NoAt(t *testing.T) {
	if got := emailDomain("notanemail"); got != "" {
		t.Fatalf("no-@ email must return empty domain, got %q", got)
	}
}

func TestSSORedirector_StoreError(t *testing.T) {
	errStore := &errFindStore{}
	redir := NewSSORedirector(errStore, func(_ context.Context, _ uuid.UUID) (string, error) {
		return "", nil
	})
	_, err := redir.RedirectURL(context.Background(), "alice@boom.com")
	if err == nil {
		t.Fatal("store error must propagate from RedirectURL")
	}
}

type errFindStore struct{ MemStore }

func (e *errFindStore) FindVerifiedByDomain(_ context.Context, _ string) (DomainRecord, error) {
	return DomainRecord{}, errors.New("db unreachable")
}

func TestVerifyDNS_ResolverError(t *testing.T) {
	v := newV(fakeResolver{err: errors.New("dns timeout")}, nil)
	err := v.Verify(context.Background(), MethodDNS, "example.com", "tok")
	if err == nil {
		t.Fatal("resolver error must be returned")
	}
}

// ─── HTTP mock-server (TLS round-trip) ────────────────────────────────────────

func TestVerifyHTTP_WithTLSMockServer(t *testing.T) {
	const tok Token = "tls-token-999"
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/sdlc-cc-verification" {
			_, _ = fmt.Fprintf(w, "%s\n", tok)
		} else {
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	host := strings.TrimPrefix(srv.URL, "https://")
	v := NewVerifier()
	v.HTTP = netHTTPClient{c: srv.Client()}
	if err := v.Verify(context.Background(), MethodHTTP, host, tok); err != nil {
		t.Fatalf("HTTP verify against TLS mock server: %v", err)
	}
}

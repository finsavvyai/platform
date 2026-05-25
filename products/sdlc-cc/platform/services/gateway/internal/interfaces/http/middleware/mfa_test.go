package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/sso"
)

type memMFA struct {
	mu  sync.Mutex
	stamps map[uuid.UUID]time.Time
}

func (m *memMFA) LastMFA(_ context.Context, uid uuid.UUID) (time.Time, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stamps[uid], nil
}

func (m *memMFA) StampMFA(_ context.Context, uid uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stamps == nil {
		m.stamps = map[uuid.UUID]time.Time{}
	}
	m.stamps[uid] = time.Now()
	return nil
}

func TestMFAGate_ChallengesWhenNoStamp(t *testing.T) {
	store := &memMFA{}
	uid := uuid.New()
	gate := MFAGate(store, func(*http.Request) uuid.UUID { return uid })
	h := gate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler must not run when MFA missing")
	}))
	req := httptest.NewRequest("GET", "/admin", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", rec.Code)
	}
	if got := rec.Header().Get("WWW-Authenticate"); got != `MFA realm="step-up"` {
		t.Fatalf("WWW-Authenticate=%q", got)
	}
}

func TestMFAGate_AllowsAfterStamp(t *testing.T) {
	store := &memMFA{}
	uid := uuid.New()
	_ = store.StampMFA(context.Background(), uid)
	gate := MFAGate(store, func(*http.Request) uuid.UUID { return uid })
	called := false
	h := gate(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/admin", nil))
	if !called || rec.Code != http.StatusOK {
		t.Fatalf("handler not invoked: code=%d called=%v", rec.Code, called)
	}
}

func TestMFAGate_AnonymousIsChallenged(t *testing.T) {
	gate := MFAGate(&memMFA{}, func(*http.Request) uuid.UUID { return uuid.Nil })
	h := gate(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("handler must not run for anonymous")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/admin", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", rec.Code)
	}
}

func TestMFAGate_NilStoreIsPassthrough(t *testing.T) {
	called := false
	h := MFAGate(nil, func(*http.Request) uuid.UUID { return uuid.New() })(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			called = true
		}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if !called {
		t.Fatal("nil store should passthrough")
	}
}

// EnsureFreshMFA expiry path — stale stamp must re-challenge.
func TestMFAGate_StaleStampChallenges(t *testing.T) {
	store := &memMFA{stamps: map[uuid.UUID]time.Time{}}
	uid := uuid.New()
	store.stamps[uid] = time.Now().Add(-2 * sso.MFAFreshness)
	gate := MFAGate(store, func(*http.Request) uuid.UUID { return uid })
	h := gate(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("handler must not run with stale MFA")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/admin", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", rec.Code)
	}
}

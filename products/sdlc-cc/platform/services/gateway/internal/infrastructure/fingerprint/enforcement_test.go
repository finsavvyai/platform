package fingerprint

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

type memStore struct {
	mu sync.Mutex
	kv map[uuid.UUID]string
}

func newMemStore() *memStore { return &memStore{kv: make(map[uuid.UUID]string)} }

func (s *memStore) GetFingerprint(_ context.Context, id uuid.UUID) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if v, ok := s.kv[id]; ok {
		return v, nil
	}
	return "", ErrNoStoredFingerprint
}

func (s *memStore) PutFingerprint(_ context.Context, id uuid.UUID, v string, _ time.Duration) error {
	s.mu.Lock()
	s.kv[id] = v
	s.mu.Unlock()
	return nil
}

type fixedPolicy struct{ T int }

func (p fixedPolicy) Resolve(context.Context, uuid.UUID) (Policy, error) {
	return Policy{Threshold: p.T}, nil
}

func makeSignals(ua string) Signals {
	r, _ := http.NewRequest(http.MethodGet, "https://x", nil)
	r.Header.Set("User-Agent", ua)
	r.Header.Set("Accept-Language", "en-US")
	return Extract(r, "10.0.0.1")
}

func TestEnforcer_FirstSession_Stamps(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 80}, time.Hour)
	sessionID := uuid.New()

	d, err := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if !d.Match || d.Score != 100 {
		t.Fatalf("first session must match 100, got %+v", d)
	}
	if v, _ := store.GetFingerprint(context.Background(), sessionID); v == "" {
		t.Fatal("first Check must stamp the session")
	}
}

func TestEnforcer_IdenticalSignals_Match(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 80}, time.Hour)
	sessionID := uuid.New()

	_, _ = enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	d, _ := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	if !d.Match || d.Score != 100 {
		t.Fatalf("identical signals must match 100, got %+v", d)
	}
}

func TestEnforcer_NearMismatch_FailsThreshold(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 80}, time.Hour)
	sessionID := uuid.New()

	// Stamp with one UA.
	_, _ = enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))

	// Re-check with a sufficiently different UA so the score drops
	// below 80%.
	d, _ := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("curl/8.0"))
	if d.Match {
		t.Fatalf("changed UA must NOT match at threshold 80, got %+v", d)
	}
	if !d.RequireMFA {
		t.Fatalf("RequireMFA must be true on drift")
	}
}

func TestEnforcer_Stamp_OverridesAfterMFA(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 80}, time.Hour)
	sessionID := uuid.New()

	_, _ = enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	if err := enf.Stamp(context.Background(), sessionID, makeSignals("curl/8.0")); err != nil {
		t.Fatalf("Stamp: %v", err)
	}

	// Subsequent Check with the new UA must now match.
	d, _ := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("curl/8.0"))
	if !d.Match {
		t.Fatalf("post-Stamp Check must match, got %+v", d)
	}
}

func TestSimilarityCanonical_Boundaries(t *testing.T) {
	cases := []struct {
		name string
		a, b string
		want int
	}{
		{"identical", "x|y|z", "x|y|z", 100},
		{"none", "a|b|c", "x|y|z", 0},
		{"two of three", "a|b|c", "a|b|d", 66},
		{"length mismatch", "a|b", "a|b|c", 0},
		{"empty current", "a|b", "", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := similarityCanonical(tc.a, tc.b)
			if got != tc.want {
				t.Fatalf("got %d want %d", got, tc.want)
			}
		})
	}
}

func TestEnforcer_DefaultThresholdAppliedWhenZero(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 0}, time.Hour)
	sessionID := uuid.New()

	d, _ := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	if d.Threshold != DefaultThreshold {
		t.Fatalf("default threshold must be %d when policy returns 0, got %d",
			DefaultThreshold, d.Threshold)
	}
}

func TestEnforcer_HashesAreSHA256Hex(t *testing.T) {
	store := newMemStore()
	enf := NewEnforcer(store, fixedPolicy{T: 80}, time.Hour)
	sessionID := uuid.New()

	_, _ = enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	d, _ := enf.Check(context.Background(), sessionID, uuid.New(), makeSignals("Mozilla/5.0"))
	if len(d.NewHash) != 64 || strings.TrimLeft(d.NewHash, "0123456789abcdef") != "" {
		t.Fatalf("NewHash must be sha256 hex (64 chars), got %q", d.NewHash)
	}
}

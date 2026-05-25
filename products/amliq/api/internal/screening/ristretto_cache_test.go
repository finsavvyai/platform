package screening

import (
	"testing"
	"time"
)

func TestRistrettoCache_SetGet(t *testing.T) {
	rc, err := NewRistrettoCache(1000, 5*time.Minute)
	if err != nil {
		t.Fatalf("new ristretto: %v", err)
	}
	defer rc.Close()

	candidates := []Candidate{{Score: 0.95, Source: "test"}}
	rc.Set("putin", candidates)
	rc.Wait() // flush buffered writes — deterministic, no sleep

	got, ok := rc.Get("putin")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if len(got) != 1 || got[0].Score != 0.95 {
		t.Fatalf("unexpected result: %v", got)
	}
}

func TestRistrettoCache_Miss(t *testing.T) {
	rc, err := NewRistrettoCache(1000, 5*time.Minute)
	if err != nil {
		t.Fatalf("new ristretto: %v", err)
	}
	defer rc.Close()

	_, ok := rc.Get("nonexistent")
	if ok {
		t.Fatal("expected cache miss")
	}
}

func TestRistrettoCache_HitRate(t *testing.T) {
	rc, err := NewRistrettoCache(1000, 5*time.Minute)
	if err != nil {
		t.Fatalf("new ristretto: %v", err)
	}
	defer rc.Close()

	// Hit rate should be 0 initially
	rate := rc.HitRate()
	if rate != 0 {
		t.Fatalf("expected 0 hit rate, got %f", rate)
	}
}

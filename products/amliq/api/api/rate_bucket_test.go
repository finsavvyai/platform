package api

import (
	"testing"
	"time"
)

func TestBucketAllow(t *testing.T) {
	tests := []struct {
		name   string
		tokens float64
		wantOK bool
	}{
		{"single token", 1, true},
		{"exceed", 15, false},
		{"exact", 10, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newBucket(10, 10)
			ok, _ := b.allow(tt.tokens)
			if ok != tt.wantOK {
				t.Errorf("got %v, want %v", ok, tt.wantOK)
			}
		})
	}
}

func TestBucketRefill(t *testing.T) {
	rate := 5.0
	maxTokens := 10.0
	b := newBucket(rate, maxTokens)

	b.allow(5)
	remaining := b.remaining()
	if remaining < 4.9 || remaining > 5.5 {
		t.Errorf("after consuming 5: got %.2f, want ~5", remaining)
	}

	time.Sleep(1 * time.Second)
	remaining = b.remaining()
	if remaining < 9.5 || remaining > 10.1 {
		t.Errorf("after 1s refill: got %.2f, want ~10", remaining)
	}
}

func TestBucketCapsAtMax(t *testing.T) {
	b := newBucket(100, 10)
	time.Sleep(1 * time.Second)
	remaining := b.remaining()
	if remaining != 10 {
		t.Errorf("capped: got %.2f, want 10", remaining)
	}
}

func TestBucketRemaining(t *testing.T) {
	b := newBucket(2, 5)
	remaining := b.remaining()
	if remaining < 4.9 || remaining > 5.1 {
		t.Errorf("initial: got %.2f, want ~5", remaining)
	}

	b.allow(3)
	remaining = b.remaining()
	if remaining < 1.9 || remaining > 2.5 {
		t.Errorf("after consuming 3: got %.2f, want ~2", remaining)
	}
}

func TestBucketResetAt(t *testing.T) {
	b := newBucket(1, 10)
	b.allow(1)

	resetAt := b.resetAt()
	now := time.Now()
	if resetAt.Before(now) {
		t.Error("resetAt is in the past")
	}
	diff := resetAt.Sub(now).Seconds()
	if diff < 0.5 || diff > 1.5 {
		t.Errorf("resetAt: in ~%.2f seconds, want ~1", diff)
	}
}

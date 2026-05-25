package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newSlidingWindowTestLimiter(t *testing.T) (*Limiter, *miniredis.Miniredis, redis.UniversalClient) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return NewLimiter(rdb, "test:"), mr, rdb
}

func TestAllow_FirstNRequestsPass(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	// Limit=10, burst high enough that the burst guard does NOT fire
	// inside this loop — we are exercising the limit ceiling only.
	for i := 0; i < 10; i++ {
		d, err := l.Allow(ctx, "tenant-a:/v1/q", 10, 100)
		if err != nil {
			t.Fatalf("Allow #%d: %v", i, err)
		}
		if !d.Allowed {
			t.Fatalf("request #%d unexpectedly denied (remaining=%d)", i, d.Remaining)
		}
		if d.Remaining != 10-i-1 {
			t.Fatalf("remaining: want %d got %d", 10-i-1, d.Remaining)
		}
	}
}

func TestAllow_DeniesOverLimit(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	// Use limit=3, burst=10 so the limit fires before the burst guard.
	for i := 0; i < 3; i++ {
		d, err := l.Allow(ctx, "tenant-b:/v1/q", 3, 10)
		if err != nil || !d.Allowed {
			t.Fatalf("setup #%d: allowed=%v err=%v", i, d.Allowed, err)
		}
	}
	d, err := l.Allow(ctx, "tenant-b:/v1/q", 3, 10)
	if err != nil {
		t.Fatalf("Allow #4: %v", err)
	}
	if d.Allowed {
		t.Fatalf("4th request must be denied")
	}
	if d.RetryAfter <= 0 {
		t.Fatalf("denied request must populate RetryAfter, got %v", d.RetryAfter)
	}
	if d.ResetAt.Before(time.Now()) {
		t.Fatalf("denied request must populate ResetAt in the future")
	}
}

func TestAllow_BurstGuardFiresBeforeLimit(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	// limit far above burst; burst should fire first.
	burst := 3
	for i := 0; i < burst; i++ {
		d, err := l.Allow(ctx, "tenant-c:/v1/q", 100, burst)
		if err != nil || !d.Allowed {
			t.Fatalf("burst setup #%d: allowed=%v err=%v", i, d.Allowed, err)
		}
	}
	// 4th request inside the same second must be denied by the burst guard.
	d, err := l.Allow(ctx, "tenant-c:/v1/q", 100, burst)
	if err != nil {
		t.Fatalf("Allow burst+1: %v", err)
	}
	if d.Allowed {
		t.Fatalf("burst guard must deny the 4th request inside a second")
	}
}

func TestAllow_WindowAdvanceReclaimsCapacity(t *testing.T) {
	l, mr, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	// Fill the bucket.
	for i := 0; i < 3; i++ {
		_, _ = l.Allow(ctx, "tenant-d:/v1/q", 3, 100)
	}
	d, _ := l.Allow(ctx, "tenant-d:/v1/q", 3, 100)
	if d.Allowed {
		t.Fatalf("bucket should be full")
	}

	// Fast-forward miniredis past the 60s window.
	mr.FastForward(61 * time.Second)

	d2, err := l.Allow(ctx, "tenant-d:/v1/q", 3, 100)
	if err != nil {
		t.Fatalf("Allow after fast-forward: %v", err)
	}
	if !d2.Allowed {
		t.Fatalf("after window advance, request should be allowed again")
	}
}

func TestAllow_KeyIsolation(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	// Tenant A exhausts its limit.
	for i := 0; i < 3; i++ {
		_, _ = l.Allow(ctx, "tenant-a:/v1/q", 3, 100)
	}
	dA, _ := l.Allow(ctx, "tenant-a:/v1/q", 3, 100)
	if dA.Allowed {
		t.Fatalf("tenant-a should be over limit")
	}

	// Tenant B is independent.
	dB, err := l.Allow(ctx, "tenant-b:/v1/q", 3, 100)
	if err != nil {
		t.Fatalf("tenant-b Allow: %v", err)
	}
	if !dB.Allowed {
		t.Fatalf("tenant-b must not be affected by tenant-a's traffic")
	}
}

func TestAllow_RejectsBadInput(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	if _, err := l.Allow(ctx, "", 5, 5); err == nil {
		t.Error("empty key must error")
	}
	if _, err := l.Allow(ctx, "k", 0, 5); err == nil {
		t.Error("limit=0 must error")
	}
	if _, err := l.Allow(ctx, "k", 5, 0); err == nil {
		t.Error("burst=0 must error")
	}
}

func TestReset_ClearsCounter(t *testing.T) {
	l, _, _ := newSlidingWindowTestLimiter(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		_, _ = l.Allow(ctx, "tenant-r:/v1/q", 3, 100)
	}
	dDenied, _ := l.Allow(ctx, "tenant-r:/v1/q", 3, 100)
	if dDenied.Allowed {
		t.Fatalf("setup: bucket should be full")
	}

	if err := l.Reset(ctx, "tenant-r:/v1/q"); err != nil {
		t.Fatalf("Reset: %v", err)
	}

	d, err := l.Allow(ctx, "tenant-r:/v1/q", 3, 100)
	if err != nil {
		t.Fatalf("Allow after Reset: %v", err)
	}
	if !d.Allowed {
		t.Fatalf("after Reset, request must be allowed")
	}
}

package ratelimit

import (
	"testing"
	"time"
)

func TestFreeTierBlocksAfterLimit(t *testing.T) {
	rl := New()
	for i := 0; i < 15; i++ {
		rl.Allow("tenant1", "free")
	}
	ok, info := rl.Allow("tenant1", "free")
	if ok {
		t.Error("expected free tier to block after burst")
	}
	if info.Remaining != 0 {
		t.Errorf("remaining: got %d, want 0", info.Remaining)
	}
}

func TestEnterpriseTierAllowsHighVolume(t *testing.T) {
	rl := New()
	tests := []struct {
		name  string
		count int
		want  bool
	}{
		{"100 requests", 100, true},
		{"500 requests", 500, true},
		{"1000 requests", 1000, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rl2 := New()
			var ok bool
			for i := 0; i < tt.count; i++ {
				ok, _ = rl2.Allow("ent1", "enterprise")
			}
			if ok != tt.want {
				t.Errorf("after %d requests: got %v, want %v",
					tt.count, ok, tt.want)
			}
		})
	}
	_ = rl
}

func TestResetAfterWindowExpires(t *testing.T) {
	rl := New()
	rl.mu.Lock()
	rl.buckets["tenant2:free"] = &tenantBucket{
		count:   20,
		resetAt: time.Now().Add(-1 * time.Second),
	}
	rl.mu.Unlock()

	ok, info := rl.Allow("tenant2", "free")
	if !ok {
		t.Error("expected allow after window reset")
	}
	if info.Remaining != 9 {
		t.Errorf("remaining: got %d, want 9", info.Remaining)
	}
}

func TestPerTenantIsolation(t *testing.T) {
	rl := New()
	for i := 0; i < 16; i++ {
		rl.Allow("tenantA", "free")
	}
	blocked, _ := rl.Allow("tenantA", "free")
	if blocked {
		t.Error("tenantA should be blocked")
	}
	ok, _ := rl.Allow("tenantB", "free")
	if !ok {
		t.Error("tenantB should not be affected by tenantA")
	}
}

func TestCleanupRemovesExpired(t *testing.T) {
	rl := New()
	rl.mu.Lock()
	rl.buckets["old:free"] = &tenantBucket{
		count: 5, resetAt: time.Now().Add(-1 * time.Minute),
	}
	rl.mu.Unlock()
	rl.cleanup()
	rl.mu.Lock()
	_, exists := rl.buckets["old:free"]
	rl.mu.Unlock()
	if exists {
		t.Error("expected expired bucket to be cleaned up")
	}
}

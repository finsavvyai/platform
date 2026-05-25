package cache

import (
	"context"
	"testing"
	"time"
)

func TestPromptCache_DisabledOnZeroTTL(t *testing.T) {
	if c := NewPromptCache(0, 100); c != nil {
		t.Error("expected nil cache when TTL=0")
	}
	if c := NewPromptCache(-1*time.Second, 100); c != nil {
		t.Error("expected nil cache when TTL negative")
	}
}

func TestPromptCache_HitMiss(t *testing.T) {
	c := NewPromptCache(time.Hour, 100)
	k := c.Key("tnt_abc", "what is the risk")
	if _, ok := c.Get(k); ok {
		t.Error("empty cache should miss")
	}
	c.Set(k, "low risk")
	got, ok := c.Get(k)
	if !ok || got != "low risk" {
		t.Errorf("hit failed: got=%q ok=%v", got, ok)
	}
}

func TestPromptCache_TenantIsolation(t *testing.T) {
	c := NewPromptCache(time.Hour, 100)
	prompt := "screen entity Acme"
	c.Set(c.Key("tnt_aaa", prompt), "from-A")
	if _, ok := c.Get(c.Key("tnt_bbb", prompt)); ok {
		t.Error("tenant B should not see tenant A's response")
	}
}

func TestPromptCache_TTLExpiry(t *testing.T) {
	c := NewPromptCache(10*time.Millisecond, 100)
	k := c.Key("t", "p")
	c.Set(k, "x")
	if _, ok := c.Get(k); !ok {
		t.Fatal("immediate hit failed")
	}
	time.Sleep(15 * time.Millisecond)
	if _, ok := c.Get(k); ok {
		t.Error("expired entry should miss")
	}
}

func TestPromptCache_NilSafe(t *testing.T) {
	var c *PromptCache
	if _, ok := c.Get("k"); ok {
		t.Error("nil cache should report miss")
	}
	c.Set("k", "v") // must not panic
	resp, hit, key := CacheLookup(c, context.Background(), "t", "p")
	if hit || resp != "" || key != "" {
		t.Error("nil-cache lookup should report empty miss")
	}
}

func TestPromptCache_EvictsExpiredOnSet(t *testing.T) {
	c := NewPromptCache(5*time.Millisecond, 5)
	for i := 0; i < 5; i++ {
		c.Set(c.Key("t", string(rune('a'+i))), "v")
	}
	time.Sleep(10 * time.Millisecond)
	c.Set(c.Key("t", "fresh"), "v") // triggers eviction
	if got, ok := c.Get(c.Key("t", "fresh")); !ok || got != "v" {
		t.Errorf("fresh entry missing after evict: ok=%v got=%q", ok, got)
	}
}

package clawpipe

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestCacheSetGet(t *testing.T) {
	c := NewCache(60000, 100)
	c.Set("k1", "v1")
	v, ok := c.Get("k1")
	if !ok || v != "v1" {
		t.Fatalf("expected v1, got %q ok=%v", v, ok)
	}
}

func TestCacheMiss(t *testing.T) {
	c := NewCache(60000, 100)
	_, ok := c.Get("missing")
	if ok {
		t.Fatal("expected miss")
	}
}

func TestCacheTTLExpiry(t *testing.T) {
	c := NewCache(1, 100) // 1ms TTL
	c.Set("k1", "v1")
	time.Sleep(5 * time.Millisecond)
	_, ok := c.Get("k1")
	if ok {
		t.Fatal("expected expiry")
	}
}

func TestCacheHas(t *testing.T) {
	c := NewCache(60000, 100)
	c.Set("k1", "v1")
	if !c.Has("k1") {
		t.Fatal("expected Has=true")
	}
	if c.Has("nope") {
		t.Fatal("expected Has=false")
	}
}

func TestCacheDelete(t *testing.T) {
	c := NewCache(60000, 100)
	c.Set("k1", "v1")
	if !c.Delete("k1") {
		t.Fatal("expected delete=true")
	}
	if c.Delete("k1") {
		t.Fatal("expected delete=false")
	}
}

func TestCacheClear(t *testing.T) {
	c := NewCache(60000, 100)
	c.Set("a", "1")
	c.Set("b", "2")
	c.Clear()
	s := c.Stats()
	if s.Size != 0 {
		t.Fatalf("expected 0 after clear, got %d", s.Size)
	}
}

func TestCacheStats(t *testing.T) {
	c := NewCache(60000, 100)
	c.Set("k", "v")
	c.Get("k")
	c.Get("k")
	c.Get("miss")
	s := c.Stats()
	if s.Hits != 2 || s.Misses != 1 {
		t.Fatalf("expected 2 hits 1 miss, got %+v", s)
	}
}

func TestCacheEviction(t *testing.T) {
	c := NewCache(60000, 10)
	for i := 0; i < 15; i++ {
		c.Set(fmt.Sprintf("k%d", i), "v")
	}
	s := c.Stats()
	if s.Size > 10 {
		t.Fatalf("expected <=10 after eviction, got %d", s.Size)
	}
}

func TestCachePrune(t *testing.T) {
	c := NewCache(1, 100)
	c.Set("a", "1")
	c.Set("b", "2")
	time.Sleep(5 * time.Millisecond)
	n := c.Prune()
	if n != 2 {
		t.Fatalf("expected 2 pruned, got %d", n)
	}
}

func TestCacheKey(t *testing.T) {
	c := NewCache(60000, 100)
	k1 := c.Key("hello", nil)
	k2 := c.Key("hello", nil)
	k3 := c.Key("world", nil)
	if k1 != k2 {
		t.Fatal("same input should produce same key")
	}
	if k1 == k3 {
		t.Fatal("different input should produce different key")
	}
}

func TestCacheConcurrent(t *testing.T) {
	c := NewCache(60000, 1000)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			k := fmt.Sprintf("k%d", i)
			c.Set(k, "v")
			c.Get(k)
			c.Has(k)
		}(i)
	}
	wg.Wait()
	s := c.Stats()
	if s.Size == 0 {
		t.Fatal("expected some entries")
	}
}

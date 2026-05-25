package screening

import (
	"sync"
	"testing"
	"time"
)

func TestLRUCache(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(c *LRUCache)
		getKey  string
		wantHit bool
		wantLen int
	}{
		{
			name: "get after set returns results",
			setup: func(c *LRUCache) {
				c.Set("osama", []Candidate{{Score: 0.99}})
			},
			getKey:  "osama",
			wantHit: true,
			wantLen: 1,
		},
		{
			name:    "get missing key returns false",
			setup:   func(c *LRUCache) {},
			getKey:  "nobody",
			wantHit: false,
			wantLen: 0,
		},
		{
			name: "overwrite updates entry",
			setup: func(c *LRUCache) {
				c.Set("test", []Candidate{{Score: 0.5}})
				c.Set("test", []Candidate{{Score: 0.9}})
			},
			getKey:  "test",
			wantHit: true,
			wantLen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := NewLRUCache(100, 5*time.Minute)
			tt.setup(c)
			_, hit := c.Get(tt.getKey)
			if hit != tt.wantHit {
				t.Errorf("Get(%q) hit=%v, want %v", tt.getKey, hit, tt.wantHit)
			}
			if c.Len() != tt.wantLen {
				t.Errorf("Len()=%d, want %d", c.Len(), tt.wantLen)
			}
		})
	}
}

func TestLRUCacheTTLExpiry(t *testing.T) {
	c := NewLRUCache(100, 1*time.Second)
	now := time.Now()
	c.nowFn = func() time.Time { return now }
	c.Set("key", []Candidate{{Score: 0.8}})

	c.nowFn = func() time.Time { return now.Add(2 * time.Second) }
	_, hit := c.Get("key")
	if hit {
		t.Error("expected miss after TTL expiry")
	}
}

func TestLRUCacheEviction(t *testing.T) {
	c := NewLRUCache(2, 5*time.Minute)
	c.Set("a", []Candidate{{Score: 0.1}})
	c.Set("b", []Candidate{{Score: 0.2}})
	c.Set("c", []Candidate{{Score: 0.3}})

	if _, hit := c.Get("a"); hit {
		t.Error("expected 'a' evicted")
	}
	if _, hit := c.Get("c"); !hit {
		t.Error("expected 'c' present")
	}
}

func TestLRUCacheConcurrent(t *testing.T) {
	c := NewLRUCache(1000, 5*time.Minute)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			key := string(rune('A' + n%26))
			c.Set(key, []Candidate{{Score: float64(n)}})
			c.Get(key)
		}(i)
	}
	wg.Wait()
}

package cache

import (
	"errors"
	"testing"
	"time"
)

func TestTTLCache(t *testing.T) {
	loadCount := 0
	loader := func() (int, error) {
		loadCount++
		return 42, nil
	}

	tests := []struct {
		name string
		fn   func(c *TTLCache[int]) error
		want int
	}{
		{
			name: "miss_then_load",
			fn: func(c *TTLCache[int]) error {
				v, err := c.GetOrLoad("k", loader)
				if v != 42 {
					return errors.New("bad value")
				}
				return err
			},
			want: 1,
		},
		{
			name: "hit_uses_cache",
			fn: func(c *TTLCache[int]) error {
				c.Set("k", 7)
				v, _ := c.GetOrLoad("k", loader)
				if v != 7 {
					return errors.New("should use cached value")
				}
				return nil
			},
			want: 0,
		},
		{
			name: "invalidate_forces_reload",
			fn: func(c *TTLCache[int]) error {
				c.Set("k", 7)
				c.Invalidate("k")
				_, err := c.GetOrLoad("k", loader)
				return err
			},
			want: 1,
		},
		{
			name: "expiry_forces_reload",
			fn: func(c *TTLCache[int]) error {
				c.ttl = time.Millisecond
				c.Set("k", 7)
				time.Sleep(5 * time.Millisecond)
				_, err := c.GetOrLoad("k", loader)
				return err
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loadCount = 0
			c := NewTTLCache[int](time.Minute)
			if err := tt.fn(c); err != nil {
				t.Fatalf("fn: %v", err)
			}
			if loadCount != tt.want {
				t.Fatalf("loader called %d times, want %d", loadCount, tt.want)
			}
		})
	}
}

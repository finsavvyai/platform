package cache

import (
	"testing"
	"time"
)

func TestMemoryCacheGetSet(t *testing.T) {
	tests := []struct {
		name   string
		key    ScreeningCacheKey
		result []byte
	}{
		{
			name:   "basic entity",
			key:    ScreeningCacheKey{EntityName: "John Doe", ListSource: "OFAC"},
			result: []byte(`{"score":0.95}`),
		},
		{
			name:   "entity with DOB",
			key:    ScreeningCacheKey{EntityName: "Jane", EntityDOB: "1990-01-01", ListSource: "EU"},
			result: []byte(`{"score":0.80}`),
		},
		{
			name:   "empty result",
			key:    ScreeningCacheKey{EntityName: "NoMatch", ListSource: "UN"},
			result: []byte(`[]`),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mc := NewMemoryCache()
			if err := mc.Set(tt.key, tt.result, time.Minute); err != nil {
				t.Fatalf("set: %v", err)
			}
			got, err := mc.Get(tt.key)
			if err != nil {
				t.Fatalf("get: %v", err)
			}
			if got == nil {
				t.Fatal("expected entry, got nil")
			}
			if string(got.Result) != string(tt.result) {
				t.Fatalf("got %s, want %s", got.Result, tt.result)
			}
		})
	}
}

func TestMemoryCacheMiss(t *testing.T) {
	mc := NewMemoryCache()
	got, err := mc.Get(ScreeningCacheKey{EntityName: "ghost"})
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil on miss, got %v", got)
	}
}

func TestMemoryCacheTTLExpiry(t *testing.T) {
	mc := NewMemoryCache()
	key := ScreeningCacheKey{EntityName: "expiring", ListSource: "OFAC"}
	if err := mc.Set(key, []byte("data"), time.Millisecond); err != nil {
		t.Fatalf("set: %v", err)
	}
	time.Sleep(5 * time.Millisecond)
	got, err := mc.Get(key)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil after expiry, got %v", got)
	}
}

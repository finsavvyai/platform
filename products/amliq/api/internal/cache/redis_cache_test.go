package cache

import (
	"context"
	"sync"
	"testing"
	"time"
)

type memPool struct {
	mu   sync.Mutex
	data map[string]memEntry
}
type memEntry struct {
	val       []byte
	expiresAt time.Time
}

func newMemPool() *memPool { return &memPool{data: make(map[string]memEntry)} }

func (m *memPool) Get(_ context.Context, key string) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.data[key]
	if !ok || time.Now().After(e.expiresAt) {
		delete(m.data, key)
		return nil, errNotFound{}
	}
	return e.val, nil
}
func (m *memPool) Set(_ context.Context, key string, val []byte, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = memEntry{val: val, expiresAt: time.Now().Add(ttl)}
	return nil
}
func (m *memPool) Del(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}
func (m *memPool) Close() error { return nil }

type errNotFound struct{}

func (errNotFound) Error() string { return "not found" }

func TestSetGetRoundtrip(t *testing.T) {
	tests := []struct {
		name, key string
		val       []byte
	}{
		{"simple", "screen:john:abc", []byte(`{"score":0.95}`)},
		{"empty value", "screen:x:y", []byte(`{}`)},
	}
	ctx := context.Background()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rc := NewRedisCache(newMemPool())
			if err := rc.Set(ctx, tt.key, tt.val, DefaultTTL); err != nil {
				t.Fatalf("set: %v", err)
			}
			got, err := rc.Get(ctx, tt.key)
			if err != nil {
				t.Fatalf("get: %v", err)
			}
			if string(got) != string(tt.val) {
				t.Fatalf("got %s, want %s", got, tt.val)
			}
		})
	}
}

func TestTTLExpiry(t *testing.T) {
	ctx := context.Background()
	rc := NewRedisCache(newMemPool())
	if err := rc.Set(ctx, "k", []byte("v"), 1*time.Millisecond); err != nil {
		t.Fatalf("set: %v", err)
	}
	time.Sleep(5 * time.Millisecond)
	got, err := rc.Get(ctx, "k")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil after expiry, got %s", got)
	}
}

func TestCacheMiss(t *testing.T) {
	ctx := context.Background()
	rc := NewRedisCache(newMemPool())
	got, err := rc.Get(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil on miss, got %s", got)
	}
}

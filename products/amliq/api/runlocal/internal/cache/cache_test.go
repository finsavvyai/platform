package cache

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestKeyGeneration(t *testing.T) {
	tests := []struct {
		name    string
		project string
		deps    string
		unique  bool
	}{
		{"same inputs same key", "myapp", "deps-v1", false},
		{"different project different key", "other", "deps-v1", true},
		{"different deps different key", "myapp", "deps-v2", true},
	}
	gc := NewGlobalCache(NewMemoryStore())
	baseline := gc.Key("myapp", "deps-v1")
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := gc.Key(tt.project, tt.deps)
			if tt.unique && key == baseline {
				t.Errorf("expected unique key, got same as baseline")
			}
			if !tt.unique && key != baseline {
				t.Errorf("expected same key, got different")
			}
			if len(key) != 64 {
				t.Errorf("expected SHA-256 hex (64 chars), got %d", len(key))
			}
		})
	}
}

func TestCacheHitMiss(t *testing.T) {
	tests := []struct {
		name    string
		putKey  string
		getKey  string
		wantHit bool
	}{
		{"hit on existing key", "k1", "k1", true},
		{"miss on unknown key", "k1", "k2", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gc := NewGlobalCache(NewMemoryStore())
			_ = gc.Put(tt.putKey, []byte("data"))
			_, ok := gc.Get(tt.getKey)
			if ok != tt.wantHit {
				t.Errorf("got hit=%v, want %v", ok, tt.wantHit)
			}
		})
	}
}

func TestPredictDeps(t *testing.T) {
	tests := []struct {
		name  string
		stack detect.Stack
		want  int
	}{
		{"node deps", detect.Node, 1},
		{"go deps", detect.Go, 1},
		{"python deps", detect.Python, 1},
		{"unknown stack", detect.Scala, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := PredictDeps(detect.Project{Stack: tt.stack})
			if len(deps) != tt.want {
				t.Errorf("got %d deps, want %d", len(deps), tt.want)
			}
		})
	}
}

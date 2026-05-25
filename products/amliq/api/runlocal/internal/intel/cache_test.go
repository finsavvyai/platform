package intel

import (
	"os"
	"path/filepath"
	"testing"
)

func TestKey(t *testing.T) {
	tests := []struct {
		project, check, want string
	}{
		{"web", "build", "web:build"},
		{".", "test", ".:test"},
	}
	for _, tt := range tests {
		got := Key(tt.project, tt.check)
		if got != tt.want {
			t.Errorf("Key(%q,%q) = %q, want %q", tt.project, tt.check, got, tt.want)
		}
	}
}

func TestHash(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.go"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	h1, err := Hash(dir)
	if err != nil {
		t.Fatal(err)
	}
	if h1 == "" {
		t.Fatal("hash should not be empty")
	}
	// Same content = same hash
	h2, err := Hash(dir)
	if err != nil {
		t.Fatal(err)
	}
	if h1 != h2 {
		t.Error("same dir should produce same hash")
	}
	// Different content = different hash
	if err := os.WriteFile(filepath.Join(dir, "a.go"), []byte("world"), 0o644); err != nil {
		t.Fatal(err)
	}
	h3, err := Hash(dir)
	if err != nil {
		t.Fatal(err)
	}
	if h1 == h3 {
		t.Error("different content should produce different hash")
	}
}

func TestCacheHitMiss(t *testing.T) {
	c := NewCache(t.TempDir())
	k := Key("web", "build")
	if c.IsHit(k, "abc") {
		t.Error("empty cache should miss")
	}
	c.Store(k, "abc")
	if !c.IsHit(k, "abc") {
		t.Error("stored hash should hit")
	}
	if c.IsHit(k, "xyz") {
		t.Error("different hash should miss")
	}
}

func TestCachePersistence(t *testing.T) {
	root := t.TempDir()
	c1 := NewCache(root)
	c1.Store(Key("api", "test"), "hash123")
	if err := c1.Save(); err != nil {
		t.Fatal(err)
	}
	c2 := NewCache(root)
	c2.Load()
	if !c2.IsHit(Key("api", "test"), "hash123") {
		t.Error("loaded cache should have stored entry")
	}
}

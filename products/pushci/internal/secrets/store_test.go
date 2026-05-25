package secrets

import "testing"

func TestStoreSetGet(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	tests := []struct {
		key, value string
	}{
		{"GITHUB_TOKEN", "ghp_abc123"},
		{"AWS_SECRET_KEY", "wJalrXUtnFEMI/K7MDENG"},
		{"DB_PASSWORD", "p@ssw0rd!#$%"},
	}

	for _, tt := range tests {
		if err := store.Set(tt.key, tt.value); err != nil {
			t.Fatalf("Set(%s) error = %v", tt.key, err)
		}
	}

	for _, tt := range tests {
		got, ok := store.Get(tt.key)
		if !ok || got != tt.value {
			t.Errorf("Get(%s) = %q, want %q", tt.key, got, tt.value)
		}
	}
}

func TestStoreList(t *testing.T) {
	dir := t.TempDir()
	store, _ := New(dir)
	store.Set("A", "1")
	store.Set("B", "2")

	keys := store.List()
	if len(keys) != 2 {
		t.Errorf("List() = %d keys, want 2", len(keys))
	}
}

func TestStoreDelete(t *testing.T) {
	dir := t.TempDir()
	store, _ := New(dir)
	store.Set("KEY", "value")
	store.Delete("KEY")

	_, ok := store.Get("KEY")
	if ok {
		t.Error("Get after Delete should return false")
	}
}

func TestStoreEncryption(t *testing.T) {
	dir := t.TempDir()
	store, _ := New(dir)
	store.Set("SECRET", "mysecret")

	// Create new store instance (simulates restart)
	store2, _ := New(dir)
	got, ok := store2.Get("SECRET")
	if !ok || got != "mysecret" {
		t.Errorf("Get after reload = %q, want mysecret", got)
	}
}

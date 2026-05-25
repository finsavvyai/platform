package preview

import "testing"

func TestDeployAndGet(t *testing.T) {
	m := NewManager("https://preview.pushci.dev")
	env, err := m.Deploy("owner/repo", "feature-1", 42)
	if err != nil {
		t.Fatalf("deploy: %v", err)
	}
	if env.Status != "active" {
		t.Errorf("status = %q, want active", env.Status)
	}
	if env.URL == "" {
		t.Error("expected non-empty URL")
	}
	got, ok := m.Get(env.ID)
	if !ok || got.PRID != 42 {
		t.Error("expected to find environment")
	}
}

func TestDestroyAndList(t *testing.T) {
	m := NewManager("https://preview.pushci.dev")
	env, _ := m.Deploy("owner/repo", "feat", 1)
	m.Deploy("owner/repo", "fix", 2)
	if len(m.ListActive()) != 2 {
		t.Errorf("active = %d, want 2", len(m.ListActive()))
	}
	m.Destroy(env.ID)
	if len(m.ListActive()) != 1 {
		t.Errorf("active = %d, want 1", len(m.ListActive()))
	}
}

func TestPromote(t *testing.T) {
	m := NewManager("https://preview.pushci.dev")
	env, _ := m.Deploy("owner/repo", "main", 1)
	promoted, err := m.Promote(env.ID)
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	if promoted.Status != "promoted" {
		t.Errorf("status = %q, want promoted", promoted.Status)
	}
}

func TestPromoteNotFound(t *testing.T) {
	m := NewManager("https://preview.pushci.dev")
	_, err := m.Promote("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent preview")
	}
}

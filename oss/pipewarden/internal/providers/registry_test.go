package providers

import (
	"context"
	"testing"
)

type mockProvider struct {
	name string
	ok   bool
}

func (m *mockProvider) Name() string {
	return m.name
}

func (m *mockProvider) TestConnection(ctx context.Context) error {
	if !m.ok {
		return ErrTestFailed
	}
	return nil
}

func (m *mockProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}

var ErrTestFailed = context.Canceled

func TestRegistryRegister(t *testing.T) {
	reg := NewRegistry()
	p := &mockProvider{name: "test"}

	err := reg.Register("test", p)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestRegistryRegisterDuplicate(t *testing.T) {
	reg := NewRegistry()
	p1 := &mockProvider{name: "test"}
	p2 := &mockProvider{name: "test"}

	_ = reg.Register("test", p1)
	err := reg.Register("test", p2)

	if err == nil {
		t.Error("expected error for duplicate registration")
	}
}

func TestRegistryGet(t *testing.T) {
	reg := NewRegistry()
	p := &mockProvider{name: "test"}

	_ = reg.Register("test", p)
	retrieved, err := reg.Get("test")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if retrieved != p {
		t.Error("expected same provider instance")
	}
}

func TestRegistryGetNotFound(t *testing.T) {
	reg := NewRegistry()

	_, err := reg.Get("nonexistent")

	if err == nil {
		t.Error("expected error for nonexistent provider")
	}
}

func TestRegistryList(t *testing.T) {
	reg := NewRegistry()
	_ = reg.Register("p1", &mockProvider{name: "p1"})
	_ = reg.Register("p2", &mockProvider{name: "p2"})

	names := reg.List()

	if len(names) != 2 {
		t.Errorf("expected 2 providers, got %d", len(names))
	}
}

func TestRegistryRemove(t *testing.T) {
	reg := NewRegistry()
	p := &mockProvider{name: "test"}

	_ = reg.Register("test", p)
	reg.Remove("test")

	_, err := reg.Get("test")
	if err == nil {
		t.Error("expected error after removal")
	}
}

func TestRegistryTestAll(t *testing.T) {
	reg := NewRegistry()
	_ = reg.Register("pass", &mockProvider{name: "pass", ok: true})
	_ = reg.Register("fail", &mockProvider{name: "fail", ok: false})

	results := reg.TestAll(context.Background())

	if !results["pass"] {
		t.Error("expected pass provider to succeed")
	}

	if results["fail"] {
		t.Error("expected fail provider to fail")
	}
}

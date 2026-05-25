package connectors

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeConnector struct{ name string }

func (f *fakeConnector) Name() string { return f.name }
func (f *fakeConnector) Authenticate(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}
func (f *fakeConnector) ListResources(context.Context, uuid.UUID) ([]Resource, error) {
	return []Resource{{ID: "r1", Title: "test", UpdatedAt: time.Now()}}, nil
}
func (f *fakeConnector) Fetch(context.Context, uuid.UUID, string) (*Document, error) {
	return nil, nil
}
func (f *fakeConnector) Search(context.Context, uuid.UUID, string) ([]Resource, error) {
	return nil, nil
}
func (f *fakeConnector) Watch(context.Context, uuid.UUID) (<-chan ChangeEvent, error) {
	ch := make(chan ChangeEvent)
	close(ch)
	return ch, nil
}

func TestRegistry_RegisterAndGet(t *testing.T) {
	r := NewRegistry()
	c := &fakeConnector{name: "foo"}
	if err := r.Register(c); err != nil {
		t.Fatalf("Register: %v", err)
	}
	got, ok := r.Get("foo")
	if !ok || got.Name() != "foo" {
		t.Fatalf("Get failed: ok=%v name=%v", ok, got)
	}
}

func TestRegistry_RejectsDuplicate(t *testing.T) {
	r := NewRegistry()
	_ = r.Register(&fakeConnector{name: "x"})
	if err := r.Register(&fakeConnector{name: "x"}); !errors.Is(err, ErrDuplicate) {
		t.Fatalf("dup must be ErrDuplicate, got %v", err)
	}
}

func TestRegistry_ListAndUnregister(t *testing.T) {
	r := NewRegistry()
	for _, n := range []string{"a", "b", "c"} {
		_ = r.Register(&fakeConnector{name: n})
	}
	if got := r.List(); len(got) != 3 {
		t.Fatalf("List length: %d", len(got))
	}
	r.Unregister("b")
	if got := r.List(); len(got) != 2 {
		t.Fatalf("after unregister: %d", len(got))
	}
}

func TestFakeConnector_SatisfiesInterface(t *testing.T) {
	var _ Connector = (*fakeConnector)(nil)
}

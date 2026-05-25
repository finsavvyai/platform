package exec

import (
	"context"
	"testing"

	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

type fakeAdapter struct{ name string }

func (f *fakeAdapter) Name() string             { return f.name }
func (f *fakeAdapter) Capabilities() Capabilities { return Capabilities{Idempotent: true} }
func (f *fakeAdapter) Validate(map[string]any) error { return nil }
func (f *fakeAdapter) DryRun(context.Context, types.Insight, map[string]any) (Preview, error) {
	return Preview{Summary: "ok"}, nil
}
func (f *fakeAdapter) Execute(context.Context, types.Insight, map[string]any) (types.Receipt, error) {
	return types.Receipt{AdapterName: f.name}, nil
}

func TestRegistryRoundTrip(t *testing.T) {
	r := NewRegistry()
	if err := r.Register(&fakeAdapter{name: "jira"}); err != nil {
		t.Fatal(err)
	}
	if err := r.Register(&fakeAdapter{name: "jira"}); err == nil {
		t.Fatal("duplicate register must error")
	}
	a, ok := r.Get("jira")
	if !ok {
		t.Fatal("expected adapter present")
	}
	rec, err := a.Execute(context.Background(), types.Insight{}, nil)
	if err != nil || rec.AdapterName != "jira" {
		t.Fatalf("unexpected: %+v %v", rec, err)
	}
}

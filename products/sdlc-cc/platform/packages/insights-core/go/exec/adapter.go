package exec

import (
	"context"
	"errors"

	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

type Capabilities struct {
	Idempotent       bool
	RequiresApproval bool
}

type Preview struct {
	Summary string         `json:"summary"`
	Payload map[string]any `json:"payload"`
}

// Adapter is the contract implemented by every exec target (Jira, Slack, …).
// Full impls arrive in T-108+; T-107 implements the router that drives this.
type Adapter interface {
	Name() string
	Capabilities() Capabilities
	Validate(params map[string]any) error
	DryRun(ctx context.Context, ins types.Insight, params map[string]any) (Preview, error)
	Execute(ctx context.Context, ins types.Insight, params map[string]any) (types.Receipt, error)
}

// Registry holds the active adapters, keyed by Name().
type Registry struct {
	adapters map[string]Adapter
}

func NewRegistry() *Registry { return &Registry{adapters: map[string]Adapter{}} }

func (r *Registry) Register(a Adapter) error {
	if a == nil {
		return errors.New("adapter nil")
	}
	if _, exists := r.adapters[a.Name()]; exists {
		return errors.New("adapter already registered: " + a.Name())
	}
	r.adapters[a.Name()] = a
	return nil
}

func (r *Registry) Get(name string) (Adapter, bool) {
	a, ok := r.adapters[name]
	return a, ok
}

func (r *Registry) Names() []string {
	out := make([]string, 0, len(r.adapters))
	for k := range r.adapters {
		out = append(out, k)
	}
	return out
}

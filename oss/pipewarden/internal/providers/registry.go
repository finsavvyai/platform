package providers

import (
	"context"
	"fmt"
	"sync"
)

type Registry struct {
	mu        sync.RWMutex
	providers map[string]Provider
}

func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
	}
}

func (r *Registry) Register(name string, p Provider) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.providers[name]; exists {
		return fmt.Errorf("provider already registered: %s", name)
	}

	r.providers[name] = p
	return nil
}

func (r *Registry) Get(name string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, exists := r.providers[name]
	if !exists {
		return nil, fmt.Errorf("provider not found: %s", name)
	}

	return p, nil
}

func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}

func (r *Registry) Remove(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.providers, name)
}

func (r *Registry) TestAll(ctx context.Context) map[string]bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	results := make(map[string]bool)
	for name, p := range r.providers {
		results[name] = p.TestConnection(ctx) == nil
	}
	return results
}

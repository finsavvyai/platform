package langfuse

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
)

// PromptStore persists named, versioned prompt templates per tenant.
// Production deployments back this onto Postgres; the in-memory impl is
// used for tests and the OSS quick-start.
type PromptStore interface {
	Put(ctx context.Context, tenantID string, p Prompt) (Prompt, error)
	GetLatest(ctx context.Context, tenantID, name string) (Prompt, error)
	GetVersion(ctx context.Context, tenantID, name string, version int) (Prompt, error)
}

// ScoreSink receives validated Score events. Implementations forward to
// Postgres + the gateway events publisher so audit + dashboards both see
// the same data.
type ScoreSink interface {
	Record(ctx context.Context, tenantID string, s Score) error
}

// TraceSink receives Trace events. Same pattern as ScoreSink.
type TraceSink interface {
	Record(ctx context.Context, tenantID string, t Trace) error
}

// ErrPromptNotFound signals a 404 path on prompt lookup.
var ErrPromptNotFound = errors.New("langfuse: prompt not found")

// MemoryPromptStore is an in-memory PromptStore for dev/tests. It auto-
// versions prompts by incrementing on each Put with the same (tenant, name).
type MemoryPromptStore struct {
	mu sync.RWMutex
	// tenantID -> name -> version -> prompt
	data map[string]map[string]map[int]Prompt
}

// NewMemoryPromptStore returns an empty in-memory prompt store.
func NewMemoryPromptStore() *MemoryPromptStore {
	return &MemoryPromptStore{data: make(map[string]map[string]map[int]Prompt)}
}

// Put stores the prompt, assigning the next version if one isn't supplied.
func (m *MemoryPromptStore) Put(_ context.Context, tenantID string, p Prompt) (Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	name := strings.TrimSpace(p.Name)
	if name == "" {
		return Prompt{}, errors.New("langfuse: prompt name required")
	}

	if m.data[tenantID] == nil {
		m.data[tenantID] = map[string]map[int]Prompt{}
	}
	if m.data[tenantID][name] == nil {
		m.data[tenantID][name] = map[int]Prompt{}
	}

	if p.Version == 0 {
		p.Version = nextVersion(m.data[tenantID][name])
	}
	m.data[tenantID][name][p.Version] = p
	return p, nil
}

// GetLatest returns the highest-versioned prompt for (tenant, name).
func (m *MemoryPromptStore) GetLatest(_ context.Context, tenantID, name string) (Prompt, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	versions, ok := m.data[tenantID][name]
	if !ok || len(versions) == 0 {
		return Prompt{}, ErrPromptNotFound
	}
	keys := make([]int, 0, len(versions))
	for k := range versions {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	return versions[keys[len(keys)-1]], nil
}

// GetVersion returns the exact (tenant, name, version) prompt or ErrPromptNotFound.
func (m *MemoryPromptStore) GetVersion(_ context.Context, tenantID, name string, version int) (Prompt, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	versions, ok := m.data[tenantID][name]
	if !ok {
		return Prompt{}, ErrPromptNotFound
	}
	p, ok := versions[version]
	if !ok {
		return Prompt{}, ErrPromptNotFound
	}
	return p, nil
}

func nextVersion(versions map[int]Prompt) int {
	max := 0
	for v := range versions {
		if v > max {
			max = v
		}
	}
	return max + 1
}

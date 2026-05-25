// Package connectors — Registry + RBAC scope tagging.
//
// Day 39: extracted from connector.go so the interface file stays
// strictly the contract. Adds per-connector scope metadata used by
// the gateway's RBAC layer when proxying connector API calls.
//
// Thread-safety: all public methods acquire the appropriate lock.
package connectors

import (
	"errors"
	"sort"
	"sync"
)

// ErrDuplicate is returned by Register when the name is taken.
var ErrDuplicate = errors.New("connectors: name already registered")

// ErrUnknown is returned by Get/Scopes when the connector isn't registered.
var ErrUnknown = errors.New("connectors: unknown connector")

// Scope is a single RBAC capability string a connector requires.
// Format: "<verb>:<resource>" (e.g. "read:drive", "read:tickets").
// The gateway uses these to short-circuit calls that the caller's
// API key isn't allowed to make.
type Scope string

// Metadata is the registration-time information about a connector.
// Values here flow to the marketplace UI + the audit log.
type Metadata struct {
	Name        string  // canonical id (e.g. "google_workspace")
	DisplayName string  // human-friendly (e.g. "Google Workspace")
	Vendor      string  // "Google", "Microsoft", "Atlassian", ...
	Category    string  // "productivity" | "communication" | "crm" | "support" | "devtools"
	Scopes      []Scope // RBAC scopes required to use this connector
	DocsURL     string  // link to the per-vendor onboarding doc
}

// Registry tracks connectors keyed by Name. Goroutine-safe.
type Registry struct {
	mu   sync.RWMutex
	m    map[string]Connector
	meta map[string]Metadata
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		m:    make(map[string]Connector),
		meta: make(map[string]Metadata),
	}
}

// Register adds a connector with no extra metadata.
// Returns ErrDuplicate when the name is already registered.
func (r *Registry) Register(c Connector) error {
	return r.RegisterWithMeta(c, Metadata{Name: c.Name()})
}

// RegisterWithMeta adds a connector and stores its RBAC + UI metadata.
// If meta.Name is empty it is filled in from c.Name().
func (r *Registry) RegisterWithMeta(c Connector, meta Metadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, dup := r.m[c.Name()]; dup {
		return ErrDuplicate
	}
	if meta.Name == "" {
		meta.Name = c.Name()
	}
	r.m[c.Name()] = c
	r.meta[c.Name()] = meta
	return nil
}

// Get returns the connector by name.
func (r *Registry) Get(name string) (Connector, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.m[name]
	return c, ok
}

// Meta returns the metadata for a registered connector.
func (r *Registry) Meta(name string) (Metadata, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.meta[name]
	if !ok {
		return Metadata{}, ErrUnknown
	}
	return m, nil
}

// Scopes returns the RBAC scopes a connector requires.
// Convenience wrapper around Meta for the policy-check path.
func (r *Registry) Scopes(name string) ([]Scope, error) {
	m, err := r.Meta(name)
	if err != nil {
		return nil, err
	}
	out := make([]Scope, len(m.Scopes))
	copy(out, m.Scopes)
	return out, nil
}

// List returns every registered name, sorted ascending.
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.m))
	for k := range r.m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ListMeta returns every registration's metadata, sorted by name.
// The marketplace UI reads this directly via the /admin/connectors API.
func (r *Registry) ListMeta() []Metadata {
	names := r.List()
	out := make([]Metadata, 0, len(names))
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, n := range names {
		out = append(out, r.meta[n])
	}
	return out
}

// Unregister removes a connector. Used by tests + the marketplace
// uninstall flow.
func (r *Registry) Unregister(name string) {
	r.mu.Lock()
	delete(r.m, name)
	delete(r.meta, name)
	r.mu.Unlock()
}

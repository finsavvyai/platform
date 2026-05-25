// Package monitoring tracks ongoing-monitoring subscriptions.
// In-memory now; depend on Registrar so a Postgres impl can swap in.
package monitoring

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var subSeq uint64

// Subscription is a request to be notified when entity_id changes.
type Subscription struct {
	ID         string
	TenantID   string
	EntityID   string
	WebhookURL string
	Events     []string
	CreatedAt  time.Time
}

// Registrar is the contract; in-memory and Postgres impls satisfy it.
type Registrar interface {
	Register(tenantID, entityID, webhookURL string, events []string) (Subscription, error)
	List(tenantID, entityID string) []Subscription
	Unregister(tenantID, subscriptionID string) bool
}

// MemRegistrar is the process-local Registrar used in dev and tests.
// Safe for concurrent use.
type MemRegistrar struct {
	mu   sync.RWMutex
	subs map[string]Subscription // keyed by Subscription.ID
}

// NewMemRegistrar returns a ready-to-use in-memory registrar.
func NewMemRegistrar() *MemRegistrar {
	return &MemRegistrar{subs: make(map[string]Subscription)}
}

// Register stores a subscription. Returns an error on validation failure.
func (r *MemRegistrar) Register(
	tenantID, entityID, webhookURL string, events []string,
) (Subscription, error) {
	if tenantID == "" || entityID == "" || webhookURL == "" {
		return Subscription{}, fmt.Errorf(
			"tenant_id, entity_id, and webhook_url are required")
	}
	if len(events) == 0 {
		events = []string{"monitor.match_found"}
	}
	sub := Subscription{
		ID:         fmt.Sprintf("sub_%d_%d", time.Now().UnixNano(), atomic.AddUint64(&subSeq, 1)),
		TenantID:   tenantID,
		EntityID:   entityID,
		WebhookURL: webhookURL,
		Events:     events,
		CreatedAt:  time.Now().UTC(),
	}
	r.mu.Lock()
	r.subs[sub.ID] = sub
	r.mu.Unlock()
	return sub, nil
}

// List returns subscriptions for a tenant; if entityID is non-empty
// it filters to just that entity. Order is unspecified.
func (r *MemRegistrar) List(tenantID, entityID string) []Subscription {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Subscription, 0)
	for _, s := range r.subs {
		if s.TenantID != tenantID {
			continue
		}
		if entityID != "" && s.EntityID != entityID {
			continue
		}
		out = append(out, s)
	}
	return out
}

// Unregister deletes a subscription. Returns true if the subscription
// existed and belonged to the caller's tenant.
func (r *MemRegistrar) Unregister(tenantID, subscriptionID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.subs[subscriptionID]
	if !ok || s.TenantID != tenantID {
		return false
	}
	delete(r.subs, subscriptionID)
	return true
}

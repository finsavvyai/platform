package tasklog

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// Registry tracks task executions in memory with bounded size.
type Registry struct {
	mu      sync.RWMutex
	entries []Entry
	maxSize int
}

// NewRegistry creates a task registry with max entries cap.
func NewRegistry(maxSize int) *Registry {
	if maxSize <= 0 {
		maxSize = 500
	}
	return &Registry{maxSize: maxSize, entries: make([]Entry, 0, 64)}
}

// Start records a new task run and returns its ID.
func (r *Registry) Start(taskName, trigger, actorID, tenantID string) string {
	id := newTaskID()
	entry := Entry{
		ID:        id,
		TaskName:  taskName,
		TenantID:  tenantID,
		Trigger:   trigger,
		Status:    StatusRunning,
		StartedAt: time.Now().UTC(),
		ActorID:   actorID,
	}
	r.mu.Lock()
	r.entries = append(r.entries, entry)
	if len(r.entries) > r.maxSize {
		r.entries = r.entries[len(r.entries)-r.maxSize:]
	}
	r.mu.Unlock()
	return id
}

// Complete marks a task as finished.
func (r *Registry) Complete(id string, status Status, output, errMsg string) {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := len(r.entries) - 1; i >= 0; i-- {
		if r.entries[i].ID == id {
			r.entries[i].Status = status
			r.entries[i].EndedAt = &now
			r.entries[i].DurationMs = now.Sub(r.entries[i].StartedAt).Milliseconds()
			r.entries[i].Output = output
			r.entries[i].Error = errMsg
			return
		}
	}
}

// List returns recent entries, newest first.
func (r *Registry) List(limit int) []Entry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if limit <= 0 || limit > len(r.entries) {
		limit = len(r.entries)
	}
	result := make([]Entry, limit)
	for i := 0; i < limit; i++ {
		result[i] = r.entries[len(r.entries)-1-i]
	}
	return result
}

// ListByTenant filters entries for a tenant (including global tasks).
func (r *Registry) ListByTenant(tenantID string, limit int) []Entry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Entry, 0, limit)
	for i := len(r.entries) - 1; i >= 0 && len(result) < limit; i-- {
		e := r.entries[i]
		if e.TenantID == "" || e.TenantID == tenantID {
			result = append(result, e)
		}
	}
	return result
}

func newTaskID() string {
	return uuid.New().String()
}

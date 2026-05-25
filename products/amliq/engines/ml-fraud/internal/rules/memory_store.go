package rules

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// MemoryStore is a concurrency-safe, in-memory implementation of RuleRepository.
// It enforces strict tenant isolation at the query layer.
type MemoryStore struct {
	mu    sync.RWMutex
	rules map[string]*Rule // keyed by rule ID
	seq   int              // monotonic ID sequence
}

// NewMemoryStore returns a ready-to-use MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{rules: make(map[string]*Rule)}
}

// Create persists a new rule, assigning an ID if empty.
func (m *MemoryStore) Create(_ context.Context, rule *Rule) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if rule.ID == "" {
		m.seq++
		rule.ID = fmt.Sprintf("rule-%d", m.seq)
	}
	if _, exists := m.rules[rule.ID]; exists {
		return ErrDuplicateRuleID
	}

	now := time.Now()
	rule.CreatedAt = now
	rule.UpdatedAt = now

	stored := *rule
	stored.Conditions = copyConditions(rule.Conditions)
	stored.Actions = copyActions(rule.Actions)
	m.rules[rule.ID] = &stored
	return nil
}

// Get retrieves a rule by ID, enforcing tenant isolation.
func (m *MemoryStore) Get(_ context.Context, tenantID, ruleID string) (*Rule, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return nil, ErrRuleNotFound
	}
	cp := *r
	return &cp, nil
}

// List returns tenant-scoped rules with optional filter and pagination.
func (m *MemoryStore) List(_ context.Context, tenantID string, f ListFilter) ([]*Rule, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*Rule
	for _, r := range m.rules {
		if r.TenantID != tenantID {
			continue
		}
		if f.EnabledOnly != nil && *f.EnabledOnly && !r.Enabled {
			continue
		}
		if f.DisabledOnly != nil && *f.DisabledOnly && r.Enabled {
			continue
		}
		cp := *r
		result = append(result, &cp)
	}

	// Sort by priority descending for deterministic results
	sort.Slice(result, func(i, j int) bool {
		return result[i].Priority > result[j].Priority
	})

	// Pagination
	if f.Offset > 0 {
		if f.Offset >= len(result) {
			return []*Rule{}, nil
		}
		result = result[f.Offset:]
	}
	if f.Limit > 0 && f.Limit < len(result) {
		result = result[:f.Limit]
	}

	return result, nil
}

// Update replaces a rule, enforcing tenant isolation.
func (m *MemoryStore) Update(_ context.Context, rule *Rule) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.rules[rule.ID]
	if !ok || existing.TenantID != rule.TenantID {
		return ErrRuleNotFound
	}

	rule.CreatedAt = existing.CreatedAt
	rule.UpdatedAt = time.Now()

	stored := *rule
	stored.Conditions = copyConditions(rule.Conditions)
	stored.Actions = copyActions(rule.Actions)
	m.rules[rule.ID] = &stored
	return nil
}

// Delete removes a rule, enforcing tenant isolation.
func (m *MemoryStore) Delete(_ context.Context, tenantID, ruleID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return ErrRuleNotFound
	}
	delete(m.rules, ruleID)
	return nil
}

// SetEnabled toggles the enabled flag, enforcing tenant isolation.
func (m *MemoryStore) SetEnabled(_ context.Context, tenantID, ruleID string, enabled bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return ErrRuleNotFound
	}
	r.Enabled = enabled
	r.UpdatedAt = time.Now()
	return nil
}

// --- deep copy helpers ---

func copyConditions(src []RuleCondition) []RuleCondition {
	dst := make([]RuleCondition, len(src))
	copy(dst, src)
	return dst
}

func copyActions(src []RuleAction) []RuleAction {
	dst := make([]RuleAction, len(src))
	copy(dst, src)
	return dst
}

package automation

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// Store is the rule persistence interface.
type Store interface {
	List(tenantID string) ([]Rule, error)
	Get(tenantID, id string) (*Rule, error)
	Create(rule Rule) (*Rule, error)
	Update(rule Rule) (*Rule, error)
	Delete(tenantID, id string) error
	ForTrigger(tenantID string, trigger TriggerType) ([]Rule, error)
}

// InMemoryStore is a non-persistent rule store (for dev/testing).
type InMemoryStore struct {
	mu    sync.RWMutex
	rules map[string]Rule // key: tenantID+"/"+id
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{rules: make(map[string]Rule)}
}

func (s *InMemoryStore) key(tenantID, id string) string {
	return tenantID + "/" + id
}

func (s *InMemoryStore) List(tenantID string) ([]Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Rule
	for k, r := range s.rules {
		if len(k) > len(tenantID) && k[:len(tenantID)] == tenantID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *InMemoryStore) Get(tenantID, id string) (*Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rules[s.key(tenantID, id)]
	if !ok {
		return nil, errors.New("rule not found")
	}
	return &r, nil
}

func (s *InMemoryStore) Create(rule Rule) (*Rule, error) {
	if err := rule.Validate(); err != nil {
		return nil, err
	}
	rule.ID = generateID()
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = rule.CreatedAt
	s.mu.Lock()
	s.rules[s.key(rule.TenantID, rule.ID)] = rule
	s.mu.Unlock()
	return &rule, nil
}

func (s *InMemoryStore) Update(rule Rule) (*Rule, error) {
	if err := rule.Validate(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.rules[s.key(rule.TenantID, rule.ID)]
	if !ok {
		return nil, errors.New("rule not found")
	}
	rule.CreatedAt = existing.CreatedAt
	rule.UpdatedAt = time.Now()
	s.rules[s.key(rule.TenantID, rule.ID)] = rule
	return &rule, nil
}

func (s *InMemoryStore) Delete(tenantID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	k := s.key(tenantID, id)
	if _, ok := s.rules[k]; !ok {
		return errors.New("rule not found")
	}
	delete(s.rules, k)
	return nil
}

func (s *InMemoryStore) ForTrigger(
	tenantID string, trigger TriggerType,
) ([]Rule, error) {
	all, err := s.List(tenantID)
	if err != nil {
		return nil, err
	}
	var out []Rule
	for _, r := range all {
		if r.Enabled && r.Trigger == trigger {
			out = append(out, r)
		}
	}
	return out, nil
}

func generateID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "rule_" + hex.EncodeToString(b)
}

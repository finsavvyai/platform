package domain_verification

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// DomainStatus tracks the lifecycle of a domain verification record.
type DomainStatus string

const (
	StatusPending  DomainStatus = "pending"
	StatusVerified DomainStatus = "verified"
	StatusExpired  DomainStatus = "expired"
)

// DomainRecord is one tenant-owned domain and its verification state.
type DomainRecord struct {
	ID         uuid.UUID
	TenantID   uuid.UUID
	Domain     string
	Token      Token
	Method     VerifyMethod
	Status     DomainStatus
	VerifiedAt *time.Time
	ExpiresAt  *time.Time
	CreatedAt  time.Time
}

// IsExpired returns true when the record is verified but past its expiry window.
func (r DomainRecord) IsExpired(now time.Time) bool {
	return r.Status == StatusVerified && r.ExpiresAt != nil && now.After(*r.ExpiresAt)
}

// SSOURLFunc resolves a tenant's SSO start URL. Returns "" when no SSO is
// configured for the tenant.
type SSOURLFunc func(ctx context.Context, tenantID uuid.UUID) (string, error)

// ErrNotFound is returned by Store when no matching record exists.
var ErrNotFound = errors.New("domain_verification: record not found")

// Store persists domain verification records.
type Store interface {
	Save(ctx context.Context, r DomainRecord) error
	Get(ctx context.Context, tenantID uuid.UUID, domain string) (DomainRecord, error)
	List(ctx context.Context, tenantID uuid.UUID) ([]DomainRecord, error)
	Delete(ctx context.Context, tenantID uuid.UUID, domain string) error
	FindVerifiedByDomain(ctx context.Context, domain string) (DomainRecord, error)
}

// MemStore is a concurrency-safe in-memory Store for tests and local dev.
type MemStore struct {
	mu      sync.RWMutex
	records map[string]DomainRecord
}

// NewMemStore returns a ready-to-use MemStore.
func NewMemStore() *MemStore { return &MemStore{records: make(map[string]DomainRecord)} }

func memKey(tenantID uuid.UUID, domain string) string { return tenantID.String() + "/" + domain }

func (m *MemStore) Save(_ context.Context, r DomainRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.records[memKey(r.TenantID, r.Domain)] = r
	return nil
}

func (m *MemStore) Get(_ context.Context, tenantID uuid.UUID, domain string) (DomainRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.records[memKey(tenantID, domain)]
	if !ok {
		return DomainRecord{}, ErrNotFound
	}
	return r, nil
}

func (m *MemStore) List(_ context.Context, tenantID uuid.UUID) ([]DomainRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	prefix := tenantID.String() + "/"
	var out []DomainRecord
	for k, v := range m.records {
		if strings.HasPrefix(k, prefix) {
			out = append(out, v)
		}
	}
	return out, nil
}

func (m *MemStore) Delete(_ context.Context, tenantID uuid.UUID, domain string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.records, memKey(tenantID, domain))
	return nil
}

func (m *MemStore) FindVerifiedByDomain(_ context.Context, domain string) (DomainRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, r := range m.records {
		if r.Domain == domain && r.Status == StatusVerified {
			return r, nil
		}
	}
	return DomainRecord{}, ErrNotFound
}

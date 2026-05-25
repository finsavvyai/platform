package onboarding

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Sentinel errors for sandbox operations.
var (
	ErrSandboxNotFound      = errors.New("sandbox not found")
	ErrSandboxAlreadyExists = errors.New("sandbox already exists for tenant")
)

// SandboxService defines operations for managing tenant sandbox environments.
type SandboxService interface {
	Provision(ctx context.Context, tenantID string) (*SandboxConfig, error)
	GetStatus(ctx context.Context, tenantID string) (*SandboxConfig, error)
	Cleanup(ctx context.Context, tenantID string) error
	IsExpired(ctx context.Context, tenantID string) (bool, error)
}

// InMemorySandboxService stores sandbox configurations in memory.
type InMemorySandboxService struct {
	mu         sync.RWMutex
	sandboxes  map[string]*SandboxConfig
	expiryDays int
}

// NewInMemorySandboxService creates a new in-memory sandbox service.
func NewInMemorySandboxService(expiryDays int) *InMemorySandboxService {
	return &InMemorySandboxService{
		sandboxes:  make(map[string]*SandboxConfig),
		expiryDays: expiryDays,
	}
}

// Provision creates a new sandbox environment for the given tenant.
// Returns ErrSandboxAlreadyExists if a sandbox is already provisioned.
func (s *InMemorySandboxService) Provision(
	_ context.Context, tenantID string,
) (*SandboxConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sandboxes[tenantID]; exists {
		return nil, ErrSandboxAlreadyExists
	}

	apiKey, err := generateSandboxAPIKey()
	if err != nil {
		return nil, fmt.Errorf("generating API key: %w", err)
	}

	// Store hashed key; return plaintext only once on creation.
	hashedKey := hashAPIKey(apiKey)

	cfg := &SandboxConfig{
		TenantID:            tenantID,
		APIEndpoint:         "https://sandbox.finsavvy.ai/api/v1",
		APIKey:              hashedKey,
		ExpiresAt:           time.Now().AddDate(0, 0, s.expiryDays),
		SyntheticDataLoaded: true,
		TransactionCount:    100,
	}

	s.sandboxes[tenantID] = cfg

	// Return a copy with the plaintext key (shown once to user).
	result := *cfg
	result.APIKey = apiKey
	return &result, nil
}

// GetStatus returns the sandbox configuration for the given tenant.
func (s *InMemorySandboxService) GetStatus(
	_ context.Context, tenantID string,
) (*SandboxConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cfg, exists := s.sandboxes[tenantID]
	if !exists {
		return nil, ErrSandboxNotFound
	}
	copied := *cfg
	return &copied, nil
}

// Cleanup removes the sandbox for the given tenant.
func (s *InMemorySandboxService) Cleanup(
	_ context.Context, tenantID string,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.sandboxes[tenantID]; !exists {
		return ErrSandboxNotFound
	}
	delete(s.sandboxes, tenantID)
	return nil
}

// IsExpired checks whether the tenant's sandbox has passed its expiry time.
func (s *InMemorySandboxService) IsExpired(
	_ context.Context, tenantID string,
) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cfg, exists := s.sandboxes[tenantID]
	if !exists {
		return false, ErrSandboxNotFound
	}
	return time.Now().After(cfg.ExpiresAt), nil
}

// generateSandboxAPIKey produces "sk_sandbox_" followed by 16 random hex chars.
func generateSandboxAPIKey() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("reading random bytes: %w", err)
	}
	return "sk_sandbox_" + hex.EncodeToString(b), nil
}

// hashAPIKey returns a SHA-256 hex digest of the key for safe storage.
func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

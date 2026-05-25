package api

import (
	"sync"

	"github.com/aegis-aml/aegis/internal/webhook"
)

// WebhookSecretStore holds per-tenant HMAC signing secrets.
// Production: persist via SecretRepository. In-memory for now.
type WebhookSecretStore struct {
	mu      sync.RWMutex
	secrets map[string]string // tenant_id → secret
}

func NewWebhookSecretStore() *WebhookSecretStore {
	return &WebhookSecretStore{secrets: make(map[string]string)}
}

// Get returns the tenant's secret, generating one on first access.
func (s *WebhookSecretStore) Get(tenantID string) (string, error) {
	s.mu.RLock()
	if sec, ok := s.secrets[tenantID]; ok {
		s.mu.RUnlock()
		return sec, nil
	}
	s.mu.RUnlock()
	return s.Rotate(tenantID)
}

// Has reports whether a secret is already stored for the tenant
// without the side-effect of generating one. Used by the
// onboarding-progress endpoint to decide whether the webhook step
// has been completed; calling Get there would falsely flip the
// step on the very first read.
func (s *WebhookSecretStore) Has(tenantID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.secrets[tenantID]
	return ok
}

// Rotate creates a new secret for the tenant.
func (s *WebhookSecretStore) Rotate(tenantID string) (string, error) {
	sec, err := webhook.GenerateSecret()
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	s.secrets[tenantID] = sec
	s.mu.Unlock()
	return sec, nil
}

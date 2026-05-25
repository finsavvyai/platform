package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// SecretType represents the type of secret
type SecretType string

const (
	SecretTypeDatabase      SecretType = "database"
	SecretTypeAPIKey        SecretType = "api_key"
	SecretTypeJWT           SecretType = "jwt"
	SecretTypeEncryption    SecretType = "encryption"
	SecretTypeServiceConfig SecretType = "service_config"
	SecretTypeExternal      SecretType = "external"
)

// Secret represents a secret with metadata
type Secret struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        SecretType             `json:"type"`
	Value       string                 `json:"value"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
	RotatedAt   *time.Time             `json:"rotated_at,omitempty"`
	Version     int                    `json:"version"`
	Tags        map[string]string      `json:"tags,omitempty"`
}

// SecretConfig represents configuration for secret management
type SecretConfig struct {
	Provider      string        `json:"provider"`
	Region        string        `json:"region"`
	CacheTTL      time.Duration `json:"cache_ttl"`
	RotationTTL   time.Duration `json:"rotation_ttl"`
	AutoRotate    bool          `json:"auto_rotate"`
	EncryptionKey string        `json:"encryption_key,omitempty"`
}

// SecretService provides a unified interface for secret management
type SecretService struct {
	provider     Provider
	config       SecretConfig
	rotationJobs map[string]*time.Timer
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

// Provider interface for different secret management backends
type Provider interface {
	GetSecret(ctx context.Context, secretName string) (string, error)
	GetSecretJSON(ctx context.Context, secretName string, target interface{}) error
	CreateSecret(ctx context.Context, secretName, description string, secretValue string, tags map[string]string) error
	UpdateSecret(ctx context.Context, secretName, secretValue string) error
	RotateSecret(ctx context.Context, secretName string) error
	ListSecrets(ctx context.Context, filters map[string]string) ([]SecretMetadata, error)
	DeleteSecret(ctx context.Context, secretName string, forceDelete bool) error
	RestoreSecret(ctx context.Context, secretName string) error
	HealthCheck(ctx context.Context) error
}

// NewSecretService creates a new secret service instance
func NewSecretService(ctx context.Context, config SecretConfig) (*SecretService, error) {
	// Create child context
	serviceCtx, cancel := context.WithCancel(ctx)

	var provider Provider
	var err error

	switch config.Provider {
	case "aws", "aws-secrets-manager":
		provider, err = NewAWSSecretsManager(serviceCtx, config.Region)
	// case "vault":
	// 	provider, err = NewVaultProvider(serviceCtx, config)
	// case "local":
	// 	provider, err = NewLocalProvider(serviceCtx, config)
	default:
		cancel()
		return nil, fmt.Errorf("unsupported secret provider: %s", config.Provider)
	}

	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create secret provider: %w", err)
	}

	service := &SecretService{
		provider:     provider,
		config:       config,
		rotationJobs: make(map[string]*time.Timer),
		ctx:          serviceCtx,
		cancel:       cancel,
	}

	// Start background routines
	go service.startRotationMonitor()

	return service, nil
}

// GetSecret retrieves a secret by name
func (s *SecretService) GetSecret(ctx context.Context, secretName string) (string, error) {
	return s.provider.GetSecret(ctx, secretName)
}

// GetSecretJSON retrieves a secret and unmarshals it as JSON
func (s *SecretService) GetSecretJSON(ctx context.Context, secretName string, target interface{}) error {
	return s.provider.GetSecretJSON(ctx, secretName, target)
}

// CreateSecret creates a new secret
func (s *SecretService) CreateSecret(ctx context.Context, secret *Secret) error {
	// Validate secret
	if err := s.validateSecret(secret); err != nil {
		return fmt.Errorf("secret validation failed: %w", err)
	}

	// Generate ID if not provided
	if secret.ID == "" {
		secret.ID = uuid.New().String()
	}

	// Set timestamps
	now := time.Now()
	secret.CreatedAt = now
	secret.UpdatedAt = now
	secret.Version = 1

	// Add default tags
	if secret.Tags == nil {
		secret.Tags = make(map[string]string)
	}
	secret.Tags["type"] = string(secret.Type)
	secret.Tags["created_by"] = "quantumbeam-api"

	// Prepare metadata JSON
	metadataJSON, err := json.Marshal(secret.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Prepare tags for provider
	tags := secret.Tags
	tags["id"] = secret.ID
	tags["version"] = fmt.Sprintf("%d", secret.Version)
	tags["metadata"] = string(metadataJSON)

	// Create secret with provider
	err = s.provider.CreateSecret(ctx, secret.Name, secret.Description, secret.Value, tags)
	if err != nil {
		return fmt.Errorf("failed to create secret: %w", err)
	}

	// Schedule rotation if auto-rotate is enabled
	if s.config.AutoRotate && s.config.RotationTTL > 0 {
		s.scheduleRotation(secret.Name, s.config.RotationTTL)
	}

	log.Printf("Secret '%s' created successfully", secret.Name)
	return nil
}

// UpdateSecret updates an existing secret
func (s *SecretService) UpdateSecret(ctx context.Context, secretName string, value string, description string) error {
	// Update secret with provider
	err := s.provider.UpdateSecret(ctx, secretName, value)
	if err != nil {
		return fmt.Errorf("failed to update secret: %w", err)
	}

	log.Printf("Secret '%s' updated successfully", secretName)
	return nil
}

// RotateSecret rotates a secret immediately
func (s *SecretService) RotateSecret(ctx context.Context, secretName string) error {
	err := s.provider.RotateSecret(ctx, secretName)
	if err != nil {
		return fmt.Errorf("failed to rotate secret: %w", err)
	}

	// Reschedule rotation if auto-rotate is enabled
	if s.config.AutoRotate && s.config.RotationTTL > 0 {
		s.scheduleRotation(secretName, s.config.RotationTTL)
	}

	log.Printf("Secret '%s' rotated successfully", secretName)
	return nil
}

// DeleteSecret deletes a secret
func (s *SecretService) DeleteSecret(ctx context.Context, secretName string, forceDelete bool) error {
	// Cancel any scheduled rotation
	s.cancelRotation(secretName)

	err := s.provider.DeleteSecret(ctx, secretName, forceDelete)
	if err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	log.Printf("Secret '%s' deleted successfully", secretName)
	return nil
}

// ListSecrets lists all secrets
func (s *SecretService) ListSecrets(ctx context.Context, secretType SecretType) ([]SecretMetadata, error) {
	filters := make(map[string]string)
	if secretType != "" {
		filters["tag:type"] = string(secretType)
	}

	secrets, err := s.provider.ListSecrets(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}

	return secrets, nil
}

// GetSecretsByType retrieves secrets of a specific type
func (s *SecretService) GetSecretsByType(ctx context.Context, secretType SecretType) ([]Secret, error) {
	metadataList, err := s.ListSecrets(ctx, secretType)
	if err != nil {
		return nil, err
	}

	var secrets []Secret
	for _, metadata := range metadataList {
		secret := Secret{
			ID:          metadata.Labels["id"],
			Name:        metadata.Name,
			Type:        SecretType(metadata.Labels["type"]),
			Description: metadata.Description,
			CreatedAt:   metadata.CreatedAt,
			UpdatedAt:   metadata.UpdatedAt,
			Version:     1,
			Tags:        metadata.Labels,
		}

		// Parse metadata
		if metadataJSON, exists := metadata.Labels["metadata"]; exists {
			var metadata map[string]interface{}
			if err := json.Unmarshal([]byte(metadataJSON), &metadata); err == nil {
				secret.Metadata = metadata
			}
		}

		secrets = append(secrets, secret)
	}

	return secrets, nil
}

// HealthCheck performs a health check on the secret service
func (s *SecretService) HealthCheck(ctx context.Context) error {
	return s.provider.HealthCheck(ctx)
}

// Shutdown gracefully shuts down the secret service
func (s *SecretService) Shutdown() error {
	s.cancel()

	// Cancel all rotation jobs
	s.mu.Lock()
	defer s.mu.Unlock()

	for name, timer := range s.rotationJobs {
		if timer != nil {
			timer.Stop()
			delete(s.rotationJobs, name)
		}
	}

	log.Println("Secret service shutdown completed")
	return nil
}

// validateSecret validates a secret before creation
func (s *SecretService) validateSecret(secret *Secret) error {
	if secret.Name == "" {
		return fmt.Errorf("secret name is required")
	}
	if secret.Value == "" {
		return fmt.Errorf("secret value is required")
	}
	if secret.Type == "" {
		return fmt.Errorf("secret type is required")
	}

	// Validate secret type
	validTypes := map[SecretType]bool{
		SecretTypeDatabase:      true,
		SecretTypeAPIKey:        true,
		SecretTypeJWT:           true,
		SecretTypeEncryption:    true,
		SecretTypeServiceConfig: true,
		SecretTypeExternal:      true,
	}

	if !validTypes[secret.Type] {
		return fmt.Errorf("invalid secret type: %s", secret.Type)
	}

	return nil
}

// scheduleRotation schedules a secret rotation
func (s *SecretService) scheduleRotation(secretName string, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cancel existing rotation if any
	if timer, exists := s.rotationJobs[secretName]; exists && timer != nil {
		timer.Stop()
	}

	// Schedule new rotation
	timer := time.AfterFunc(ttl, func() {
		if err := s.RotateSecret(s.ctx, secretName); err != nil {
			log.Printf("Failed to rotate secret '%s': %v", secretName, err)
			// Reschedule for retry after 5 minutes
			s.scheduleRotation(secretName, 5*time.Minute)
		}
	})

	s.rotationJobs[secretName] = timer
	log.Printf("Scheduled rotation for secret '%s' in %v", secretName, ttl)
}

// cancelRotation cancels a scheduled rotation
func (s *SecretService) cancelRotation(secretName string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if timer, exists := s.rotationJobs[secretName]; exists && timer != nil {
		timer.Stop()
		delete(s.rotationJobs, secretName)
	}
}

// startRotationMonitor starts the background rotation monitor
func (s *SecretService) startRotationMonitor() {
	ticker := time.NewTicker(1 * time.Hour) // Check every hour
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.checkAndScheduleRotations()
		}
	}
}

// checkAndScheduleRotations checks all secrets and schedules rotations if needed
func (s *SecretService) checkAndScheduleRotations() {
	if !s.config.AutoRotate || s.config.RotationTTL <= 0 {
		return
	}

	secrets, err := s.ListSecrets(s.ctx, "")
	if err != nil {
		log.Printf("Failed to list secrets for rotation check: %v", err)
		return
	}

	for _, secret := range secrets {
		// Check if rotation is needed
		if secret.UpdatedAt.Add(s.config.RotationTTL).Before(time.Now().Add(24 * time.Hour)) {
			// Schedule rotation if not already scheduled
			s.scheduleRotation(secret.Name, s.config.RotationTTL)
		}
	}
}

// GetRotationStatus returns the rotation status for all secrets
func (s *SecretService) GetRotationStatus() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := make(map[string]interface{})
	status["auto_rotate_enabled"] = s.config.AutoRotate
	status["rotation_ttl"] = s.config.RotationTTL.String()
	status["active_rotation_jobs"] = len(s.rotationJobs)

	var jobs []map[string]interface{}
	for name, timer := range s.rotationJobs {
		if timer != nil {
			jobs = append(jobs, map[string]interface{}{
				"secret_name": name,
				"status":      "scheduled",
			})
		}
	}
	status["rotation_jobs"] = jobs

	return status
}

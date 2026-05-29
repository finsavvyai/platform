//go:build legacy_migrated
// +build legacy_migrated

package secrets

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"math/big"
	"time"
)

// RotationStrategy defines how secrets should be rotated
type RotationStrategy string

const (
	RotationStrategyImmediate RotationStrategy = "immediate"
	RotationStrategyScheduled RotationStrategy = "scheduled"
	RotationStrategyOnDemand  RotationStrategy = "on_demand"
	RotationStrategyAutomatic RotationStrategy = "automatic"
)

// SecretRotationManager handles automatic rotation of secrets
type SecretRotationManager struct {
	secretService *SecretService
	strategies    map[SecretType]RotationStrategy
	rotators      map[SecretType]SecretRotator
	ctx           context.Context
}

// SecretRotator interface for rotating different types of secrets
type SecretRotator interface {
	Rotate(ctx context.Context, currentSecret string) (string, error)
	Validate(secret string) error
	GetRotationInterval() time.Duration
}

// DatabaseSecretRotator handles database credential rotation
type DatabaseSecretRotator struct {
	length   int
	charset  string
	interval time.Duration
}

// APIKeySecretRotator handles API key rotation
type APIKeySecretRotator struct {
	length   int
	interval time.Duration
}

// JWTSecretRotator handles JWT signing key rotation
type JWTSecretRotator struct {
	length   int
	interval time.Duration
}

// EncryptionKeyRotator handles encryption key rotation
type EncryptionKeyRotator struct {
	keySize  int
	interval time.Duration
}

// NewSecretRotationManager creates a new secret rotation manager
func NewSecretRotationManager(secretService *SecretService, ctx context.Context) *SecretRotationManager {
	manager := &SecretRotationManager{
		secretService: secretService,
		strategies:    make(map[SecretType]RotationStrategy),
		rotators:      make(map[SecretType]SecretRotator),
		ctx:           ctx,
	}

	// Initialize default rotators
	manager.initializeRotators()

	return manager
}

// initializeRotators sets up default rotators for different secret types
func (rm *SecretRotationManager) initializeRotators() {
	// Database credentials rotator
	rm.rotators[SecretTypeDatabase] = &DatabaseSecretRotator{
		length:   32,
		charset:  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*",
		interval: 90 * 24 * time.Hour, // 90 days
	}

	// API key rotator
	rm.rotators[SecretTypeAPIKey] = &APIKeySecretRotator{
		length:   64,
		interval: 30 * 24 * time.Hour, // 30 days
	}

	// JWT secret rotator
	rm.rotators[SecretTypeJWT] = &JWTSecretRotator{
		length:   64,
		interval: 60 * 24 * time.Hour, // 60 days
	}

	// Encryption key rotator
	rm.rotators[SecretTypeEncryption] = &EncryptionKeyRotator{
		keySize:  32,                   // 256 bits
		interval: 180 * 24 * time.Hour, // 180 days
	}

	// Set default strategies
	rm.strategies[SecretTypeDatabase] = RotationStrategyScheduled
	rm.strategies[SecretTypeAPIKey] = RotationStrategyScheduled
	rm.strategies[SecretTypeJWT] = RotationStrategyScheduled
	rm.strategies[SecretTypeEncryption] = RotationStrategyScheduled
	rm.strategies[SecretTypeServiceConfig] = RotationStrategyOnDemand
	rm.strategies[SecretTypeExternal] = RotationStrategyOnDemand
}

// SetRotationStrategy sets the rotation strategy for a secret type
func (rm *SecretRotationManager) SetRotationStrategy(secretType SecretType, strategy RotationStrategy) {
	rm.strategies[secretType] = strategy
}

// RotateSecret rotates a specific secret
func (rm *SecretRotationManager) RotateSecret(ctx context.Context, secretName string) error {
	// Get current secret
	currentSecret, err := rm.secretService.GetSecret(ctx, secretName)
	if err != nil {
		return fmt.Errorf("failed to get current secret: %w", err)
	}

	// Determine secret type (this would require additional metadata or naming conventions)
	secretType := rm.determineSecretType(secretName)

	// Get appropriate rotator
	rotator, exists := rm.rotators[secretType]
	if !exists {
		return fmt.Errorf("no rotator available for secret type: %s", secretType)
	}

	// Generate new secret value
	newSecret, err := rotator.Rotate(ctx, currentSecret)
	if err != nil {
		return fmt.Errorf("failed to rotate secret: %w", err)
	}

	// Validate new secret
	if err := rotator.Validate(newSecret); err != nil {
		return fmt.Errorf("new secret validation failed: %w", err)
	}

	// Update the secret
	if err := rm.secretService.UpdateSecret(ctx, secretName, newSecret, ""); err != nil {
		return fmt.Errorf("failed to update rotated secret: %w", err)
	}

	log.Printf("Secret '%s' rotated successfully", secretName)
	return nil
}

// RotateSecretsByType rotates all secrets of a specific type
func (rm *SecretRotationManager) RotateSecretsByType(ctx context.Context, secretType SecretType) error {
	secrets, err := rm.secretService.GetSecretsByType(ctx, secretType)
	if err != nil {
		return fmt.Errorf("failed to get secrets of type %s: %w", secretType, err)
	}

	var errors []error
	for _, secret := range secrets {
		if err := rm.RotateSecret(ctx, secret.Name); err != nil {
			errors = append(errors, fmt.Errorf("failed to rotate secret '%s': %w", secret.Name, err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("rotation completed with %d errors: %v", len(errors), errors)
	}

	log.Printf("Successfully rotated %d secrets of type %s", len(secrets), secretType)
	return nil
}

// StartAutomaticRotation starts automatic rotation for eligible secrets
func (rm *SecretRotationManager) StartAutomaticRotation() {
	go rm.rotationLoop()
}

// rotationLoop runs the automatic rotation process
func (rm *SecretRotationManager) rotationLoop() {
	ticker := time.NewTicker(24 * time.Hour) // Check daily
	defer ticker.Stop()

	for {
		select {
		case <-rm.ctx.Done():
			return
		case <-ticker.C:
			rm.checkAndRotateSecrets()
		}
	}
}

// checkAndRotateSecrets checks all secrets and rotates those that need rotation
func (rm *SecretRotationManager) checkAndRotateSecrets() {
	// Get all secrets that use automatic or scheduled rotation
	for secretType, strategy := range rm.strategies {
		if strategy == RotationStrategyAutomatic || strategy == RotationStrategyScheduled {
			if err := rm.rotateExpiredSecrets(secretType); err != nil {
				log.Printf("Failed to rotate secrets of type %s: %v", secretType, err)
			}
		}
	}
}

// rotateExpiredSecrets rotates secrets that have exceeded their rotation interval
func (rm *SecretRotationManager) rotateExpiredSecrets(secretType SecretType) error {
	secrets, err := rm.secretService.GetSecretsByType(rm.ctx, secretType)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	rotator, exists := rm.rotators[secretType]
	if !exists {
		return fmt.Errorf("no rotator for secret type: %s", secretType)
	}

	for _, secret := range secrets {
		// Check if rotation is needed
		if rm.needsRotation(secret, rotator.GetRotationInterval()) {
			if err := rm.RotateSecret(rm.ctx, secret.Name); err != nil {
				log.Printf("Failed to rotate secret '%s': %v", secret.Name, err)
			}
		}
	}

	return nil
}

// needsRotation checks if a secret needs rotation based on its age
func (rm *SecretRotationManager) needsRotation(secret Secret, interval time.Duration) bool {
	// Check if secret has been rotated before
	if secret.RotatedAt != nil {
		return time.Since(*secret.RotatedAt) > interval
	}

	// Use creation date if never rotated
	return time.Since(secret.CreatedAt) > interval
}

// determineSecretType determines the type of secret based on naming conventions
func (rm *SecretRotationManager) determineSecretType(secretName string) SecretType {
	// This is a simple implementation - in production, you'd want more sophisticated logic
	// or store the type as metadata/labels

	switch {
	case contains(secretName, "database", "db", "postgres", "mysql", "redis"):
		return SecretTypeDatabase
	case contains(secretName, "api", "key", "token", "auth"):
		return SecretTypeAPIKey
	case contains(secretName, "jwt", "signing", "token"):
		return SecretTypeJWT
	case contains(secretName, "encryption", "cipher", "key"):
		return SecretTypeEncryption
	case contains(secretName, "config", "service"):
		return SecretTypeServiceConfig
	default:
		return SecretTypeExternal
	}
}

// contains checks if the secret name contains any of the given substrings
func contains(name string, substrings ...string) bool {
	for _, substr := range substrings {
		if len(name) >= len(substr) {
			for i := 0; i <= len(name)-len(substr); i++ {
				if name[i:i+len(substr)] == substr {
					return true
				}
			}
		}
	}
	return false
}

// DatabaseSecretRotator implementation
func (dr *DatabaseSecretRotator) Rotate(ctx context.Context, currentSecret string) (string, error) {
	return dr.generatePassword(), nil
}

func (dr *DatabaseSecretRotator) Validate(secret string) error {
	if len(secret) < dr.length {
		return fmt.Errorf("database secret too short, minimum length: %d", dr.length)
	}
	return nil
}

func (dr *DatabaseSecretRotator) GetRotationInterval() time.Duration {
	return dr.interval
}

func (dr *DatabaseSecretRotator) generatePassword() string {
	password := make([]byte, dr.length)
	for i := range password {
		randomIndex, _ := rand.Int(rand.Reader, big.NewInt(int64(len(dr.charset))))
		password[i] = dr.charset[randomIndex.Int64()]
	}
	return string(password)
}

// APIKeySecretRotator implementation
func (ar *APIKeySecretRotator) Rotate(ctx context.Context, currentSecret string) (string, error) {
	return ar.generateAPIKey(), nil
}

func (ar *APIKeySecretRotator) Validate(secret string) error {
	if len(secret) < ar.length {
		return fmt.Errorf("API key too short, minimum length: %d", ar.length)
	}
	return nil
}

func (ar *APIKeySecretRotator) GetRotationInterval() time.Duration {
	return ar.interval
}

func (ar *APIKeySecretRotator) generateAPIKey() string {
	bytes := make([]byte, ar.length)
	rand.Read(bytes)
	return base64.URLEncoding.EncodeToString(bytes)
}

// JWTSecretRotator implementation
func (jr *JWTSecretRotator) Rotate(ctx context.Context, currentSecret string) (string, error) {
	return jr.generateJWTSecret(), nil
}

func (jr *JWTSecretRotator) Validate(secret string) error {
	if len(secret) < jr.length {
		return fmt.Errorf("JWT secret too short, minimum length: %d", jr.length)
	}
	return nil
}

func (jr *JWTSecretRotator) GetRotationInterval() time.Duration {
	return jr.interval
}

func (jr *JWTSecretRotator) generateJWTSecret() string {
	bytes := make([]byte, jr.length)
	rand.Read(bytes)
	return base64.StdEncoding.EncodeToString(bytes)
}

// EncryptionKeyRotator implementation
func (er *EncryptionKeyRotator) Rotate(ctx context.Context, currentSecret string) (string, error) {
	return er.generateEncryptionKey(), nil
}

func (er *EncryptionKeyRotator) Validate(secret string) error {
	keyBytes, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return fmt.Errorf("invalid base64 encoding")
	}
	if len(keyBytes) != er.keySize {
		return fmt.Errorf("encryption key size mismatch, expected: %d, got: %d", er.keySize, len(keyBytes))
	}
	return nil
}

func (er *EncryptionKeyRotator) GetRotationInterval() time.Duration {
	return er.interval
}

func (er *EncryptionKeyRotator) generateEncryptionKey() string {
	key := make([]byte, er.keySize)
	rand.Read(key)
	return base64.StdEncoding.EncodeToString(key)
}

// GetRotationStatus returns the current rotation status
func (rm *SecretRotationManager) GetRotationStatus() map[string]interface{} {
	status := make(map[string]interface{})

	// Add strategies
	strategies := make(map[string]string)
	for secretType, strategy := range rm.strategies {
		strategies[string(secretType)] = string(strategy)
	}
	status["strategies"] = strategies

	// Add rotator intervals
	intervals := make(map[string]string)
	for secretType, rotator := range rm.rotators {
		intervals[string(secretType)] = rotator.GetRotationInterval().String()
	}
	status["intervals"] = intervals

	status["last_check"] = time.Now().Format(time.RFC3339)

	return status
}
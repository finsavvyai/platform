//go:build ignore

package storage

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"golang.org/x/crypto/hkdf"
)

// EncryptionConfig holds configuration for encryption service
type EncryptionConfig struct {
	KeyDerivationSalt string `json:"key_derivation_salt"`
	KeyRotationDays   int    `json:"key_rotation_days"`
	Algorithm         string `json:"algorithm"`
	KeySize           int    `json:"key_size"`
}

// EncryptionService implements tenant-specific encryption using AES-256-GCM
type EncryptionService struct {
	config   *EncryptionConfig
	logger   *logrus.Logger
	keyStore map[string]*EncryptionKey
}

// EncryptionKey represents an encryption key for a tenant
type EncryptionKey struct {
	KeyID       string    `json:"key_id"`
	KeyBytes    []byte    `json:"-"`
	Algorithm   string    `json:"algorithm"`
	CreatedAt   time.Time `json:"created_at"`
	LastRotated time.Time `json:"last_rotated"`
	ExpiresAt   time.Time `json:"expires_at"`
	IsActive    bool      `json:"is_active"`
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(cfg *EncryptionConfig, logger *logrus.Logger) *EncryptionService {
	if cfg == nil {
		cfg = &EncryptionConfig{
			KeyDerivationSalt: "sdlc-platform-key-salt-2024",
			KeyRotationDays:   90,
			Algorithm:         "aes-256-gcm",
			KeySize:           32,
		}
	}

	return &EncryptionService{
		config:   cfg,
		logger:   logger,
		keyStore: make(map[string]*EncryptionKey),
	}
}

// EncryptForTenant encrypts data for a specific tenant
func (s *EncryptionService) EncryptForTenant(ctx context.Context, tenantID string, data []byte) ([]byte, string, error) {
	ctx, span := otel.Tracer("encryption-service").Start(ctx, "EncryptForTenant")
	defer span.End()

	startTime := time.Now()

	// Get or create encryption key for tenant
	key, err := s.getOrCreateTenantKey(ctx, tenantID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get tenant encryption key: %w", err)
	}

	// Encrypt data
	encrypted, err := s.encryptWithKey(data, key)
	if err != nil {
		return nil, "", fmt.Errorf("encryption failed: %w", err)
	}

	processingTime := time.Since(startTime)
	s.logger.WithFields(logrus.Fields{
		"tenant_id":       tenantID,
		"key_id":          key.KeyID,
		"data_size":       len(data),
		"encrypted_size":  len(encrypted),
		"processing_time": processingTime,
	}).Debug("Data encrypted successfully")

	return encrypted, key.KeyID, nil
}

// DecryptForTenant decrypts data for a specific tenant
func (s *EncryptionService) DecryptForTenant(ctx context.Context, tenantID string, encrypted []byte) ([]byte, error) {
	ctx, span := otel.Tracer("encryption-service").Start(ctx, "DecryptForTenant")
	defer span.End()

	startTime := time.Now()

	// Get encryption key for tenant
	key, err := s.getTenantKey(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant decryption key: %w", err)
	}

	// Decrypt data
	decrypted, err := s.decryptWithKey(encrypted, key)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	processingTime := time.Since(startTime)
	s.logger.WithFields(logrus.Fields{
		"tenant_id":       tenantID,
		"key_id":          key.KeyID,
		"encrypted_size":  len(encrypted),
		"decrypted_size":  len(decrypted),
		"processing_time": processingTime,
	}).Debug("Data decrypted successfully")

	return decrypted, nil
}

// RotateTenantKey rotates the encryption key for a tenant
func (s *EncryptionService) RotateTenantKey(ctx context.Context, tenantID string) error {
	ctx, span := otel.Tracer("encryption-service").Start(ctx, "RotateTenantKey")
	defer span.End()

	s.logger.WithField("tenant_id", tenantID).Info("Rotating tenant encryption key")

	// Mark old key as inactive
	if oldKey, exists := s.keyStore[tenantID]; exists {
		oldKey.IsActive = false
	}

	// Create new key
	newKey, err := s.createTenantKey(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to create new tenant key: %w", err)
	}

	s.keyStore[tenantID] = newKey

	s.logger.WithFields(logrus.Fields{
		"tenant_id":  tenantID,
		"new_key_id": newKey.KeyID,
		"old_key_id": func() string {
			if oldKey, exists := s.keyStore[tenantID]; !exists {
				return ""
			} else {
				return oldKey.KeyID
			}
		}(),
	}).Info("Tenant encryption key rotated successfully")

	return nil
}

// GetKeyInfo returns information about encryption keys
func (s *EncryptionService) GetKeyInfo(ctx context.Context, tenantID string) (*KeyInfo, error) {
	ctx, span := otel.Tracer("encryption-service").Start(ctx, "GetKeyInfo")
	defer span.End()

	key, err := s.getTenantKey(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant key info: %w", err)
	}

	info := &KeyInfo{
		KeyID:         key.KeyID,
		Algorithm:     key.Algorithm,
		KeySize:       s.config.KeySize,
		CreatedAt:     key.CreatedAt,
		LastRotated:   key.LastRotated,
		RotationAfter: key.ExpiresAt,
		Status:        "active",
	}

	if !key.IsActive {
		info.Status = "inactive"
	}

	return info, nil
}

// HealthCheck performs a health check on the encryption service
func (s *EncryptionService) HealthCheck(ctx context.Context) error {
	ctx, span := otel.Tracer("encryption-service").Start(ctx, "HealthCheck")
	defer span.End()

	// Test encryption/decryption cycle
	testData := []byte("test data for encryption health check")
	testTenantID := "health-check-tenant"

	encrypted, keyID, err := s.EncryptForTenant(ctx, testTenantID, testData)
	if err != nil {
		return fmt.Errorf("encryption health check failed: %w", err)
	}

	decrypted, err := s.DecryptForTenant(ctx, testTenantID, encrypted)
	if err != nil {
		return fmt.Errorf("decryption health check failed: %w", err)
	}

	if string(decrypted) != string(testData) {
		return fmt.Errorf("encryption/decryption integrity check failed")
	}

	// Clean up test key
	delete(s.keyStore, testTenantID)

	s.logger.Debug("Encryption service health check passed")
	return nil
}

// getOrCreateTenantKey gets an existing tenant key or creates a new one
func (s *EncryptionService) getOrCreateTenantKey(ctx context.Context, tenantID string) (*EncryptionKey, error) {
	key, err := s.getTenantKey(ctx, tenantID)
	if err != nil {
		// Key doesn't exist, create new one
		key, err = s.createTenantKey(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("failed to create tenant key: %w", err)
		}
	}

	// Check if key needs rotation
	if s.needsRotation(key) {
		err = s.RotateTenantKey(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("failed to rotate expired key: %w", err)
		}
		key = s.keyStore[tenantID]
	}

	return key, nil
}

// getTenantKey gets the encryption key for a tenant
func (s *EncryptionService) getTenantKey(ctx context.Context, tenantID string) (*EncryptionKey, error) {
	key, exists := s.keyStore[tenantID]
	if !exists {
		return nil, fmt.Errorf("encryption key not found for tenant: %s", tenantID)
	}

	if !key.IsActive {
		return nil, fmt.Errorf("encryption key is inactive for tenant: %s", tenantID)
	}

	return key, nil
}

// createTenantKey creates a new encryption key for a tenant
func (s *EncryptionService) createTenantKey(ctx context.Context, tenantID string) (*EncryptionKey, error) {
	// Generate key using HKDF
	salt := []byte(s.config.KeyDerivationSalt)
	info := []byte(fmt.Sprintf("tenant-key-%s-%s", tenantID, uuid.New().String()))

	keyBytes := make([]byte, s.config.KeySize)
	hkdf := hkdf.New(sha256.New, salt, []byte(tenantID), info)
	if _, err := io.ReadFull(hkdf, keyBytes); err != nil {
		return nil, fmt.Errorf("failed to derive encryption key: %w", err)
	}

	now := time.Now()
	key := &EncryptionKey{
		KeyID:       uuid.New().String(),
		KeyBytes:    keyBytes,
		Algorithm:   s.config.Algorithm,
		CreatedAt:   now,
		LastRotated: now,
		ExpiresAt:   now.AddDate(0, 0, s.config.KeyRotationDays),
		IsActive:    true,
	}

	return key, nil
}

// needsRotation checks if a key needs rotation
func (s *EncryptionService) needsRotation(key *EncryptionKey) bool {
	return time.Now().After(key.ExpiresAt)
}

// encryptWithKey encrypts data using the provided key
func (s *EncryptionService) encryptWithKey(data []byte, key *EncryptionKey) ([]byte, error) {
	// Create cipher block
	block, err := aes.NewCipher(key.KeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	// Create GCM cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM cipher: %w", err)
	}

	// Generate nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt data
	ciphertext := gcm.Seal(nonce, nonce, data, nil)

	// Return base64 encoded result with key ID
	result := append([]byte(key.KeyID+":"), ciphertext...)
	encoded := make([]byte, base64.StdEncoding.EncodedLen(len(result)))
	base64.StdEncoding.Encode(encoded, result)

	return encoded, nil
}

// decryptWithKey decrypts data using the provided key
func (s *EncryptionService) decryptWithKey(encrypted []byte, key *EncryptionKey) ([]byte, error) {
	// Decode base64
	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(encrypted)))
	n, err := base64.StdEncoding.Decode(decoded, encrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}
	decoded = decoded[:n]

	// Extract key ID and ciphertext
	parts := split(decoded, ':', 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid encrypted data format")
	}

	keyID := string(parts[0])
	ciphertext := parts[1]

	// Verify key ID matches
	if keyID != key.KeyID {
		return nil, fmt.Errorf("key ID mismatch: expected %s, got %s", key.KeyID, keyID)
	}

	// Create cipher block
	block, err := aes.NewCipher(key.KeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	// Create GCM cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM cipher: %w", err)
	}

	// Check minimum length (nonce + ciphertext + tag)
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce := ciphertext[:nonceSize]
	ciphertext = ciphertext[nonceSize:]

	// Decrypt data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt data: %w", err)
	}

	return plaintext, nil
}

// split is a helper function to split byte slice by separator
func split(data []byte, sep byte, n int) [][]byte {
	if n <= 0 {
		return nil
	}

	var parts [][]string
	// Convert to string for easier splitting
	dataStr := string(data)
	partsStr := strings.SplitN(dataStr, string(sep), n)

	result := make([][]byte, len(partsStr))
	for i, part := range partsStr {
		result[i] = []byte(part)
	}

	return result
}

// GetActiveKeys returns all active encryption keys
func (s *EncryptionService) GetActiveKeys() map[string]*EncryptionKey {
	activeKeys := make(map[string]*EncryptionKey)
	for tenantID, key := range s.keyStore {
		if key.IsActive {
			activeKeys[tenantID] = key
		}
	}
	return activeKeys
}

// CleanupExpiredKeys removes expired keys from memory
func (s *EncryptionService) CleanupExpiredKeys() int {
	removed := 0
	now := time.Now()

	for tenantID, key := range s.keyStore {
		if !key.IsActive && now.After(key.ExpiresAt.AddDate(0, 0, 30)) { // Keep inactive keys for 30 days
			delete(s.keyStore, tenantID)
			removed++
		}
	}

	if removed > 0 {
		s.logger.WithField("removed_keys", removed).Info("Cleaned up expired encryption keys")
	}

	return removed
}

// GetTenantKeyHistory returns key history for a tenant
func (s *EncryptionService) GetTenantKeyHistory(tenantID string) ([]*EncryptionKey, error) {
	// This is a simplified implementation
	// In production, you would store key history in a database
	key, exists := s.keyStore[tenantID]
	if !exists {
		return nil, fmt.Errorf("no keys found for tenant: %s", tenantID)
	}

	return []*EncryptionKey{key}, nil
}

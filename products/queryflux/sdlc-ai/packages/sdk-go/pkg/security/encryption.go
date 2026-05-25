package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"time"

	"golang.org/x/crypto/pbkdf2"
)

// EncryptionService provides encryption/decryption services for sensitive data
type EncryptionService struct {
	masterKey []byte
	gcm       cipher.AEAD
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(masterKey string) *EncryptionService {
	// Derive a proper key from the master key
	key := pbkdf2.Key([]byte(masterKey), []byte("sdlc-salt"), 100000, 32, sha256.New)

	block, err := aes.NewCipher(key)
	if err != nil {
		panic(fmt.Sprintf("Failed to create cipher: %v", err))
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		panic(fmt.Sprintf("Failed to create GCM: %v", err))
	}

	return &EncryptionService{
		masterKey: key,
		gcm:       gcm,
	}
}

// EncryptCardData encrypts sensitive card data
func (e *EncryptionService) EncryptCardData(data string) (string, error) {
	if data == "" {
		return "", fmt.Errorf("data cannot be empty")
	}

	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := e.gcm.Seal(nonce, nonce, []byte(data), nil)

	// Return base64 encoded result
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptCardData decrypts sensitive card data
func (e *EncryptionService) DecryptCardData(encryptedData string) (string, error) {
	if encryptedData == "" {
		return "", fmt.Errorf("encrypted data cannot be empty")
	}

	// Decode base64
	data, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	nonceSize := e.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]

	plaintext, err := e.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt data: %w", err)
	}

	return string(plaintext), nil
}

// RotateKey rotates the encryption key
func (e *EncryptionService) RotateKey(newMasterKey string) error {
	// Create new encryption service with new key
	newService := NewEncryptionService(newMasterKey)

	// Re-encrypt any existing data if needed
	// This would be implementation-specific

	e.masterKey = newService.masterKey
	e.gcm = newService.gcm

	return nil
}

// GetKeyInfo returns information about the current key
func (e *EncryptionService) GetKeyInfo() *KeyInfo {
	return &KeyInfo{
		KeyID:        fmt.Sprintf("key_%d", time.Now().Unix()),
		Algorithm:    "AES-256-GCM",
		KeySize:      256,
		CreatedAt:    time.Now().UTC(),
		RotationDate: time.Now().UTC().AddDate(0, 6, 0), // 6 months
	}
}

// KeyInfo represents encryption key information
type KeyInfo struct {
	KeyID        string    `json:"key_id"`
	Algorithm    string    `json:"algorithm"`
	KeySize      int       `json:"key_size"`
	CreatedAt    time.Time `json:"created_at"`
	RotationDate time.Time `json:"rotation_date"`
}

// HSMService represents Hardware Security Module interface
type HSMService interface {
	GenerateKey() (*HSMKey, error)
	SignData(keyID string, data []byte) ([]byte, error)
	VerifySignature(keyID string, data, signature []byte) (bool, error)
	EncryptWithKey(keyID string, data []byte) ([]byte, error)
	DecryptWithKey(keyID string, encryptedData []byte) ([]byte, error)
	DestroyKey(keyID string) error
	ListKeys() ([]*HSMKey, error)
}

// HSMKey represents a key stored in HSM
type HSMKey struct {
	KeyID     string    `json:"key_id"`
	KeyType   string    `json:"key_type"`
	Algorithm string    `json:"algorithm"`
	KeySize   int       `json:"key_size"`
	CreatedAt time.Time `json:"created_at"`
	LastUsed  time.Time `json:"last_used"`
	Status    string    `json:"status"` // ACTIVE, DISABLED, DESTROYED
	Purpose   string    `json:"purpose"`
}

// MockHSMService provides mock HSM implementation for testing
type MockHSMService struct {
	keys map[string]*HSMKey
}

// NewMockHSMService creates a new mock HSM service
func NewMockHSMService() *MockHSMService {
	return &MockHSMService{
		keys: make(map[string]*HSMKey),
	}
}

// GenerateKey generates a new key in HSM
func (h *MockHSMService) GenerateKey() (*HSMKey, error) {
	keyID := fmt.Sprintf("hsm_key_%d", time.Now().UnixNano())

	key := &HSMKey{
		KeyID:     keyID,
		KeyType:   "AES",
		Algorithm: "AES-256-GCM",
		KeySize:   256,
		CreatedAt: time.Now().UTC(),
		LastUsed:  time.Now().UTC(),
		Status:    "ACTIVE",
		Purpose:   "PAYMENT_ENCRYPTION",
	}

	h.keys[keyID] = key
	return key, nil
}

// SignData signs data using HSM key
func (h *MockHSMService) SignData(keyID string, data []byte) ([]byte, error) {
	key, exists := h.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	if key.Status != "ACTIVE" {
		return nil, fmt.Errorf("key is not active: %s", keyID)
	}

	// Mock signature generation
	signature := append(data, []byte(keyID)...)

	// Update last used
	key.LastUsed = time.Now().UTC()

	return signature, nil
}

// VerifySignature verifies signature using HSM key
func (h *MockHSMService) VerifySignature(keyID string, data, signature []byte) (bool, error) {
	key, exists := h.keys[keyID]
	if !exists {
		return false, fmt.Errorf("key not found: %s", keyID)
	}

	// Mock signature verification
	expectedSignature := append(data, []byte(keyID)...)

	// Update last used
	key.LastUsed = time.Now().UTC()

	return string(signature) == string(expectedSignature), nil
}

// EncryptWithKey encrypts data using HSM key
func (h *MockHSMService) EncryptWithKey(keyID string, data []byte) ([]byte, error) {
	key, exists := h.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	if key.Status != "ACTIVE" {
		return nil, fmt.Errorf("key is not active: %s", keyID)
	}

	// Mock encryption using AES
	encryptService := NewEncryptionService(keyID)
	encrypted, err := encryptService.EncryptCardData(string(data))
	if err != nil {
		return nil, fmt.Errorf("encryption failed: %w", err)
	}

	// Update last used
	key.LastUsed = time.Now().UTC()

	return []byte(encrypted), nil
}

// DecryptWithKey decrypts data using HSM key
func (h *MockHSMService) DecryptWithKey(keyID string, encryptedData []byte) ([]byte, error) {
	key, exists := h.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	if key.Status != "ACTIVE" {
		return nil, fmt.Errorf("key is not active: %s", keyID)
	}

	// Mock decryption using AES
	encryptService := NewEncryptionService(keyID)
	decrypted, err := encryptService.DecryptCardData(string(encryptedData))
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	// Update last used
	key.LastUsed = time.Now().UTC()

	return []byte(decrypted), nil
}

// DestroyKey destroys a key in HSM
func (h *MockHSMService) DestroyKey(keyID string) error {
	key, exists := h.keys[keyID]
	if !exists {
		return fmt.Errorf("key not found: %s", keyID)
	}

	key.Status = "DESTROYED"
	return nil
}

// ListKeys lists all keys in HSM
func (h *MockHSMService) ListKeys() ([]*HSMKey, error) {
	var keys []*HSMKey
	for _, key := range h.keys {
		keys = append(keys, key)
	}
	return keys, nil
}

// KeyRotationService manages key rotation
type KeyRotationService struct {
	hsmService HSMService
	keyStore   KeyStore
}

// KeyStore interface for storing key metadata
type KeyStore interface {
	SaveKey(key *HSMKey) error
	GetKey(keyID string) (*HSMKey, error)
	ListActiveKeys() ([]*HSMKey, error)
	DeactivateKey(keyID string) error
}

// NewKeyRotationService creates a new key rotation service
func NewKeyRotationService(hsmService HSMService, keyStore KeyStore) *KeyRotationService {
	return &KeyRotationService{
		hsmService: hsmService,
		keyStore:   keyStore,
	}
}

// RotateKeys performs key rotation for expired keys
func (k *KeyRotationService) RotateKeys() error {
	activeKeys, err := k.keyStore.ListActiveKeys()
	if err != nil {
		return fmt.Errorf("failed to list active keys: %w", err)
	}

	var rotatedKeys []string

	for _, key := range activeKeys {
		if k.shouldRotateKey(key) {
			// Generate new key
			newKey, err := k.hsmService.GenerateKey()
			if err != nil {
				return fmt.Errorf("failed to generate new key: %w", err)
			}

			// Save new key
			err = k.keyStore.SaveKey(newKey)
			if err != nil {
				return fmt.Errorf("failed to save new key: %w", err)
			}

			// Deactivate old key
			err = k.keyStore.DeactivateKey(key.KeyID)
			if err != nil {
				return fmt.Errorf("failed to deactivate old key: %w", err)
			}

			rotatedKeys = append(rotatedKeys, key.KeyID)
		}
	}

	if len(rotatedKeys) > 0 {
		return fmt.Errorf("rotated %d keys: %v", len(rotatedKeys), rotatedKeys)
	}

	return nil
}

// shouldRotateKey determines if a key should be rotated
func (k *KeyRotationService) shouldRotateKey(key *HSMKey) bool {
	// Rotate if key is older than 6 months
	sixMonthsAgo := time.Now().UTC().AddDate(0, -6, 0)
	return key.CreatedAt.Before(sixMonthsAgo)
}

// InMemoryKeyStore provides in-memory key store implementation
type InMemoryKeyStore struct {
	keys map[string]*HSMKey
}

// NewInMemoryKeyStore creates a new in-memory key store
func NewInMemoryKeyStore() *InMemoryKeyStore {
	return &InMemoryKeyStore{
		keys: make(map[string]*HSMKey),
	}
}

// SaveKey saves key metadata
func (s *InMemoryKeyStore) SaveKey(key *HSMKey) error {
	s.keys[key.KeyID] = key
	return nil
}

// GetKey retrieves key metadata
func (s *InMemoryKeyStore) GetKey(keyID string) (*HSMKey, error) {
	key, exists := s.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}
	return key, nil
}

// ListActiveKeys lists all active keys
func (s *InMemoryKeyStore) ListActiveKeys() ([]*HSMKey, error) {
	var activeKeys []*HSMKey
	for _, key := range s.keys {
		if key.Status == "ACTIVE" {
			activeKeys = append(activeKeys, key)
		}
	}
	return activeKeys, nil
}

// DeactivateKey deactivates a key
func (s *InMemoryKeyStore) DeactivateKey(keyID string) error {
	key, exists := s.keys[keyID]
	if !exists {
		return fmt.Errorf("key not found: %s", keyID)
	}
	key.Status = "DISABLED"
	return nil
}

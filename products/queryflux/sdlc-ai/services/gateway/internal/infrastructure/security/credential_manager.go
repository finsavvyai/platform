package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/hkdf"
	"golang.org/x/crypto/pbkdf2"
)

// CredentialType represents different types of credentials
type CredentialType string

const (
	CredentialTypeAPIKey      CredentialType = "api_key"
	CredentialTypePassword    CredentialType = "password"
	CredentialTypePrivateKey  CredentialType = "private_key"
	CredentialTypeCertificate CredentialType = "certificate"
	CredentialTypeSecret      CredentialType = "secret"
	CredentialTypeToken       CredentialType = "token"
	CredentialTypeDatabase    CredentialType = "database"
	CredentialTypeService     CredentialType = "service"
)

// EncryptionAlgorithm represents supported encryption algorithms
type EncryptionAlgorithm string

const (
	AlgorithmAES256GCM        EncryptionAlgorithm = "AES-256-GCM"
	AlgorithmAES256CBC        EncryptionAlgorithm = "AES-256-CBC"
	AlgorithmChaCha20Poly1305 EncryptionAlgorithm = "ChaCha20-Poly1305"
)

// KeyDerivationFunction represents supported key derivation functions
type KeyDerivationFunction string

const (
	KDFHKDFSHA256   KeyDerivationFunction = "HKDF-SHA256"
	KDFPBKDF2SHA256 KeyDerivationFunction = "PBKDF2-SHA256"
	KDFArgon2ID     KeyDerivationFunction = "Argon2ID"
)

// Credential represents an encrypted credential
type Credential struct {
	ID             uuid.UUID          `json:"id" db:"id"`
	TenantID       uuid.UUID          `json:"tenant_id" db:"tenant_id"`
	Name           string             `json:"name" db:"name"`
	Type           CredentialType     `json:"type" db:"type"`
	EncryptedData  []byte             `json:"encrypted_data" db:"encrypted_data"`
	EncryptionMeta EncryptionMetadata `json:"encryption_meta" db:"encryption_meta"`
	Metadata       map[string]string  `json:"metadata" db:"metadata"`
	CreatedAt      time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at" db:"updated_at"`
	ExpiresAt      *time.Time         `json:"expires_at" db:"expires_at"`
	CreatedBy      uuid.UUID          `json:"created_by" db:"created_by"`
	LastAccessedBy uuid.UUID          `json:"last_accessed_by" db:"last_accessed_by"`
	LastAccessedAt *time.Time         `json:"last_accessed_at" db:"last_accessed_at"`
	AccessCount    int                `json:"access_count" db:"access_count"`
	Version        int                `json:"version" db:"version"`
	IsActive       bool               `json:"is_active" db:"is_active"`
}

// EncryptionMetadata contains metadata about encryption
type EncryptionMetadata struct {
	Algorithm  EncryptionAlgorithm    `json:"algorithm"`
	KeyID      string                 `json:"key_id"`
	KDF        KeyDerivationFunction  `json:"kdf"`
	KDFParams  map[string]interface{} `json:"kdf_params"`
	Nonce      []byte                 `json:"nonce"`
	Salt       []byte                 `json:"salt"`
	Timestamp  time.Time              `json:"timestamp"`
	KeyVersion int                    `json:"key_version"`
}

// KeyManager manages encryption keys and key rotation
type KeyManager interface {
	GetKey(ctx context.Context, keyID string) ([]byte, error)
	DeriveKey(ctx context.Context, masterKey []byte, keyInfo KeyDerivationInfo) ([]byte, error)
	RotateKey(ctx context.Context, keyID string) error
	GetKeyInfo(ctx context.Context, keyID string) (*KeyInfo, error)
	CreateKey(ctx context.Context, keyType string) (*KeyInfo, error)
	RevokeKey(ctx context.Context, keyID string) error
}

// KeyDerivationInfo contains information for key derivation
type KeyDerivationInfo struct {
	KeyID   string                 `json:"key_id"`
	KDF     KeyDerivationFunction  `json:"kdf"`
	Params  map[string]interface{} `json:"params"`
	Salt    []byte                 `json:"salt"`
	Context []byte                 `json:"context"`
	Info    []byte                 `json:"info"`
}

// KeyInfo contains information about an encryption key
type KeyInfo struct {
	KeyID      string                `json:"key_id"`
	Algorithm  EncryptionAlgorithm   `json:"algorithm"`
	KDF        KeyDerivationFunction `json:"kdf"`
	CreatedAt  time.Time             `json:"created_at"`
	ExpiresAt  *time.Time            `json:"expires_at"`
	Version    int                   `json:"version"`
	Status     string                `json:"status"`
	UsageCount int                   `json:"usage_count"`
}

// CredentialStore interface for credential storage
type CredentialStore interface {
	StoreCredential(ctx context.Context, credential *Credential) error
	GetCredential(ctx context.Context, id uuid.UUID) (*Credential, error)
	GetCredentialByName(ctx context.Context, tenantID uuid.UUID, name string) (*Credential, error)
	UpdateCredential(ctx context.Context, credential *Credential) error
	DeleteCredential(ctx context.Context, id uuid.UUID) error
	ListCredentials(ctx context.Context, tenantID uuid.UUID, filter CredentialFilter) ([]*Credential, error)
	UpdateAccessLog(ctx context.Context, id, userID uuid.UUID) error
	RotateCredentialEncryption(ctx context.Context, id uuid.UUID, newKeyID string) error
}

// CredentialFilter for filtering credentials
type CredentialFilter struct {
	Type      *CredentialType `json:"type,omitempty"`
	IsActive  *bool           `json:"is_active,omitempty"`
	CreatedBy *uuid.UUID      `json:"created_by,omitempty"`
	Limit     *int            `json:"limit,omitempty"`
	Offset    *int            `json:"offset,omitempty"`
	Search    *string         `json:"search,omitempty"`
}

// CredentialConfig holds configuration for credential manager
type CredentialConfig struct {
	DefaultAlgorithm    EncryptionAlgorithm   `json:"default_algorithm"`
	DefaultKDF          KeyDerivationFunction `json:"default_kdf"`
	KeyRotationInterval time.Duration         `json:"key_rotation_interval"`
	MaxKeyAge           time.Duration         `json:"max_key_age"`
	KeyCacheSize        int                   `json:"key_cache_size"`
	AuditLogging        bool                  `json:"audit_logging"`
	AccessTracking      bool                  `json:"access_tracking"`
	AutoRotation        bool                  `json:"auto_rotation"`
}

// DefaultCredentialConfig returns default credential configuration
func DefaultCredentialConfig() CredentialConfig {
	return CredentialConfig{
		DefaultAlgorithm:    AlgorithmAES256GCM,
		DefaultKDF:          KDFArgon2ID,
		KeyRotationInterval: 90 * 24 * time.Hour,  // 90 days
		MaxKeyAge:           365 * 24 * time.Hour, // 1 year
		KeyCacheSize:        1000,
		AuditLogging:        true,
		AccessTracking:      true,
		AutoRotation:        true,
	}
}

// CredentialManager manages secure credential storage and encryption
type CredentialManager struct {
	keyManager      KeyManager
	credentialStore CredentialStore
	config          CredentialConfig
	logger          *logrus.Logger
	keyCache        map[string][]byte
	keyCacheMutex   sync.RWMutex
	auditLogger     *logrus.Entry
}

// NewCredentialManager creates a new credential manager
func NewCredentialManager(
	keyManager KeyManager,
	credentialStore CredentialStore,
	config CredentialConfig,
	logger *logrus.Logger,
) *CredentialManager {
	if logger == nil {
		logger = logrus.New()
	}

	auditLogger := logger.WithField("component", "credential_audit")

	return &CredentialManager{
		keyManager:      keyManager,
		credentialStore: credentialStore,
		config:          config,
		logger:          logger,
		keyCache:        make(map[string][]byte),
		auditLogger:     auditLogger,
	}
}

// StoreCredential securely stores a credential
func (cm *CredentialManager) StoreCredential(
	ctx context.Context,
	tenantID, createdBy uuid.UUID,
	name string,
	credType CredentialType,
	data []byte,
	metadata map[string]string,
	expiresAt *time.Time,
) (*Credential, error) {
	// Generate encryption key
	keyInfo, err := cm.keyManager.CreateKey(ctx, string(cm.config.DefaultAlgorithm))
	if err != nil {
		return nil, fmt.Errorf("failed to create encryption key: %w", err)
	}

	// Derive encryption key
	deriveInfo := KeyDerivationInfo{
		KeyID:   keyInfo.KeyID,
		KDF:     cm.config.DefaultKDF,
		Params:  cm.getKDFParams(cm.config.DefaultKDF),
		Salt:    cm.generateSalt(),
		Context: []byte(tenantID.String()),
		Info:    []byte(name),
	}

	encKey, err := cm.keyManager.DeriveKey(ctx, []byte(keyInfo.KeyID), deriveInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to derive encryption key: %w", err)
	}

	// Encrypt the data
	encryptedData, encMeta, err := cm.encryptData(data, encKey, deriveInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt data: %w", err)
	}

	// Create credential
	credential := &Credential{
		ID:             uuid.New(),
		TenantID:       tenantID,
		Name:           name,
		Type:           credType,
		EncryptedData:  encryptedData,
		EncryptionMeta: encMeta,
		Metadata:       metadata,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		ExpiresAt:      expiresAt,
		CreatedBy:      createdBy,
		AccessCount:    0,
		Version:        1,
		IsActive:       true,
	}

	// Store credential
	err = cm.credentialStore.StoreCredential(ctx, credential)
	if err != nil {
		return nil, fmt.Errorf("failed to store credential: %w", err)
	}

	// Log audit event
	cm.logAuditEvent("credential_stored", map[string]interface{}{
		"credential_id": credential.ID,
		"tenant_id":     tenantID,
		"name":          name,
		"type":          credType,
		"created_by":    createdBy,
		"key_id":        keyInfo.KeyID,
	})

	cm.logger.WithFields(logrus.Fields{
		"credential_id": credential.ID,
		"tenant_id":     tenantID,
		"name":          name,
		"type":          credType,
	}).Info("Credential stored securely")

	return credential, nil
}

// GetCredential retrieves and decrypts a credential
func (cm *CredentialManager) GetCredential(ctx context.Context, id uuid.UUID, userID uuid.UUID) ([]byte, error) {
	// Get credential from store
	credential, err := cm.credentialStore.GetCredential(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get credential: %w", err)
	}

	// Check if credential is active and not expired
	if !credential.IsActive {
		return nil, fmt.Errorf("credential is not active")
	}

	if credential.ExpiresAt != nil && time.Now().After(*credential.ExpiresAt) {
		return nil, fmt.Errorf("credential has expired")
	}

	// Get encryption key
	encKey, err := cm.getEncryptionKey(ctx, credential.EncryptionMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to get encryption key: %w", err)
	}

	// Decrypt data
	data, err := cm.decryptData(credential.EncryptedData, encKey, credential.EncryptionMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credential: %w", err)
	}

	// Update access tracking
	if cm.config.AccessTracking {
		err = cm.credentialStore.UpdateAccessLog(ctx, id, userID)
		if err != nil {
			cm.logger.WithError(err).Warn("Failed to update access log")
		}
	}

	// Log audit event
	cm.logAuditEvent("credential_accessed", map[string]interface{}{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          credential.Name,
		"type":          credential.Type,
		"accessed_by":   userID,
		"access_count":  credential.AccessCount + 1,
	})

	return data, nil
}

// GetCredentialByName retrieves a credential by name
func (cm *CredentialManager) GetCredentialByName(ctx context.Context, tenantID uuid.UUID, name string, userID uuid.UUID) ([]byte, error) {
	credential, err := cm.credentialStore.GetCredentialByName(ctx, tenantID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get credential by name: %w", err)
	}

	return cm.GetCredential(ctx, credential.ID, userID)
}

// UpdateCredential updates an existing credential
func (cm *CredentialManager) UpdateCredential(
	ctx context.Context,
	id uuid.UUID,
	userID uuid.UUID,
	name string,
	data []byte,
	metadata map[string]string,
	expiresAt *time.Time,
) error {
	// Get existing credential
	credential, err := cm.credentialStore.GetCredential(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get existing credential: %w", err)
	}

	// Generate new encryption key for rotation
	keyInfo, err := cm.keyManager.CreateKey(ctx, string(cm.config.DefaultAlgorithm))
	if err != nil {
		return fmt.Errorf("failed to create new encryption key: %w", err)
	}

	// Derive encryption key
	deriveInfo := KeyDerivationInfo{
		KeyID:   keyInfo.KeyID,
		KDF:     cm.config.DefaultKDF,
		Params:  cm.getKDFParams(cm.config.DefaultKDF),
		Salt:    cm.generateSalt(),
		Context: []byte(credential.TenantID.String()),
		Info:    []byte(name),
	}

	encKey, err := cm.keyManager.DeriveKey(ctx, []byte(keyInfo.KeyID), deriveInfo)
	if err != nil {
		return fmt.Errorf("failed to derive encryption key: %w", err)
	}

	// Encrypt the new data
	encryptedData, encMeta, err := cm.encryptData(data, encKey, deriveInfo)
	if err != nil {
		return fmt.Errorf("failed to encrypt data: %w", err)
	}

	// Update credential
	credential.Name = name
	credential.EncryptedData = encryptedData
	credential.EncryptionMeta = encMeta
	credential.Metadata = metadata
	credential.UpdatedAt = time.Now()
	credential.ExpiresAt = expiresAt
	credential.Version++

	err = cm.credentialStore.UpdateCredential(ctx, credential)
	if err != nil {
		return fmt.Errorf("failed to update credential: %w", err)
	}

	// Log audit event
	cm.logAuditEvent("credential_updated", map[string]interface{}{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          name,
		"type":          credential.Type,
		"updated_by":    userID,
		"version":       credential.Version,
		"key_id":        keyInfo.KeyID,
	})

	cm.logger.WithFields(logrus.Fields{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          name,
	}).Info("Credential updated")

	return nil
}

// DeleteCredential securely deletes a credential
func (cm *CredentialManager) DeleteCredential(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	// Get credential for audit logging
	credential, err := cm.credentialStore.GetCredential(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get credential for deletion: %w", err)
	}

	// Delete credential
	err = cm.credentialStore.DeleteCredential(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete credential: %w", err)
	}

	// Log audit event
	cm.logAuditEvent("credential_deleted", map[string]interface{}{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          credential.Name,
		"type":          credential.Type,
		"deleted_by":    userID,
	})

	cm.logger.WithFields(logrus.Fields{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          credential.Name,
	}).Info("Credential deleted")

	return nil
}

// RotateCredentialEncryption rotates the encryption key for a credential
func (cm *CredentialManager) RotateCredentialEncryption(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	// Get existing credential
	credential, err := cm.credentialStore.GetCredential(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get existing credential: %w", err)
	}

	// Decrypt with current key
	encKey, err := cm.getEncryptionKey(ctx, credential.EncryptionMeta)
	if err != nil {
		return fmt.Errorf("failed to get current encryption key: %w", err)
	}

	data, err := cm.decryptData(credential.EncryptedData, encKey, credential.EncryptionMeta)
	if err != nil {
		return fmt.Errorf("failed to decrypt current data: %w", err)
	}

	// Generate new encryption key
	keyInfo, err := cm.keyManager.CreateKey(ctx, string(cm.config.DefaultAlgorithm))
	if err != nil {
		return fmt.Errorf("failed to create new encryption key: %w", err)
	}

	// Derive new encryption key
	deriveInfo := KeyDerivationInfo{
		KeyID:   keyInfo.KeyID,
		KDF:     cm.config.DefaultKDF,
		Params:  cm.getKDFParams(cm.config.DefaultKDF),
		Salt:    cm.generateSalt(),
		Context: []byte(credential.TenantID.String()),
		Info:    []byte(credential.Name),
	}

	newEncKey, err := cm.keyManager.DeriveKey(ctx, []byte(keyInfo.KeyID), deriveInfo)
	if err != nil {
		return fmt.Errorf("failed to derive new encryption key: %w", err)
	}

	// Re-encrypt with new key
	encryptedData, encMeta, err := cm.encryptData(data, newEncKey, deriveInfo)
	if err != nil {
		return fmt.Errorf("failed to re-encrypt data: %w", err)
	}

	// Update credential
	credential.EncryptedData = encryptedData
	credential.EncryptionMeta = encMeta
	credential.UpdatedAt = time.Now()
	credential.Version++

	err = cm.credentialStore.UpdateCredential(ctx, credential)
	if err != nil {
		return fmt.Errorf("failed to update credential with new encryption: %w", err)
	}

	// Log audit event
	cm.logAuditEvent("credential_encryption_rotated", map[string]interface{}{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          credential.Name,
		"type":          credential.Type,
		"rotated_by":    userID,
		"version":       credential.Version,
		"old_key_id":    credential.EncryptionMeta.KeyID,
		"new_key_id":    keyInfo.KeyID,
	})

	cm.logger.WithFields(logrus.Fields{
		"credential_id": credential.ID,
		"tenant_id":     credential.TenantID,
		"name":          credential.Name,
	}).Info("Credential encryption rotated")

	return nil
}

// ListCredentials lists credentials with filtering
func (cm *CredentialManager) ListCredentials(ctx context.Context, tenantID uuid.UUID, filter CredentialFilter) ([]*Credential, error) {
	return cm.credentialStore.ListCredentials(ctx, tenantID, filter)
}

// Private methods

func (cm *CredentialManager) encryptData(data []byte, key []byte, deriveInfo KeyDerivationInfo) ([]byte, EncryptionMetadata, error) {
	var nonce []byte
	var encrypted []byte

	switch cm.config.DefaultAlgorithm {
	case AlgorithmAES256GCM:
		nonce = cm.generateNonce(12) // GCM nonce is typically 12 bytes
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, EncryptionMetadata{}, fmt.Errorf("failed to create cipher: %w", err)
		}

		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, EncryptionMetadata{}, fmt.Errorf("failed to create GCM: %w", err)
		}

		encrypted = aesgcm.Seal(nil, nonce, data, nil)

	case AlgorithmAES256CBC:
		nonce = cm.generateNonce(16) // AES block size
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, EncryptionMetadata{}, fmt.Errorf("failed to create cipher: %w", err)
		}

		encrypted = make([]byte, len(data))
		iv := nonce // For CBC, nonce is used as IV

		mode := cipher.NewCBCEncrypter(block, iv)
		mode.CryptBlocks(encrypted, data)

	case AlgorithmChaCha20Poly1305:
		nonce = cm.generateNonce(12) // ChaCha20Poly1305 nonce is 12 bytes
		aead, err := chacha20poly1305.New(key)
		if err != nil {
			return nil, EncryptionMetadata{}, fmt.Errorf("failed to create ChaCha20Poly1305: %w", err)
		}

		encrypted = aead.Seal(nil, nonce, data, nil)

	default:
		return nil, EncryptionMetadata{}, fmt.Errorf("unsupported encryption algorithm: %s", cm.config.DefaultAlgorithm)
	}

	metadata := EncryptionMetadata{
		Algorithm:  cm.config.DefaultAlgorithm,
		KeyID:      deriveInfo.KeyID,
		KDF:        deriveInfo.KDF,
		KDFParams:  deriveInfo.Params,
		Nonce:      nonce,
		Salt:       deriveInfo.Salt,
		Timestamp:  time.Now(),
		KeyVersion: 1,
	}

	return encrypted, metadata, nil
}

func (cm *CredentialManager) decryptData(encryptedData []byte, key []byte, meta EncryptionMetadata) ([]byte, error) {
	var decrypted []byte

	switch meta.Algorithm {
	case AlgorithmAES256GCM:
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, fmt.Errorf("failed to create cipher: %w", err)
		}

		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, fmt.Errorf("failed to create GCM: %w", err)
		}

		var gcmErr error
		decrypted, gcmErr = aesgcm.Open(nil, meta.Nonce, encryptedData, nil)
		if gcmErr != nil {
			return nil, fmt.Errorf("failed to decrypt with GCM: %w", gcmErr)
		}

	case AlgorithmAES256CBC:
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, fmt.Errorf("failed to create cipher: %w", err)
		}

		if len(encryptedData)%aes.BlockSize != 0 {
			return nil, fmt.Errorf("encrypted data is not a multiple of the block size")
		}

		decrypted = make([]byte, len(encryptedData))
		iv := meta.Nonce

		mode := cipher.NewCBCDecrypter(block, iv)
		mode.CryptBlocks(decrypted, encryptedData)

		// Remove PKCS#7 padding
		decrypted = cm.removePKCS7Padding(decrypted)

	case AlgorithmChaCha20Poly1305:
		aead, err := chacha20poly1305.New(key)
		if err != nil {
			return nil, fmt.Errorf("failed to create ChaCha20Poly1305: %w", err)
		}

		var chachaErr error
		decrypted, chachaErr = aead.Open(nil, meta.Nonce, encryptedData, nil)
		if chachaErr != nil {
			return nil, fmt.Errorf("failed to decrypt with ChaCha20Poly1305: %w", chachaErr)
		}

	default:
		return nil, fmt.Errorf("unsupported encryption algorithm: %s", meta.Algorithm)
	}

	return decrypted, nil
}

func (cm *CredentialManager) getEncryptionKey(ctx context.Context, meta EncryptionMetadata) ([]byte, error) {
	// Check cache first
	cm.keyCacheMutex.RLock()
	if key, exists := cm.keyCache[meta.KeyID]; exists {
		cm.keyCacheMutex.RUnlock()
		return key, nil
	}
	cm.keyCacheMutex.RUnlock()

	// Get key from key manager
	masterKey, err := cm.keyManager.GetKey(ctx, meta.KeyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get master key: %w", err)
	}

	// Derive encryption key
	deriveInfo := KeyDerivationInfo{
		KeyID:   meta.KeyID,
		KDF:     meta.KDF,
		Params:  meta.KDFParams,
		Salt:    meta.Salt,
		Context: nil, // Not needed for decryption
		Info:    nil, // Not needed for decryption
	}

	encKey, err := cm.keyManager.DeriveKey(ctx, masterKey, deriveInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to derive encryption key: %w", err)
	}

	// Cache the key
	cm.keyCacheMutex.Lock()
	if len(cm.keyCache) < cm.config.KeyCacheSize {
		cm.keyCache[meta.KeyID] = encKey
	}
	cm.keyCacheMutex.Unlock()

	return encKey, nil
}

func (cm *CredentialManager) getKDFParams(kdf KeyDerivationFunction) map[string]interface{} {
	switch kdf {
	case KDFHKDFSHA256:
		return map[string]interface{}{
			"hash": "SHA256",
			"info": "SDLC-Platform-Credential",
		}

	case KDFPBKDF2SHA256:
		return map[string]interface{}{
			"iterations": 100000,
			"key_length": 32,
			"hash":       "SHA256",
		}

	case KDFArgon2ID:
		return map[string]interface{}{
			"time":       3,
			"memory":     64 * 1024, // 64MB
			"threads":    4,
			"key_length": 32,
		}

	default:
		return map[string]interface{}{}
	}
}

func (cm *CredentialManager) generateSalt() []byte {
	salt := make([]byte, 32)
	_, err := rand.Read(salt)
	if err != nil {
		cm.logger.WithError(err).Fatal("Failed to generate salt")
	}
	return salt
}

func (cm *CredentialManager) generateNonce(size int) []byte {
	nonce := make([]byte, size)
	_, err := rand.Read(nonce)
	if err != nil {
		cm.logger.WithError(err).Fatal("Failed to generate nonce")
	}
	return nonce
}

func (cm *CredentialManager) removePKCS7Padding(data []byte) []byte {
	if len(data) == 0 {
		return data
	}

	padding := int(data[len(data)-1])
	if padding == 0 || padding > len(data) {
		return data
	}

	for i := len(data) - padding; i < len(data); i++ {
		if data[i] != byte(padding) {
			return data
		}
	}

	return data[:len(data)-padding]
}

func (cm *CredentialManager) logAuditEvent(event string, details map[string]interface{}) {
	if !cm.config.AuditLogging {
		return
	}

	auditData := map[string]interface{}{
		"event":     event,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	for k, v := range details {
		auditData[k] = v
	}

	cm.auditLogger.WithFields(logrus.Fields(auditData)).Info("Audit event")
}

// InMemoryKeyManager implements KeyManager interface for testing/development
type InMemoryKeyManager struct {
	keys  map[string][]byte
	mutex sync.RWMutex
}

// NewInMemoryKeyManager creates a new in-memory key manager
func NewInMemoryKeyManager() *InMemoryKeyManager {
	return &InMemoryKeyManager{
		keys: make(map[string][]byte),
	}
}

func (km *InMemoryKeyManager) GetKey(ctx context.Context, keyID string) ([]byte, error) {
	km.mutex.RLock()
	defer km.mutex.RUnlock()

	key, exists := km.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	// Return a copy of the key
	keyCopy := make([]byte, len(key))
	copy(keyCopy, key)

	return keyCopy, nil
}

func (km *InMemoryKeyManager) DeriveKey(ctx context.Context, masterKey []byte, keyInfo KeyDerivationInfo) ([]byte, error) {
	switch keyInfo.KDF {
	case KDFHKDFSHA256:
		hash := sha256.New
		hkdf := hkdf.New(hash, masterKey, keyInfo.Salt, keyInfo.Info)

		derivedKey := make([]byte, 32)
		_, err := hkdf.Read(derivedKey)
		if err != nil {
			return nil, fmt.Errorf("HKDF derivation failed: %w", err)
		}
		return derivedKey, nil

	case KDFPBKDF2SHA256:
		params, ok := keyInfo.Params["iterations"].(float64)
		if !ok {
			params = 100000.0
		}
		iterations := int(params)

		return pbkdf2.Key(masterKey, keyInfo.Salt, iterations, 32, sha256.New), nil

	case KDFArgon2ID:
		// This is a simplified implementation
		// In practice, you'd use the golang.org/x/crypto/argon2 package
		timeParam, _ := keyInfo.Params["time"].(float64)
		keyLen, _ := keyInfo.Params["key_length"].(float64)

		// Simplified: using PBKDF2 as fallback for Argon2id
		return pbkdf2.Key(masterKey, keyInfo.Salt, int(timeParam), int(keyLen), sha256.New), nil

	default:
		return nil, fmt.Errorf("unsupported KDF: %s", keyInfo.KDF)
	}
}

func (km *InMemoryKeyManager) RotateKey(ctx context.Context, keyID string) error {
	km.mutex.Lock()
	defer km.mutex.Unlock()

	delete(km.keys, keyID)
	return nil
}

func (km *InMemoryKeyManager) GetKeyInfo(ctx context.Context, keyID string) (*KeyInfo, error) {
	km.mutex.RLock()
	defer km.mutex.RUnlock()

	_, exists := km.keys[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	return &KeyInfo{
		KeyID:     keyID,
		Algorithm: AlgorithmAES256GCM,
		KDF:       KDFHKDFSHA256,
		CreatedAt: time.Now(),
		Version:   1,
		Status:    "active",
	}, nil
}

func (km *InMemoryKeyManager) CreateKey(ctx context.Context, keyType string) (*KeyInfo, error) {
	keyID := uuid.New().String()

	// Generate random key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	km.mutex.Lock()
	km.keys[keyID] = key
	km.mutex.Unlock()

	return &KeyInfo{
		KeyID:     keyID,
		Algorithm: EncryptionAlgorithm(keyType),
		KDF:       KDFHKDFSHA256,
		CreatedAt: time.Now(),
		Version:   1,
		Status:    "active",
	}, nil
}

func (km *InMemoryKeyManager) RevokeKey(ctx context.Context, keyID string) error {
	km.mutex.Lock()
	defer km.mutex.Unlock()

	delete(km.keys, keyID)
	return nil
}

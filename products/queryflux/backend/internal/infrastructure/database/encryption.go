package database

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// EncryptionService provides AES-GCM encryption for sensitive data
type EncryptionService struct {
	key    []byte
	logger *logrus.Logger
}

// NewEncryptionService creates a new encryption service with the given key
func NewEncryptionService(key string) (*EncryptionService, error) {
	if key == "" {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	// Hash the key to ensure it's 32 bytes for AES-256
	hash := sha256.Sum256([]byte(key))

	return &EncryptionService{
		key:    hash[:],
		logger: logrus.New(),
	}, nil
}

// Encrypt encrypts plaintext using AES-GCM
func (es *EncryptionService) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil // Don't encrypt empty strings
	}

	// Create AES cipher
	block, err := aes.NewCipher(es.key)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM mode: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt the plaintext
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// Encode to base64 for storage
	encoded := base64.StdEncoding.EncodeToString(ciphertext)

	es.logger.Debugf("Successfully encrypted data of length %d", len(plaintext))
	return encoded, nil
}

// Decrypt decrypts ciphertext using AES-GCM
func (es *EncryptionService) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil // Don't decrypt empty strings
	}

	// Decode from base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Create AES cipher
	block, err := aes.NewCipher(es.key)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM mode: %w", err)
	}

	// Check minimum length
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce, ciphertext_bytes := data[:nonceSize], data[nonceSize:]

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext_bytes, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	es.logger.Debugf("Successfully decrypted data of length %d", len(plaintext))
	return string(plaintext), nil
}

// EncryptConnectionCredentials encrypts sensitive fields in a connection
func (es *EncryptionService) EncryptConnectionCredentials(conn *entities.Connection) error {
	if conn.Password != "" {
		encryptedPassword, err := es.Encrypt(conn.Password)
		if err != nil {
			return fmt.Errorf("failed to encrypt password: %w", err)
		}
		conn.Password = encryptedPassword
	}

	// Encrypt other sensitive options if needed
	if conn.Options != nil {
		sensitiveKeys := []string{"ssl_key", "ssl_cert", "private_key", "token", "api_key"}
		for _, key := range sensitiveKeys {
			if value, exists := conn.Options[key]; exists && value != "" {
				encryptedValue, err := es.Encrypt(value)
				if err != nil {
					return fmt.Errorf("failed to encrypt option %s: %w", key, err)
				}
				conn.Options[key] = encryptedValue
			}
		}
	}

	return nil
}

// DecryptConnectionCredentials decrypts sensitive fields in a connection
func (es *EncryptionService) DecryptConnectionCredentials(conn *entities.Connection) error {
	if conn.Password != "" {
		decryptedPassword, err := es.Decrypt(conn.Password)
		if err != nil {
			return fmt.Errorf("failed to decrypt password: %w", err)
		}
		conn.Password = decryptedPassword
	}

	// Decrypt other sensitive options if needed
	if conn.Options != nil {
		sensitiveKeys := []string{"ssl_key", "ssl_cert", "private_key", "token", "api_key"}
		for _, key := range sensitiveKeys {
			if value, exists := conn.Options[key]; exists && value != "" {
				decryptedValue, err := es.Decrypt(value)
				if err != nil {
					return fmt.Errorf("failed to decrypt option %s: %w", key, err)
				}
				conn.Options[key] = decryptedValue
			}
		}
	}

	return nil
}

// ValidateKey validates that the encryption key is strong enough
func ValidateEncryptionKey(key string) error {
	if len(key) < 16 {
		return fmt.Errorf("encryption key must be at least 16 characters long")
	}

	// Check for basic complexity
	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false

	for _, char := range key {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}

	complexity := 0
	if hasUpper {
		complexity++
	}
	if hasLower {
		complexity++
	}
	if hasDigit {
		complexity++
	}
	if hasSpecial {
		complexity++
	}

	if complexity < 3 {
		return fmt.Errorf("encryption key must contain at least 3 of: uppercase, lowercase, digits, special characters")
	}

	return nil
}

// GenerateRandomKey generates a cryptographically secure random key
func GenerateRandomKey(length int) (string, error) {
	if length < 16 {
		length = 32 // Default to 32 bytes for AES-256
	}

	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}

	// Encode to base64 for easier handling
	return base64.StdEncoding.EncodeToString(bytes), nil
}

// RotateKey creates a new encryption service with a new key and re-encrypts data
func (es *EncryptionService) RotateKey(newKey string, connections []*entities.Connection) (*EncryptionService, error) {
	// Create new encryption service
	newService, err := NewEncryptionService(newKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create new encryption service: %w", err)
	}

	// Re-encrypt all connections
	for _, conn := range connections {
		// Decrypt with old key
		if err := es.DecryptConnectionCredentials(conn); err != nil {
			return nil, fmt.Errorf("failed to decrypt connection %s with old key: %w", conn.ID, err)
		}

		// Encrypt with new key
		if err := newService.EncryptConnectionCredentials(conn); err != nil {
			return nil, fmt.Errorf("failed to encrypt connection %s with new key: %w", conn.ID, err)
		}
	}

	es.logger.Infof("Successfully rotated encryption key for %d connections", len(connections))
	return newService, nil
}

// TestEncryption tests the encryption/decryption functionality
func (es *EncryptionService) TestEncryption() error {
	testData := []string{
		"simple password",
		"complex!P@ssw0rd#123",
		"unicode测试密码🔐",
		"", // empty string
		"very long password that contains many characters and should still work correctly with AES-GCM encryption",
	}

	for i, plaintext := range testData {
		// Encrypt
		ciphertext, err := es.Encrypt(plaintext)
		if err != nil {
			return fmt.Errorf("encryption test %d failed: %w", i, err)
		}

		// Decrypt
		decrypted, err := es.Decrypt(ciphertext)
		if err != nil {
			return fmt.Errorf("decryption test %d failed: %w", i, err)
		}

		// Verify
		if decrypted != plaintext {
			return fmt.Errorf("test %d failed: decrypted text doesn't match original", i)
		}
	}

	es.logger.Info("All encryption tests passed successfully")
	return nil
}
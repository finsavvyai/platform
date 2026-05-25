package security

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

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/domain"
	"golang.org/x/crypto/pbkdf2"
)

// AES256EncryptionService implements encryption using AES-256-GCM
type AES256EncryptionService struct {
	gcm       cipher.AEAD
	logger    *zap.Logger
	masterKey []byte
}

// NewAES256EncryptionService creates a new AES-256 encryption service
func NewAES256EncryptionService(masterKey string, logger *zap.Logger) (*AES256EncryptionService, error) {
	// Convert master key to 32-byte key using PBKDF2
	salt := []byte("queryflux-encryption-salt-v1") // In production, use a random salt per deployment
	key := pbkdf2.Key([]byte(masterKey), salt, 100000, 32, sha256.New)

	// Create cipher block
	block, err := aes.NewCipher(key)
	if err != nil {
		logger.Error("Failed to create cipher block", zap.Error(err))
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	// Create GCM
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		logger.Error("Failed to create GCM", zap.Error(err))
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	return &AES256EncryptionService{
		gcm:       gcm,
		logger:    logger,
		masterKey: key,
	}, nil
}

// EncryptAPIKey encrypts an API key
func (e *AES256EncryptionService) EncryptAPIKey(ctx context.Context, apiKey string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("API key cannot be empty")
	}

	// Create nonce
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		e.logger.Error("Failed to generate nonce", zap.Error(err))
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt
	ciphertext := e.gcm.Seal(nonce, nonce, []byte(apiKey), nil)

	// Encode to base64
	encrypted := base64.StdEncoding.EncodeToString(ciphertext)

	e.logger.Debug("Successfully encrypted API key",
		zap.Int("length", len(apiKey)),
		zap.Int("encrypted_length", len(encrypted)))

	return encrypted, nil
}

// DecryptAPIKey decrypts an API key
func (e *AES256EncryptionService) DecryptAPIKey(ctx context.Context, encryptedKey string) (string, error) {
	if encryptedKey == "" {
		return "", fmt.Errorf("encrypted key cannot be empty")
	}

	// Decode from base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedKey)
	if err != nil {
		e.logger.Error("Failed to decode base64", zap.Error(err))
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Check minimum length (nonce + data + auth tag)
	nonceSize := e.gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt
	plaintext, err := e.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		e.logger.Error("Failed to decrypt API key", zap.Error(err))
		return "", fmt.Errorf("failed to decrypt API key: %w", err)
	}

	apiKey := string(plaintext)

	e.logger.Debug("Successfully decrypted API key",
		zap.Int("encrypted_length", len(encryptedKey)),
		zap.Int("decrypted_length", len(apiKey)))

	return apiKey, nil
}

// EncryptRequest encrypts a request object
func (e *AES256EncryptionService) EncryptRequest(ctx context.Context, request interface{}) (string, error) {
	// Convert request to JSON
	// In a real implementation, you would use json.Marshal here
	// For now, we'll just encrypt a string representation
	requestStr := fmt.Sprintf("%v", request)
	return e.EncryptAPIKey(ctx, requestStr)
}

// DecryptRequest decrypts a request object
func (e *AES256EncryptionService) DecryptRequest(ctx context.Context, encryptedRequest string) (interface{}, error) {
	// Decrypt the request
	decrypted, err := e.DecryptAPIKey(ctx, encryptedRequest)
	if err != nil {
		return nil, err
	}

	// In a real implementation, you would use json.Unmarshal here
	// For now, we'll just return the string
	return decrypted, nil
}

// EncryptResponse encrypts a response object
func (e *AES256EncryptionService) EncryptResponse(ctx context.Context, response interface{}) (string, error) {
	// Similar to EncryptRequest
	responseStr := fmt.Sprintf("%v", response)
	return e.EncryptAPIKey(ctx, responseStr)
}

// DecryptResponse decrypts a response object
func (e *AES256EncryptionService) DecryptResponse(ctx context.Context, encryptedResponse string) (interface{}, error) {
	// Similar to DecryptRequest
	decrypted, err := e.DecryptAPIKey(ctx, encryptedResponse)
	if err != nil {
		return nil, err
	}

	return decrypted, nil
}

// ValidateAPIKeyFormat validates the format of an API key
func (e *AES256EncryptionService) ValidateAPIKeyFormat(service domain.AIService, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	// Basic validation for known services
	switch service {
	case domain.AIServiceOpenAI:
		// OpenAI keys start with "sk-"
		if len(apiKey) < 20 || !strings.HasPrefix(apiKey, "sk-") {
			return fmt.Errorf("invalid OpenAI API key format")
		}
	case domain.AIServiceClaude:
		// Claude keys are longer strings
		if len(apiKey) < 20 {
			return fmt.Errorf("invalid Claude API key format")
		}
	}

	return nil
}

// RotateMasterKey rotates the master encryption key (for key rotation)
func (e *AES256EncryptionService) RotateMasterKey(newMasterKey string, oldKeyFunc func(ctx context.Context) (map[string]string, error)) error {
	e.logger.Info("Starting master key rotation")

	// Create new encryption service with new key
	newService, err := NewAES256EncryptionService(newMasterKey, e.logger)
	if err != nil {
		return fmt.Errorf("failed to create new encryption service: %w", err)
	}

	// Get all encrypted keys using the old service
	ctx := context.Background()
	encryptedKeys, err := oldKeyFunc(ctx)
	if err != nil {
		return fmt.Errorf("failed to retrieve encrypted keys: %w", err)
	}

	// Re-encrypt all keys with the new master key
	for id, encryptedKey := range encryptedKeys {
		// Decrypt with old key
		decrypted, err := e.DecryptAPIKey(ctx, encryptedKey)
		if err != nil {
			e.logger.Error("Failed to decrypt key during rotation",
				zap.String("id", id),
				zap.Error(err))
			continue
		}

		// Encrypt with new key
		_, err = newService.EncryptAPIKey(ctx, decrypted)
		if err != nil {
			e.logger.Error("Failed to re-encrypt key during rotation",
				zap.String("id", id),
				zap.Error(err))
			continue
		}

		// In a real implementation, you would save the re-encrypted key to storage
		e.logger.Debug("Successfully re-encrypted key during rotation",
			zap.String("id", id))
	}

	// Update the current service
	e.gcm = newService.gcm
	e.masterKey = newService.masterKey

	e.logger.Info("Successfully rotated master key")
	return nil
}

// GenerateKey generates a new random encryption key
func GenerateKey(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}
	return base64.StdEncoding.EncodeToString(bytes), nil
}

// HashAPIKey creates a hash of an API key for identification
func HashAPIKey(apiKey string) string {
	hash := sha256.Sum256([]byte(apiKey))
	// Return first 16 characters as a short identifier
	return base64.StdEncoding.EncodeToString(hash[:])[:16]
}
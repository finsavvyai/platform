//go:build legacy_migrated
// +build legacy_migrated

package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/hkdf"
	"golang.org/x/crypto/pbkdf2"
)

// EncryptionAlgorithm represents the encryption algorithm used
type EncryptionAlgorithm string

const (
	AlgorithmAES256GCM EncryptionAlgorithm = "AES-256-GCM"
	AlgorithmAES256CBC EncryptionAlgorithm = "AES-256-CBC"
)

// EncryptionService provides encryption and decryption services
type EncryptionService struct {
	primaryKey   []byte
	previousKeys [][]byte
	algorithm    EncryptionAlgorithm
	keyID        string
	createdAt    time.Time
}

// EncryptedData represents encrypted data with metadata
type EncryptedData struct {
	Ciphertext  string                 `json:"ciphertext"`
	Nonce       string                 `json:"nonce,omitempty"`
	Tag         string                 `json:"tag,omitempty"`
	KeyID       string                 `json:"key_id"`
	Algorithm   string                 `json:"algorithm"`
	EncryptedAt time.Time              `json:"encrypted_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// EncryptionConfig contains configuration for the encryption service
type EncryptionConfig struct {
	PrimaryEncryptionKey string              `json:"primary_key"`
	PreviousKeys         []string            `json:"previous_keys,omitempty"`
	Algorithm            EncryptionAlgorithm `json:"algorithm"`
	KeyID                string              `json:"key_id"`
	Iterations           int                 `json:"iterations,omitempty"`
	Salt                 string              `json:"salt,omitempty"`
}

// FieldEncryptionConfig defines which fields should be encrypted
type FieldEncryptionConfig struct {
	ModelName       string              `json:"model_name"`
	EncryptedFields []string            `json:"encrypted_fields"`
	Algorithm       EncryptionAlgorithm `json:"algorithm"`
	KeyID           string              `json:"key_id"`
	AdditionalData  map[string]string   `json:"additional_data,omitempty"`
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(config EncryptionConfig) (*EncryptionService, error) {
	if config.PrimaryEncryptionKey == "" {
		return nil, fmt.Errorf("primary encryption key is required")
	}

	if config.Algorithm == "" {
		config.Algorithm = AlgorithmAES256GCM
	}

	// Decode primary key
	primaryKey, err := base64.StdEncoding.DecodeString(config.PrimaryEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode primary encryption key: %w", err)
	}

	// Validate key length
	if len(primaryKey) != 32 {
		return nil, fmt.Errorf("invalid primary key length: expected 32 bytes, got %d", len(primaryKey))
	}

	// Decode previous keys
	var previousKeys [][]byte
	for _, keyStr := range config.PreviousKeys {
		key, err := base64.StdEncoding.DecodeString(keyStr)
		if err != nil {
			return nil, fmt.Errorf("failed to decode previous key: %w", err)
		}
		if len(key) == 32 {
			previousKeys = append(previousKeys, key)
		}
	}

	// Generate key ID if not provided
	keyID := config.KeyID
	if keyID == "" {
		keyID = generateKeyID(primaryKey)
	}

	return &EncryptionService{
		primaryKey:   primaryKey,
		previousKeys: previousKeys,
		algorithm:    config.Algorithm,
		keyID:        keyID,
		createdAt:    time.Now(),
	}, nil
}

// NewEncryptionServiceFromEnv creates encryption service from environment variables
func NewEncryptionServiceFromEnv() (*EncryptionService, error) {
	config := EncryptionConfig{
		PrimaryEncryptionKey: os.Getenv("ENCRYPTION_KEY"),
		Algorithm:            EncryptionAlgorithm(os.Getenv("ENCRYPTION_ALGORITHM")),
		KeyID:                os.Getenv("ENCRYPTION_KEY_ID"),
	}

	// Load previous keys from environment (comma-separated)
	if previousKeysStr := os.Getenv("ENCRYPTION_PREVIOUS_KEYS"); previousKeysStr != "" {
		previousKeys := strings.Split(previousKeysStr, ",")
		for _, key := range previousKeys {
			config.PreviousKeys = append(config.PreviousKeys, strings.TrimSpace(key))
		}
	}

	return NewEncryptionService(config)
}

// Encrypt encrypts data using the configured algorithm
func (e *EncryptionService) Encrypt(plaintext []byte) (*EncryptedData, error) {
	switch e.algorithm {
	case AlgorithmAES256GCM:
		return e.encryptAES256GCM(plaintext)
	case AlgorithmAES256CBC:
		return e.encryptAES256CBC(plaintext)
	default:
		return nil, fmt.Errorf("unsupported encryption algorithm: %s", e.algorithm)
	}
}

// EncryptString encrypts a string
func (e *EncryptionService) EncryptString(plaintext string) (*EncryptedData, error) {
	if plaintext == "" {
		return nil, fmt.Errorf("plaintext cannot be empty")
	}

	return e.Encrypt([]byte(plaintext))
}

// EncryptJSON encrypts JSON data
func (e *EncryptionService) EncryptJSON(data interface{}) (*EncryptedData, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON data: %w", err)
	}

	return e.Encrypt(jsonData)
}

// Decrypt decrypts data using the appropriate key
func (e *EncryptionService) Decrypt(encryptedData *EncryptedData) ([]byte, error) {
	// Try primary key first
	if encryptedData.KeyID == e.keyID {
		return e.decryptWithKey(encryptedData, e.primaryKey)
	}

	// Try previous keys
	for i, key := range e.previousKeys {
		keyID := generateKeyID(key)
		if encryptedData.KeyID == keyID {
			return e.decryptWithKey(encryptedData, key)
		}
	}

	return nil, fmt.Errorf("no matching key found for key ID: %s", encryptedData.KeyID)
}

// DecryptString decrypts to a string
func (e *EncryptionService) DecryptString(encryptedData *EncryptedData) (string, error) {
	decrypted, err := e.Decrypt(encryptedData)
	if err != nil {
		return "", err
	}

	return string(decrypted), nil
}

// DecryptJSON decrypts to JSON data
func (e *EncryptionService) DecryptJSON(encryptedData *EncryptedData, target interface{}) error {
	decrypted, err := e.Decrypt(encryptedData)
	if err != nil {
		return err
	}

	return json.Unmarshal(decrypted, target)
}

// encryptAES256GCM encrypts data using AES-256-GCM
func (e *EncryptionService) encryptAES256GCM(plaintext []byte) (*EncryptedData, error) {
	block, err := aes.NewCipher(e.primaryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM cipher: %w", err)
	}

	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := aesgcm.Seal(nil, nonce, plaintext, nil)

	return &EncryptedData{
		Ciphertext:  base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:       base64.StdEncoding.EncodeToString(nonce),
		KeyID:       e.keyID,
		Algorithm:   string(e.algorithm),
		EncryptedAt: time.Now(),
	}, nil
}

// encryptAES256CBC encrypts data using AES-256-CBC
func (e *EncryptionService) encryptAES256CBC(plaintext []byte) (*EncryptedData, error) {
	block, err := aes.NewCipher(e.primaryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	// PKCS7 padding
	plaintext = pkcs7Pad(plaintext, aes.BlockSize)

	// Generate IV
	iv := make([]byte, aes.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, fmt.Errorf("failed to generate IV: %w", err)
	}

	ciphertext := make([]byte, len(plaintext))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, plaintext)

	return &EncryptedData{
		Ciphertext:  base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:       base64.StdEncoding.EncodeToString(iv),
		KeyID:       e.keyID,
		Algorithm:   string(e.algorithm),
		EncryptedAt: time.Now(),
	}, nil
}

// decryptWithKey decrypts data using a specific key
func (e *EncryptionService) decryptWithKey(encryptedData *EncryptedData, key []byte) ([]byte, error) {
	switch EncryptionAlgorithm(encryptedData.Algorithm) {
	case AlgorithmAES256GCM:
		return e.decryptAES256GCM(encryptedData, key)
	case AlgorithmAES256CBC:
		return e.decryptAES256CBC(encryptedData, key)
	default:
		return nil, fmt.Errorf("unsupported decryption algorithm: %s", encryptedData.Algorithm)
	}
}

// decryptAES256GCM decrypts data using AES-256-GCM
func (e *EncryptionService) decryptAES256GCM(encryptedData *EncryptedData, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM cipher: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(encryptedData.Nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt data: %w", err)
	}

	return plaintext, nil
}

// decryptAES256CBC decrypts data using AES-256-CBC
func (e *EncryptionService) decryptAES256CBC(encryptedData *EncryptedData, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	iv, err := base64.StdEncoding.DecodeString(encryptedData.Nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode IV: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedData.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	if len(ciphertext)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("ciphertext is not a multiple of the block size")
	}

	plaintext := make([]byte, len(ciphertext))
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(plaintext, ciphertext)

	// Remove PKCS7 padding
	plaintext, err = pkcs7Unpad(plaintext, aes.BlockSize)
	if err != nil {
		return nil, fmt.Errorf("failed to remove padding: %w", err)
	}

	return plaintext, nil
}

// RotateKey rotates the encryption key
func (e *EncryptionService) RotateKey(newKey string) error {
	// Decode new key
	keyBytes, err := base64.StdEncoding.DecodeString(newKey)
	if err != nil {
		return fmt.Errorf("failed to decode new key: %w", err)
	}

	if len(keyBytes) != 32 {
		return fmt.Errorf("invalid new key length: expected 32 bytes, got %d", len(keyBytes))
	}

	// Add current primary key to previous keys
	e.previousKeys = append([][]byte{e.primaryKey}, e.previousKeys...)

	// Limit previous keys to 5
	if len(e.previousKeys) > 5 {
		e.previousKeys = e.previousKeys[:5]
	}

	// Set new primary key
	e.primaryKey = keyBytes
	e.keyID = generateKeyID(keyBytes)

	return nil
}

// GetKeyInfo returns information about current encryption keys
func (e *EncryptionService) GetKeyInfo() map[string]interface{} {
	keyIDs := []string{e.keyID}
	for _, key := range e.previousKeys {
		keyIDs = append(keyIDs, generateKeyID(key))
	}

	return map[string]interface{}{
		"primary_key_id":   e.keyID,
		"previous_key_ids": keyIDs[1:],
		"algorithm":        string(e.algorithm),
		"created_at":       e.createdAt,
		"total_keys":       len(e.previousKeys) + 1,
	}
}

// GenerateKey generates a new encryption key
func GenerateKey() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("failed to generate key: %w", err)
	}

	return base64.StdEncoding.EncodeToString(key), nil
}

// DeriveKey derives a key from a password using PBKDF2
func DeriveKey(password, salt string, iterations int) (string, error) {
	if iterations <= 0 {
		iterations = 100000 // Default iterations
	}

	saltBytes := []byte(salt)
	if len(saltBytes) == 0 {
		saltBytes = make([]byte, 16)
		if _, err := rand.Read(saltBytes); err != nil {
			return "", fmt.Errorf("failed to generate salt: %w", err)
		}
	}

	key := pbkdf2.Key([]byte(password), saltBytes, iterations, 32, sha256.New)
	return base64.StdEncoding.EncodeToString(key), nil
}

// DeriveKeyHKDF derives a key using HKDF
func DeriveKeyHKDF(inputKey, salt, info string) (string, error) {
	hkdf := hkdf.New(sha256.New, []byte(inputKey), []byte(salt), []byte(info))

	key := make([]byte, 32)
	if _, err := io.ReadFull(hkdf, key); err != nil {
		return "", fmt.Errorf("failed to derive key: %w", err)
	}

	return base64.StdEncoding.EncodeToString(key), nil
}

// generateKeyID generates a unique key ID
func generateKeyID(key []byte) string {
	hash := sha256.Sum256(key)
	return base64.StdEncoding.EncodeToString(hash[:8])
}

// pkcs7Pad implements PKCS7 padding
func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	padtext := make([]byte, padding)
	for i := range padtext {
		padtext[i] = byte(padding)
	}
	return append(data, padtext...)
}

// pkcs7Unpad removes PKCS7 padding
func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty data")
	}

	padding := int(data[len(data)-1])
	if padding < 1 || padding > blockSize {
		return nil, fmt.Errorf("invalid padding")
	}

	for i := len(data) - padding; i < len(data); i++ {
		if int(data[i]) != padding {
			return nil, fmt.Errorf("invalid padding")
		}
	}

	return data[:len(data)-padding], nil
}

// HealthCheck performs a health check on the encryption service
func (e *EncryptionService) HealthCheck() error {
	testData := []byte("test-encryption-123")

	// Test encryption
	encrypted, err := e.Encrypt(testData)
	if err != nil {
		return fmt.Errorf("encryption test failed: %w", err)
	}

	// Test decryption
	decrypted, err := e.Decrypt(encrypted)
	if err != nil {
		return fmt.Errorf("decryption test failed: %w", err)
	}

	// Verify data integrity
	if string(decrypted) != string(testData) {
		return fmt.Errorf("decrypted data does not match original")
	}

	return nil
}
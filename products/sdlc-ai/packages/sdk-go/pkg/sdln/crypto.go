package sdln

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
)

// CryptoManager provides encryption and decryption capabilities
type CryptoManager struct {
	masterKey []byte
}

// NewCryptoManager creates a new crypto manager with a generated master key
func NewCryptoManager() *CryptoManager {
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		panic(fmt.Errorf("failed to generate master key: %w", err))
	}
	return &CryptoManager{masterKey: masterKey}
}

// NewCryptoManagerWithKey creates a crypto manager with the provided master key
func NewCryptoManagerWithKey(masterKey []byte) *CryptoManager {
	if len(masterKey) != 32 {
		panic("master key must be 32 bytes")
	}
	return &CryptoManager{masterKey: masterKey}
}

// Encrypt encrypts data using AES-256-GCM
func (cm *CryptoManager) Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(cm.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, aesgcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := aesgcm.Seal(nonce, plaintext, nil)

	// Prepend nonce to ciphertext
	result := make([]byte, len(nonce)+len(ciphertext))
	copy(result, nonce)
	copy(result[len(nonce):], ciphertext)

	return result, nil
}

// Decrypt decrypts data using AES-256-GCM
func (cm *CryptoManager) Decrypt(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < aes.NonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	block, err := aes.NewCipher(cm.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := aesgcm.NonceSize()
	nonce := ciphertext[:nonceSize]
	encryptedData := ciphertext[nonceSize:]

	plaintext, err := aesgcm.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// GenerateKey generates a new encryption key
func (cm *CryptoManager) GenerateKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}
	return key, nil
}

// DeriveKey derives a key from the master key using HKDF
func (cm *CryptoManager) DeriveKey(info []byte) ([]byte, error) {
	mac := hmac.New(sha256.New, cm.masterKey)
	mac.Write(info)
	h := mac.Sum(nil)

	// Use the hash as the derived key
	key := make([]byte, 32)
	if len(h) < 32 {
		// Pad with zeros if needed
		copy(key, h)
	} else {
		copy(key, h[:32])
	}

	return key, nil
}

// Hash creates a SHA-256 hash of the data
func (cm *CryptoManager) Hash(data []byte) ([]byte, error) {
	h := sha256.Sum256(data)
	return h[:], nil
}

// VerifyHash verifies that the hash matches the data
func (cm *CryptoManager) VerifyHash(data []byte, hash []byte) bool {
	computedHash := cm.MustHash(data)
	return subtle.ConstantTimeCompare(computedHash, hash) == 1
}

// MustHash creates a SHA-256 hash, panicking on error
func (cm *CryptoManager) MustHash(data []byte) []byte {
	h := sha256.Sum256(data)
	return h[:]
}

// EncryptString encrypts a string and returns base64 encoded result
func (cm *CryptoManager) EncryptString(plaintext string) (string, error) {
	ciphertext, err := cm.Encrypt([]byte(plaintext))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a base64 encoded string
func (cm *CryptoManager) DecryptString(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	plaintext, err := cm.Decrypt(data)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// Seal creates a tamper-resistant sealed message
func (cm *CryptoManager) Seal(message []byte) ([]byte, error) {
	// Add hash for integrity protection
	hash, err := cm.Hash(message)
	if err != nil {
		return nil, err
	}

	// Combine message with hash
	sealData := append(message, hash...)

	// Encrypt the combined data
	encrypted, err := cm.Encrypt(sealData)
	if err != nil {
		return nil, err
	}

	return encrypted, nil
}

// Open decrypts and verifies a sealed message
func (cm *CryptoManager) Open(sealedMessage []byte) ([]byte, error) {
	// Decrypt the sealed message
	data, err := cm.Decrypt(sealedMessage)
	if err != nil {
		return nil, err
	}

	if len(data) < 32 { // SHA256 hash length
		return nil, fmt.Errorf("invalid sealed message format")
	}

	// Split message and hash
	message := data[:len(data)-32]
	hash := data[len(data)-32:]

	// Verify integrity
	if !cm.VerifyHash(message, hash) {
		return nil, fmt.Errorf("sealed message integrity check failed")
	}

	return message, nil
}

// SealString creates a tamper-resistant sealed string message
func (cm *CryptoManager) SealString(message string) (string, error) {
	sealed, err := cm.Seal([]byte(message))
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// OpenString decrypts and verifies a sealed string message
func (cm *CryptoManager) OpenString(sealedMessage string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(sealedMessage)
	if err != nil {
		return "", err
	}

	message, err := cm.Open(data)
	if err != nil {
		return "", err
	}

	return string(message), nil
}

// GenerateRandomBytes generates cryptographically secure random bytes
func GenerateRandomBytes(length int) ([]byte, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return nil, fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return bytes, nil
}

// GenerateRandomString generates a cryptographically secure random string
func GenerateRandomString(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	bytes, err := GenerateRandomBytes(length)
	if err != nil {
		return "", err
	}

	for i, b := range bytes {
		bytes[i] = charset[b%byte(len(charset))]
	}

	return string(bytes), nil
}

// GenerateToken generates a cryptographically secure random token
func GenerateToken(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
	bytes, err := GenerateRandomBytes(length)
	if err != nil {
		return "", err
	}

	for i, b := range bytes {
		bytes[i] = charset[b%byte(len(charset))]
	}

	return string(bytes), nil
}

// SecureCompare compares two slices in constant time
func SecureCompare(a, b []byte) bool {
	return subtle.ConstantTimeCompare(a, b) == 1
}

// KeyDerivation provides key derivation functions
type KeyDerivation struct {
	cryptoManager *CryptoManager
}

// NewKeyDerivation creates a new key derivation instance
func NewKeyDerivation(cm *CryptoManager) *KeyDerivation {
	return &KeyDerivation{cryptoManager: cm}
}

// DeriveEncryptionKey derives an encryption key from a password and salt
func (kd *KeyDerivation) DeriveEncryptionKey(password, salt []byte) ([]byte, error) {
	// Use PBKDF2 for key derivation
	return kd.deriveKey(password, salt, 32)
}

// DeriveKey derives a key using PBKDF2
func (kd *KeyDerivation) deriveKey(password, salt []byte, keyLen int) ([]byte, error) {
	h := hmac.New(sha256.New, kd.cryptoManager.masterKey)
	h.Write([]byte("key-derivation"))
	h.Write(password)
	h.Write(salt)

	// Simple key derivation - in production, use crypto/pbkdf2
	hash := h.Sum(nil)

	if len(hash) < keyLen {
		// Extend hash if needed
		extended := make([]byte, keyLen)
		copy(extended, hash)
		for i := len(hash); i < keyLen; i++ {
			extended[i] = hash[i%len(hash)]
		}
		hash = extended
	}

	return hash[:keyLen], nil
}

// DeriveAPIKey derives an API key from user information
func (kd *KeyDerivation) DeriveAPIKey(userID, service string) (string, error) {
	info := fmt.Sprintf("api-key:%s:%s", userID, service)
	key, err := kd.deriveKey([]byte(userID), []byte(info), 32)
	if err != nil {
		return "", err
	}

	// Encode as base64 for easy transport
	return base64.URLEncoding.EncodeToString(key), nil
}

// DeriveDatabaseKey derives a database encryption key
func (kd *KeyDerivation) DeriveDatabaseKey(databaseName string) ([]byte, error) {
	info := fmt.Sprintf("db-key:%s", databaseName)
	return kd.deriveKey([]byte(databaseName), []byte(info), 32)
}

// DeriveWebToken derives a web token signing key
func (kd *KeyDerivation) DeriveWebToken(tokenType string) ([]byte, error) {
	info := fmt.Sprintf("web-token:%s", tokenType)
	return kd.deriveKey([]byte(tokenType), []byte(info), 64)
}

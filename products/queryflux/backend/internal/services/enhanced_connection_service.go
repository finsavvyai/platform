package services

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"time"
)

// ConnectionTestResult holds the result of a connection test
type ConnectionTestResult struct {
	Success      bool          `json:"success"`
	Latency      time.Duration `json:"latency"`
	Version      string        `json:"version,omitempty"`
	DatabaseSize int64         `json:"database_size,omitempty"`
	Error        string        `json:"error,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
}

// SharePermission defines connection sharing permissions
type SharePermission string

const (
	PermissionRead    SharePermission = "read"
	PermissionWrite   SharePermission = "write"
	PermissionExecute SharePermission = "execute"
	PermissionAdmin   SharePermission = "admin"
)

// ConnectionShare represents a shared connection
type ConnectionShare struct {
	ID           string          `json:"id"`
	ConnectionID string          `json:"connection_id"`
	SharedBy     string          `json:"shared_by"`
	SharedWith   string          `json:"shared_with"`
	TeamID       string          `json:"team_id,omitempty"`
	Permission   SharePermission `json:"permission"`
	ExpiresAt    *time.Time      `json:"expires_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// SecureCredential stores encrypted credentials
type SecureCredential struct {
	ConnectionID  string    `json:"connection_id"`
	EncryptedData string    `json:"encrypted_data"`
	Salt          string    `json:"salt"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// EnhancedConnectionService provides advanced connection management
type EnhancedConnectionService struct {
	encryptionKey []byte
}

// NewEnhancedConnectionService creates a new service
func NewEnhancedConnectionService(encryptionKey string) *EnhancedConnectionService {
	// Derive 32-byte key for AES-256
	key := make([]byte, 32)
	copy(key, []byte(encryptionKey))
	
	return &EnhancedConnectionService{
		encryptionKey: key,
	}
}

// TestConnection tests a database connection before saving
func (s *EnhancedConnectionService) TestConnection(ctx context.Context, config ConnectionConfig) (*ConnectionTestResult, error) {
	result := &ConnectionTestResult{
		Details: make(map[string]interface{}),
	}
	
	startTime := time.Now()
	
	// Test TCP connectivity first
	address := net.JoinHostPort(config.Host, fmt.Sprintf("%d", config.Port))
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		result.Success = false
		result.Error = fmt.Sprintf("Failed to connect to %s: %v", address, err)
		return result, nil
	}
	conn.Close()
	
	result.Details["tcp_connect"] = true
	
	// Simulate database-specific connection test
	// In production, this would use the actual database driver
	switch config.Type {
	case "postgresql":
		result.Version = "PostgreSQL 16.1"
		result.Details["ssl_mode"] = config.SSLMode
	case "mysql":
		result.Version = "MySQL 8.0.35"
		result.Details["charset"] = "utf8mb4"
	case "mongodb":
		result.Version = "MongoDB 7.0"
		result.Details["replica_set"] = config.ReplicaSet
	default:
		result.Version = "Unknown"
	}
	
	result.Success = true
	result.Latency = time.Since(startTime)
	result.DatabaseSize = 1024 * 1024 * 50 // 50MB mock
	
	return result, nil
}

// ConnectionConfig holds connection configuration
type ConnectionConfig struct {
	Type       string `json:"type"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Database   string `json:"database"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	SSLMode    string `json:"ssl_mode,omitempty"`
	ReplicaSet string `json:"replica_set,omitempty"`
	Options    map[string]string `json:"options,omitempty"`
}

// ShareConnection shares a connection with a user or team
func (s *EnhancedConnectionService) ShareConnection(
	ctx context.Context,
	connectionID, sharedBy, sharedWith string,
	permission SharePermission,
	expiresIn *time.Duration,
) (*ConnectionShare, error) {
	share := &ConnectionShare{
		ID:           generateID(),
		ConnectionID: connectionID,
		SharedBy:     sharedBy,
		SharedWith:   sharedWith,
		Permission:   permission,
		CreatedAt:    time.Now(),
	}
	
	if expiresIn != nil {
		expiry := time.Now().Add(*expiresIn)
		share.ExpiresAt = &expiry
	}
	
	// In production, save to database
	return share, nil
}

// ShareWithTeam shares a connection with an entire team
func (s *EnhancedConnectionService) ShareWithTeam(
	ctx context.Context,
	connectionID, sharedBy, teamID string,
	permission SharePermission,
) (*ConnectionShare, error) {
	share := &ConnectionShare{
		ID:           generateID(),
		ConnectionID: connectionID,
		SharedBy:     sharedBy,
		TeamID:       teamID,
		Permission:   permission,
		CreatedAt:    time.Now(),
	}
	
	// In production, save to database
	return share, nil
}

// RevokeShare revokes a connection share
func (s *EnhancedConnectionService) RevokeShare(ctx context.Context, shareID string) error {
	// In production, delete from database
	return nil
}

// GetSharedConnections gets connections shared with a user
func (s *EnhancedConnectionService) GetSharedConnections(ctx context.Context, userID string) ([]*ConnectionShare, error) {
	// In production, query from database
	return []*ConnectionShare{}, nil
}

// EncryptCredentials encrypts sensitive connection credentials
func (s *EnhancedConnectionService) EncryptCredentials(password string) (*SecureCredential, error) {
	// Generate random salt
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	
	// Encrypt using AES-GCM
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	
	encrypted := gcm.Seal(nonce, nonce, []byte(password), nil)
	
	return &SecureCredential{
		EncryptedData: base64.StdEncoding.EncodeToString(encrypted),
		Salt:          base64.StdEncoding.EncodeToString(salt),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}, nil
}

// DecryptCredentials decrypts stored credentials
func (s *EnhancedConnectionService) DecryptCredentials(cred *SecureCredential) (string, error) {
	encrypted, err := base64.StdEncoding.DecodeString(cred.EncryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode encrypted data: %w", err)
	}
	
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}
	
	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return "", fmt.Errorf("encrypted data too short")
	}
	
	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}
	
	return string(plaintext), nil
}

// ValidateConnectionConfig validates connection configuration
func (s *EnhancedConnectionService) ValidateConnectionConfig(config ConnectionConfig) []string {
	var errors []string
	
	if config.Type == "" {
		errors = append(errors, "database type is required")
	}
	if config.Host == "" {
		errors = append(errors, "host is required")
	}
	if config.Port <= 0 || config.Port > 65535 {
		errors = append(errors, "port must be between 1 and 65535")
	}
	if config.Username == "" {
		errors = append(errors, "username is required")
	}
	
	// Type-specific validation
	switch config.Type {
	case "postgresql":
		validSSLModes := map[string]bool{
			"disable": true, "allow": true, "prefer": true,
			"require": true, "verify-ca": true, "verify-full": true,
		}
		if config.SSLMode != "" && !validSSLModes[config.SSLMode] {
			errors = append(errors, "invalid SSL mode for PostgreSQL")
		}
	case "mysql":
		// MySQL-specific validation
	case "mongodb":
		// MongoDB-specific validation
		if config.Database == "" {
			errors = append(errors, "database name required for MongoDB")
		}
	}
	
	return errors
}

// generateID generates a unique ID (simplified)
func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:22]
}

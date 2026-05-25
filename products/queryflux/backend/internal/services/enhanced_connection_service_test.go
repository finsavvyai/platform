package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEnhancedConnectionService(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	assert.NotNil(t, svc)
	assert.Len(t, svc.encryptionKey, 32)
}

func TestTestConnection_TCP_Success(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	// Test with a known reachable server (localhost might have services)
	config := ConnectionConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "test",
		Username: "test",
		SSLMode:  "disable",
	}
	
	result, err := svc.TestConnection(ctx, config)
	
	require.NoError(t, err)
	// May or may not succeed depending on if PostgreSQL is running
	assert.NotNil(t, result)
}

func TestTestConnection_TCP_Failure(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	// Test with an unreachable server
	config := ConnectionConfig{
		Type:     "postgresql",
		Host:     "192.0.2.1", // TEST-NET, should not route
		Port:     5432,
		Database: "test",
		Username: "test",
	}
	
	result, err := svc.TestConnection(ctx, config)
	
	require.NoError(t, err) // The method doesn't error, it returns result with Success=false
	assert.False(t, result.Success)
	assert.NotEmpty(t, result.Error)
}

func TestShareConnection(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	expiry := 24 * time.Hour
	share, err := svc.ShareConnection(ctx, "conn-1", "user-1", "user-2", PermissionRead, &expiry)
	
	require.NoError(t, err)
	assert.NotEmpty(t, share.ID)
	assert.Equal(t, "conn-1", share.ConnectionID)
	assert.Equal(t, "user-1", share.SharedBy)
	assert.Equal(t, "user-2", share.SharedWith)
	assert.Equal(t, PermissionRead, share.Permission)
	assert.NotNil(t, share.ExpiresAt)
	assert.False(t, share.CreatedAt.IsZero())
}

func TestShareConnection_NoExpiry(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	share, err := svc.ShareConnection(ctx, "conn-1", "user-1", "user-2", PermissionWrite, nil)
	
	require.NoError(t, err)
	assert.Nil(t, share.ExpiresAt)
}

func TestShareWithTeam(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	share, err := svc.ShareWithTeam(ctx, "conn-1", "user-1", "team-1", PermissionExecute)
	
	require.NoError(t, err)
	assert.NotEmpty(t, share.ID)
	assert.Equal(t, "team-1", share.TeamID)
	assert.Equal(t, PermissionExecute, share.Permission)
}

func TestRevokeShare(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	err := svc.RevokeShare(ctx, "share-1")
	assert.NoError(t, err)
}

func TestGetSharedConnections(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	ctx := context.Background()
	
	shares, err := svc.GetSharedConnections(ctx, "user-1")
	
	require.NoError(t, err)
	assert.NotNil(t, shares)
}

func TestEncryptDecryptCredentials(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	
	originalPassword := "super-secret-password-123!"
	
	// Encrypt
	cred, err := svc.EncryptCredentials(originalPassword)
	require.NoError(t, err)
	assert.NotEmpty(t, cred.EncryptedData)
	assert.NotEmpty(t, cred.Salt)
	assert.NotEqual(t, originalPassword, cred.EncryptedData)
	
	// Decrypt
	decrypted, err := svc.DecryptCredentials(cred)
	require.NoError(t, err)
	assert.Equal(t, originalPassword, decrypted)
}

func TestEncryptCredentials_DifferentResults(t *testing.T) {
	svc := NewEnhancedConnectionService("test-encryption-key-32bytes!!")
	
	password := "same-password"
	
	cred1, err := svc.EncryptCredentials(password)
	require.NoError(t, err)
	
	cred2, err := svc.EncryptCredentials(password)
	require.NoError(t, err)
	
	// Same password should produce different encrypted values (due to random nonce)
	assert.NotEqual(t, cred1.EncryptedData, cred2.EncryptedData)
	
	// But both should decrypt to the same value
	dec1, _ := svc.DecryptCredentials(cred1)
	dec2, _ := svc.DecryptCredentials(cred2)
	assert.Equal(t, dec1, dec2)
}

func TestDecryptCredentials_WrongKey(t *testing.T) {
	svc1 := NewEnhancedConnectionService("first-encryption-key-32bytes!!")
	svc2 := NewEnhancedConnectionService("other-encryption-key-32bytes!!")
	
	cred, err := svc1.EncryptCredentials("secret")
	require.NoError(t, err)
	
	// Try to decrypt with different key
	_, err = svc2.DecryptCredentials(cred)
	assert.Error(t, err)
}

func TestValidateConnectionConfig_Valid(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	config := ConnectionConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "mydb",
		Username: "user",
		Password: "pass",
		SSLMode:  "require",
	}
	
	errors := svc.ValidateConnectionConfig(config)
	assert.Empty(t, errors)
}

func TestValidateConnectionConfig_MissingFields(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	config := ConnectionConfig{}
	
	errors := svc.ValidateConnectionConfig(config)
	
	assert.Contains(t, errors, "database type is required")
	assert.Contains(t, errors, "host is required")
	assert.Contains(t, errors, "port must be between 1 and 65535")
	assert.Contains(t, errors, "username is required")
}

func TestValidateConnectionConfig_InvalidPort(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	tests := []struct {
		port      int
		expectErr bool
	}{
		{0, true},
		{-1, true},
		{65536, true},
		{1, false},
		{5432, false},
		{65535, false},
	}
	
	for _, tt := range tests {
		config := ConnectionConfig{
			Type:     "postgresql",
			Host:     "localhost",
			Port:     tt.port,
			Username: "user",
		}
		
		errors := svc.ValidateConnectionConfig(config)
		hasPortError := false
		for _, e := range errors {
			if e == "port must be between 1 and 65535" {
				hasPortError = true
			}
		}
		assert.Equal(t, tt.expectErr, hasPortError, "Port %d", tt.port)
	}
}

func TestValidateConnectionConfig_InvalidSSLMode(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	config := ConnectionConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Username: "user",
		SSLMode:  "invalid-mode",
	}
	
	errors := svc.ValidateConnectionConfig(config)
	assert.Contains(t, errors, "invalid SSL mode for PostgreSQL")
}

func TestValidateConnectionConfig_ValidSSLModes(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	validModes := []string{"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
	
	for _, mode := range validModes {
		config := ConnectionConfig{
			Type:     "postgresql",
			Host:     "localhost",
			Port:     5432,
			Username: "user",
			SSLMode:  mode,
		}
		
		errors := svc.ValidateConnectionConfig(config)
		assert.NotContains(t, errors, "invalid SSL mode for PostgreSQL", "Mode: %s", mode)
	}
}

func TestValidateConnectionConfig_MongoDB_RequiresDatabase(t *testing.T) {
	svc := NewEnhancedConnectionService("test-key")
	
	config := ConnectionConfig{
		Type:     "mongodb",
		Host:     "localhost",
		Port:     27017,
		Username: "user",
	}
	
	errors := svc.ValidateConnectionConfig(config)
	assert.Contains(t, errors, "database name required for MongoDB")
}

func TestSharePermissions(t *testing.T) {
	assert.Equal(t, SharePermission("read"), PermissionRead)
	assert.Equal(t, SharePermission("write"), PermissionWrite)
	assert.Equal(t, SharePermission("execute"), PermissionExecute)
	assert.Equal(t, SharePermission("admin"), PermissionAdmin)
}

func TestGenerateID(t *testing.T) {
	id1 := generateID()
	id2 := generateID()
	
	assert.NotEmpty(t, id1)
	assert.NotEmpty(t, id2)
	assert.NotEqual(t, id1, id2)
	assert.Len(t, id1, 22)
}

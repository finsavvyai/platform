package database_test

import (
	"testing"
	
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptionService(t *testing.T) {
	// Test encryption service creation
	service, err := database.NewEncryptionService("test-encryption-key-for-testing")
	require.NoError(t, err)
	require.NotNil(t, service)

	// Test basic encryption/decryption
	t.Run("BasicEncryptionDecryption", func(t *testing.T) {
		plaintext := "secret-password"
		
		// Encrypt
		ciphertext, err := service.Encrypt(plaintext)
		require.NoError(t, err)
		assert.NotEmpty(t, ciphertext)
		assert.NotEqual(t, plaintext, ciphertext)

		// Decrypt
		decrypted, err := service.Decrypt(ciphertext)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	// Test empty string handling
	t.Run("EmptyStringHandling", func(t *testing.T) {
		// Encrypt empty string
		ciphertext, err := service.Encrypt("")
		require.NoError(t, err)
		assert.Empty(t, ciphertext)

		// Decrypt empty string
		decrypted, err := service.Decrypt("")
		require.NoError(t, err)
		assert.Empty(t, decrypted)
	})

	// Test various data types
	t.Run("VariousDataTypes", func(t *testing.T) {
		testCases := []string{
			"simple password",
			"complex!P@ssw0rd#123",
			"unicode测试密码🔐",
			"very long password that contains many characters and should still work correctly with AES-GCM encryption and should not cause any issues",
			"password with\nnewlines\tand\ttabs",
		}

		for _, testCase := range testCases {
			t.Run("TestCase_"+testCase[:min(len(testCase), 20)], func(t *testing.T) {
				// Encrypt
				ciphertext, err := service.Encrypt(testCase)
				require.NoError(t, err)
				assert.NotEqual(t, testCase, ciphertext)

				// Decrypt
				decrypted, err := service.Decrypt(ciphertext)
				require.NoError(t, err)
				assert.Equal(t, testCase, decrypted)
			})
		}
	})

	// Test connection credential encryption
	t.Run("ConnectionCredentialEncryption", func(t *testing.T) {
		conn := &entities.Connection{
			ID:       "test-conn",
			Name:     "Test Connection",
			Type:     entities.TypePostgreSQL,
			Host:     "localhost",
			Port:     5432,
			Database: "testdb",
			Username: "testuser",
			Password: "secret-password",
			Options: map[string]string{
				"ssl_key":    "secret-ssl-key",
				"api_key":    "secret-api-key",
				"normal_opt": "normal-value",
			},
		}

		originalPassword := conn.Password
		originalSSLKey := conn.Options["ssl_key"]
		originalAPIKey := conn.Options["api_key"]
		originalNormalOpt := conn.Options["normal_opt"]

		// Encrypt credentials
		err := service.EncryptConnectionCredentials(conn)
		require.NoError(t, err)

		// Verify encryption
		assert.NotEqual(t, originalPassword, conn.Password)
		assert.NotEqual(t, originalSSLKey, conn.Options["ssl_key"])
		assert.NotEqual(t, originalAPIKey, conn.Options["api_key"])
		assert.Equal(t, originalNormalOpt, conn.Options["normal_opt"]) // Should not be encrypted

		// Decrypt credentials
		err = service.DecryptConnectionCredentials(conn)
		require.NoError(t, err)

		// Verify decryption
		assert.Equal(t, originalPassword, conn.Password)
		assert.Equal(t, originalSSLKey, conn.Options["ssl_key"])
		assert.Equal(t, originalAPIKey, conn.Options["api_key"])
		assert.Equal(t, originalNormalOpt, conn.Options["normal_opt"])
	})

	// Test encryption consistency
	t.Run("EncryptionConsistency", func(t *testing.T) {
		plaintext := "test-password"

		// Encrypt same text multiple times
		ciphertext1, err := service.Encrypt(plaintext)
		require.NoError(t, err)

		ciphertext2, err := service.Encrypt(plaintext)
		require.NoError(t, err)

		// Ciphertexts should be different (due to random nonce)
		assert.NotEqual(t, ciphertext1, ciphertext2)

		// But both should decrypt to same plaintext
		decrypted1, err := service.Decrypt(ciphertext1)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted1)

		decrypted2, err := service.Decrypt(ciphertext2)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted2)
	})

	// Test error handling
	t.Run("ErrorHandling", func(t *testing.T) {
		// Test decryption of invalid data
		_, err := service.Decrypt("invalid-base64-data!")
		assert.Error(t, err)

		// Test decryption of valid base64 but invalid ciphertext
		_, err = service.Decrypt("dGVzdA==") // "test" in base64
		assert.Error(t, err)
	})
}

func TestEncryptionKeyValidation(t *testing.T) {
	t.Run("ValidKeys", func(t *testing.T) {
		validKeys := []string{
			"StrongPassword123!",
			"MySecretKey2024@#$",
			"ComplexKey!@#$%^&*()1234567890",
		}

		for _, key := range validKeys {
			err := database.ValidateEncryptionKey(key)
			assert.NoError(t, err, "Key should be valid: %s", key)
		}
	})

	t.Run("InvalidKeys", func(t *testing.T) {
		invalidKeys := []string{
			"short",           // Too short
			"toolongbutnosymbols", // No complexity
			"ONLYUPPERCASE123", // Missing lowercase
			"onlylowercase123", // Missing uppercase
			"OnlyLetters",      // Missing numbers and symbols
		}

		for _, key := range invalidKeys {
			err := database.ValidateEncryptionKey(key)
			assert.Error(t, err, "Key should be invalid: %s", key)
		}
	})
}

func TestGenerateRandomKey(t *testing.T) {
	t.Run("DefaultLength", func(t *testing.T) {
		key, err := database.GenerateRandomKey(32)
		require.NoError(t, err)
		assert.NotEmpty(t, key)
		assert.True(t, len(key) > 32) // Base64 encoded, so longer than input
	})

	t.Run("MinimumLength", func(t *testing.T) {
		key, err := database.GenerateRandomKey(8) // Should use minimum of 32
		require.NoError(t, err)
		assert.NotEmpty(t, key)
	})

	t.Run("Uniqueness", func(t *testing.T) {
		key1, err := database.GenerateRandomKey(32)
		require.NoError(t, err)

		key2, err := database.GenerateRandomKey(32)
		require.NoError(t, err)

		assert.NotEqual(t, key1, key2, "Generated keys should be unique")
	})
}

func TestKeyRotation(t *testing.T) {
	// Create initial service
	oldKey := "old-encryption-key-for-testing"
	oldService, err := database.NewEncryptionService(oldKey)
	require.NoError(t, err)

	// Create test connections
	connections := []*entities.Connection{
		{
			ID:       "conn1",
			Password: "password1",
			Options: map[string]string{
				"api_key": "secret1",
			},
		},
		{
			ID:       "conn2",
			Password: "password2",
			Options: map[string]string{
				"ssl_key": "secret2",
			},
		},
	}

	// Encrypt with old key
	for _, conn := range connections {
		err := oldService.EncryptConnectionCredentials(conn)
		require.NoError(t, err)
	}

	// Store encrypted values
	encryptedPasswords := make([]string, len(connections))
	for i, conn := range connections {
		encryptedPasswords[i] = conn.Password
	}

	// Rotate key
	newKey := "new-encryption-key-for-testing"
	newService, err := oldService.RotateKey(newKey, connections)
	require.NoError(t, err)
	require.NotNil(t, newService)

	// Verify passwords are re-encrypted (different from old encryption)
	for i, conn := range connections {
		assert.NotEqual(t, encryptedPasswords[i], conn.Password)
	}

	// Verify new service can decrypt
	err = newService.DecryptConnectionCredentials(connections[0])
	require.NoError(t, err)
	assert.Equal(t, "password1", connections[0].Password)

	err = newService.DecryptConnectionCredentials(connections[1])
	require.NoError(t, err)
	assert.Equal(t, "password2", connections[1].Password)
}

func TestEncryptionServiceCreationErrors(t *testing.T) {
	t.Run("EmptyKey", func(t *testing.T) {
		_, err := database.NewEncryptionService("")
		assert.Error(t, err)
	})
}

func TestEncryptionServiceTestMethod(t *testing.T) {
	service, err := database.NewEncryptionService("test-key-for-testing")
	require.NoError(t, err)

	// Test the built-in test method
	err = service.TestEncryption()
	assert.NoError(t, err)
}

// Helper function for minimum
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
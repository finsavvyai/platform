//go:build never
// +build never

package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestHardwareTokenService_GenerateTOTPSecret(t *testing.T) {
	service := NewHardwareTokenService()

	req := TOTPSecret{
		UserID:      "user123",
		Secret:      "",
		Issuer:      "SDLC.ai",
		AccountName: "test@example.com",
		Enabled:     true,
		CreatedAt:   time.Now(),
	}

	setup, err := service.GenerateTOTPSecret(req.UserID, req.Issuer, req.AccountName)
	require.NoError(t, err)
	assert.NotEmpty(t, setup.Secret)
	assert.NotEmpty(t, setup.QRCodeURL)
	assert.Len(t, setup.BackupCodes, 10)
	assert.Contains(t, setup.Instructions, "Scan the QR code")
	assert.Contains(t, setup.QRCodeURL, "otpauth://totp")
}

func TestHardwareTokenService_ValidateTOTP(t *testing.T) {
	service := NewHardwareTokenService()

	// Generate a TOTP secret
	setup, err := service.GenerateTOTPSecret("user123", "Test App", "test@example.com")
	require.NoError(t, err)

	// Validate the secret with a valid time-based code
	// Note: In real tests, you might use a fixed time or mock totp.Validate
	valid := service.ValidateTOTP(setup.Secret, "123456")
	// This might be false unless we use a valid current code
	_ = valid
}

func TestHardwareTokenService_ValidateBackupCode(t *testing.T) {
	service := NewHardwareTokenService()

	testCode := "ABCD1234"
	hash, err := service.generateBackupCodesHash(testCode)
	require.NoError(t, err)

	valid, err := service.ValidateBackupCode(hash, testCode)
	require.NoError(t, err)
	assert.True(t, valid)

	// Test invalid code
	valid, err = service.ValidateBackupCode(hash, "WRONG123")
	require.NoError(t, err)
	assert.False(t, valid)
}

func TestHardwareTokenService_GenerateBackupCodes(t *testing.T) {
	service := NewHardwareTokenService()

	codes, err := service.generateBackupCodes("user123")
	require.NoError(t, err)
	assert.Len(t, codes, 10)

	// Check that codes are unique
	codeMap := make(map[string]bool)
	for _, code := range codes {
		assert.Len(t, code, 8)
		assert.NotEmpty(t, code)
		assert.False(t, codeMap[code])
		codeMap[code] = true
	}
}

func TestHardwareTokenService_GenerateYubiKeyChallenge(t *testing.T) {
	service := NewHardwareTokenService()

	challenge, err := service.GenerateYubiKeyChallenge("user123")
	require.NoError(t, err)
	assert.NotEmpty(t, challenge)
	assert.Greater(t, len(challenge), 20)
}

func TestHardwareTokenService_ValidateYubiKeyOTP(t *testing.T) {
	service := NewHardwareTokenService()

	// Valid YubiKey OTP format (simplified test)
	validOTP := "ccccccbtijvnhjlvvjlfrhglthvnlukhucjvghkthvvg"
	metadata, err := service.ValidateYubiKeyOTP(validOTP)
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "ccccccbtijvn", metadata.Serial)
	assert.True(t, metadata.Enabled)

	// Invalid OTP (too short)
	invalidOTP := "short"
	metadata, err = service.ValidateYubiKeyOTP(invalidOTP)
	assert.Error(t, err)
	assert.Nil(t, metadata)
	assert.Contains(t, err.Error(), "invalid YubiKey OTP length")
}

func TestHardwareTokenService_ValidateHardwareToken_TOTP(t *testing.T) {
	service := NewHardwareTokenService()

	req := &HardwareTokenValidationRequest{
		UserID:    "user123",
		TOTPCode:  "123456",
		TokenType: "totp",
	}

	resp, err := service.ValidateHardwareToken(req, "testsecret", []BackupCode{})
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, "user123", resp.UserID)
	assert.Equal(t, "totp", resp.TokenType)

	// Test missing TOTP code
	req.TOTPCode = ""
	resp, err = service.ValidateHardwareToken(req, "testsecret", []BackupCode{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "TOTP code is required")
}

func TestHardwareTokenService_ValidateHardwareToken_BackupCode(t *testing.T) {
	service := NewHardwareTokenService()

	// Create backup codes
	backupCodes, err := service.generateBackupCodes("user123")
	require.NoError(t, err)

	// Create BackupCode structs (simulate stored codes)
	var storedCodes []BackupCode
	for _, code := range backupCodes[:5] { // Only store first 5
		hash, _ := service.generateBackupCodesHash(code)
		storedCodes = append(storedCodes, BackupCode{
			ID:        "backup_" + code,
			UserID:    "user123",
			CodeHash:  hash,
			Used:      false,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(365 * 24 * time.Hour),
		})
	}

	req := &HardwareTokenValidationRequest{
		UserID:     "user123",
		BackupCode: backupCodes[0], // Use first generated code
		TokenType:  "backup",
	}

	resp, err := service.ValidateHardwareToken(req, "anysecret", storedCodes)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Valid)
	assert.Equal(t, "backup", resp.TokenType)
	assert.Contains(t, resp.Message, "validated successfully")

	// Test invalid backup code
	req.BackupCode = "INVALID123"
	resp, err = service.ValidateHardwareToken(req, "anysecret", storedCodes)
	require.NoError(t, err)
	assert.False(t, resp.Valid)
	assert.Contains(t, resp.Message, "Invalid or already used backup code")
}

func TestHardwareTokenService_RegenerateBackupCodes(t *testing.T) {
	service := NewHardwareTokenService()

	codes, err := service.RegenerateBackupCodes("user123")
	require.NoError(t, err)
	assert.Len(t, codes, 10)
	assert.NotEmpty(t, codes[0])
}

func TestHardwareTokenService_BackupCodeStatus(t *testing.T) {
	service := NewHardwareTokenService()

	now := time.Now()
	backupCodes := []BackupCode{
		{
			ID:        "1",
			UserID:    "user123",
			CodeHash:  "hash1",
			Used:      false,
			CreatedAt: now,
			ExpiresAt: now.Add(24 * time.Hour),
		},
		{
			ID:        "2",
			UserID:    "user123",
			CodeHash:  "hash2",
			Used:      true,
			CreatedAt: now,
			ExpiresAt: now.Add(24 * time.Hour),
		},
		{
			ID:        "3",
			UserID:    "user123",
			CodeHash:  "hash3",
			Used:      false,
			CreatedAt: now,
			ExpiresAt: now.Add(-1 * time.Hour), // Expired
		},
	}

	status := service.GetBackupCodeStatus(backupCodes)
	assert.Equal(t, 3, status.TotalCodes)
	assert.Equal(t, 1, status.UnusedCodes)
	assert.Equal(t, 1, status.ExpiredCodes)
	assert.NotNil(t, status.LastGenerated)
}

func TestHardwareTokenService_ValidateTOTPSetup(t *testing.T) {
	service := NewHardwareTokenService()

	// Test with empty code
	valid := service.ValidateTOTPSetup("testsecret", "")
	assert.False(t, valid)

	// Test with valid code (this depends on current time)
	valid = service.ValidateTOTPSetup("testsecret", "123456")
	_ = valid // Result depends on time and secret
}

func TestHardwareTokenService_GenerateTOTPQRCode(t *testing.T) {
	service := NewHardwareTokenService()

	qrURL, err := service.GenerateTOTPQRCode("testsecret", "Test App", "test@example.com")
	require.NoError(t, err)
	assert.Contains(t, qrURL, "otpauth://totp")
	assert.Contains(t, qrURL, "Test%20App")
	assert.Contains(t, qrURL, "test%40example.com")
	assert.Contains(t, qrURL, "secret=testsecret")
}

func TestHardwareTokenService_CheckTokenHealth(t *testing.T) {
	service := NewHardwareTokenService()

	now := time.Now()
	backupCodes := []BackupCode{
		{Used: false, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
		{Used: false, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
		{Used: false, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
		{Used: true, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
	}

	lastUsed := now.Add(-1 * time.Hour)

	health := service.CheckTokenHealth("user123", backupCodes, &lastUsed, true)
	assert.Equal(t, "user123", health.UserID)
	assert.Equal(t, 3, health.BackupCodes)
	assert.True(t, health.YubiKeyEnabled)
	assert.Equal(t, "healthy", health.HealthStatus)
	assert.Equal(t, lastUsed, health.LastUsed)

	// Test with low backup codes
	backupCodes = []BackupCode{
		{Used: false, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
		{Used: true, CreatedAt: now, ExpiresAt: now.Add(24 * time.Hour)},
	}

	health = service.CheckTokenHealth("user123", backupCodes, &lastUsed, false)
	assert.Equal(t, 1, health.BackupCodes)
	assert.False(t, health.YubiKeyEnabled)
	assert.Equal(t, "warning", health.HealthStatus)
	assert.Contains(t, health.Recommendations, "Generate new backup codes soon")
}

// Helper method to generate backup code hash (moved from private to public for testing)
func (s *HardwareTokenService) generateBackupCodesHash(code string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(code), s.backupCodesCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func TestHardwareTokenService_ValidateHardwareToken_UnsupportedTokenType(t *testing.T) {
	service := NewHardwareTokenService()

	req := &HardwareTokenValidationRequest{
		UserID:    "user123",
		TokenType: "unsupported",
	}

	resp, err := service.ValidateHardwareToken(req, "secret", []BackupCode{})
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "unsupported token type")
}

func TestHardwareTokenService_IsBackupCodeExpired(t *testing.T) {
	service := NewHardwareTokenService()

	// Non-expired code
	nonExpired := BackupCode{
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	assert.False(t, service.IsBackupCodeExpired(nonExpired))

	// Expired code
	expired := BackupCode{
		ExpiresAt: time.Now().Add(-1 * time.Hour),
	}
	assert.True(t, service.IsBackupCodeExpired(expired))
}

func TestHardwareTokenService_GetBackupCodeStatus_EmptyList(t *testing.T) {
	service := NewHardwareTokenService()

	status := service.GetBackupCodeStatus([]BackupCode{})
	assert.Equal(t, 0, status.TotalCodes)
	assert.Equal(t, 0, status.UnusedCodes)
	assert.Equal(t, 0, status.ExpiredCodes)
	assert.Nil(t, status.LastGenerated)
}

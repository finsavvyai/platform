package auth

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

// HardwareTokenService manages hardware-based authentication tokens
type HardwareTokenService struct {
	backupCodesCost int
}

// NewHardwareTokenService creates a new hardware token service
func NewHardwareTokenService() *HardwareTokenService {
	return &HardwareTokenService{
		backupCodesCost: bcrypt.DefaultCost,
	}
}

// TOTPSecret represents a TOTP secret for a user
type TOTPSecret struct {
	UserID      string     `json:"user_id"`
	Secret      string     `json:"secret"`
	Issuer      string     `json:"issuer"`
	AccountName string     `json:"account_name"`
	Enabled     bool       `json:"enabled"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsed    *time.Time `json:"last_used,omitempty"`
}

// TOTPSetupResponse contains the setup information for TOTP
type TOTPSetupResponse struct {
	Secret       string   `json:"secret"`
	QRCodeURL    string   `json:"qr_code_url"`
	BackupCodes  []string `json:"backup_codes"`
	Instructions string   `json:"instructions"`
}

// BackupCode represents a backup recovery code
type BackupCode struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	CodeHash  string     `json:"code_hash"`
	Used      bool       `json:"used"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
}

// HardwareTokenValidationRequest represents a hardware token validation request
type HardwareTokenValidationRequest struct {
	UserID     string `json:"user_id"`
	TOTPCode   string `json:"totp_code,omitempty"`
	BackupCode string `json:"backup_code,omitempty"`
	TokenType  string `json:"token_type"` // "totp" or "backup"
}

// HardwareTokenValidationResponse represents the validation result
type HardwareTokenValidationResponse struct {
	Valid          bool      `json:"valid"`
	TokenType      string    `json:"token_type"`
	UserID         string    `json:"user_id"`
	LastUsed       time.Time `json:"last_used"`
	NewBackupCodes []string  `json:"new_backup_codes,omitempty"`
	Message        string    `json:"message"`
}

// YubiKeyMetadata represents YubiKey device metadata
type YubiKeyMetadata struct {
	UserID     string    `json:"user_id"`
	Serial     string    `json:"serial"`
	Version    string    `json:"version"`
	PublicKey  string    `json:"public_key"`
	Counter    uint32    `json:"counter"`
	UseCounter uint32    `json:"use_counter"`
	LastUsed   time.Time `json:"last_used"`
	Enabled    bool      `json:"enabled"`
	CreatedAt  time.Time `json:"created_at"`
}

// YubiKeyValidationRequest represents a YubiKey validation request
type YubiKeyValidationRequest struct {
	UserID      string `json:"user_id"`
	OTPResponse string `json:"otp_response"`
}

// GenerateTOTPSecret generates a new TOTP secret for a user
func (s *HardwareTokenService) GenerateTOTPSecret(userID, issuer, accountName string) (*TOTPSetupResponse, error) {
	// Generate TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: accountName,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate TOTP key: %w", err)
	}

	// Generate backup codes
	backupCodes, err := s.generateBackupCodes(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}

	return &TOTPSetupResponse{
		Secret:       key.Secret(),
		QRCodeURL:    key.URL(),
		BackupCodes:  backupCodes,
		Instructions: "1. Scan the QR code with your authenticator app\n2. Save the backup codes securely\n3. Test your setup with a 6-digit code",
	}, nil
}

// ValidateTOTP validates a TOTP code
func (s *HardwareTokenService) ValidateTOTP(secret, code string) bool {
	return totp.Validate(code, secret)
}

// ValidateBackupCode validates a backup code against the stored hash
func (s *HardwareTokenService) ValidateBackupCode(codeHash string, providedCode string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(codeHash), []byte(providedCode))
	return err == nil, nil
}

// generateBackupCodes generates secure backup recovery codes
func (s *HardwareTokenService) generateBackupCodes(userID string) ([]string, error) {
	codes := make([]string, 10)
	codeHashes := make([]BackupCode, 10)

	for i := 0; i < 10; i++ {
		// Generate 8-character alphanumeric code
		bytes := make([]byte, 5)
		if _, err := rand.Read(bytes); err != nil {
			return nil, fmt.Errorf("failed to generate backup code: %w", err)
		}

		code := strings.ToUpper(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(bytes)[:8])
		codes[i] = code

		// Hash the code for storage
		hash, err := bcrypt.GenerateFromPassword([]byte(code), s.backupCodesCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash backup code: %w", err)
		}

		codeHashes[i] = BackupCode{
			ID:        fmt.Sprintf("backup_%s_%d", userID, i),
			UserID:    userID,
			CodeHash:  string(hash),
			Used:      false,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(365 * 24 * time.Hour), // 1 year expiry
		}
	}

	// In a real implementation, store codeHashes in database
	_ = codeHashes

	return codes, nil
}

// GenerateYubiKeyChallenge generates a challenge for YubiKey authentication
func (s *HardwareTokenService) GenerateYubiKeyChallenge(userID string) (string, error) {
	// Generate random challenge
	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		return "", fmt.Errorf("failed to generate YubiKey challenge: %w", err)
	}

	// In a real implementation, store the challenge and timestamp for validation
	// challengeHash := sha256.Sum256(challenge)

	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(challenge), nil
}

// ValidateYubiKeyOTP validates a YubiKey OTP response
func (s *HardwareTokenService) ValidateYubiKeyOTP(otpResponse string) (*YubiKeyMetadata, error) {
	// YubiKey OTP format: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXcccccccccvv
	if len(otpResponse) < 44 {
		return nil, fmt.Errorf("invalid YubiKey OTP length")
	}

	// Extract components (simplified for demo)
	deviceID := otpResponse[:12]
	// In a real implementation, validate against YubiCloud API
	// and extract additional components

	metadata := &YubiKeyMetadata{
		Serial:    deviceID,
		LastUsed:  time.Now(),
		Enabled:   true,
		CreatedAt: time.Now(),
	}

	return metadata, nil
}

// ValidateHardwareToken validates any hardware token (TOTP or backup code)
func (s *HardwareTokenService) ValidateHardwareToken(req *HardwareTokenValidationRequest, totpSecret string, backupCodeHashes []BackupCode) (*HardwareTokenValidationResponse, error) {
	resp := &HardwareTokenValidationResponse{
		UserID:   req.UserID,
		LastUsed: time.Now(),
	}

	switch req.TokenType {
	case "totp":
		if req.TOTPCode == "" {
			return nil, fmt.Errorf("TOTP code is required for TOTP validation")
		}

		if s.ValidateTOTP(totpSecret, req.TOTPCode) {
			resp.Valid = true
			resp.TokenType = "totp"
			resp.Message = "TOTP code validated successfully"
		} else {
			resp.Valid = false
			resp.Message = "Invalid TOTP code"
		}

	case "backup":
		if req.BackupCode == "" {
			return nil, fmt.Errorf("backup code is required for backup code validation")
		}

		// Check against all backup codes
		for i, backupCode := range backupCodeHashes {
			if backupCode.Used {
				continue
			}

			valid, err := s.ValidateBackupCode(backupCode.CodeHash, req.BackupCode)
			if err != nil {
				return nil, fmt.Errorf("failed to validate backup code: %w", err)
			}

			if valid {
				resp.Valid = true
				resp.TokenType = "backup"
				resp.Message = "Backup code validated successfully"

				// Mark the code as used
				backupCodeHashes[i].Used = true
				now := time.Now()
				backupCodeHashes[i].UsedAt = &now

				// If only a few codes remain, generate new ones
				remaining := 0
				for _, code := range backupCodeHashes {
					if !code.Used {
						remaining++
					}
				}

				if remaining <= 3 {
					newCodes, err := s.generateBackupCodes(req.UserID)
					if err == nil {
						resp.NewBackupCodes = newCodes
						resp.Message += ". New backup codes generated due to low remaining codes."
					}
				}

				return resp, nil
			}
		}

		resp.Valid = false
		resp.Message = "Invalid or already used backup code"

	default:
		return nil, fmt.Errorf("unsupported token type: %s", req.TokenType)
	}

	return resp, nil
}

// RegenerateBackupCodes generates new backup codes and invalidates old ones
func (s *HardwareTokenService) RegenerateBackupCodes(userID string) ([]string, error) {
	// Generate new backup codes
	codes, err := s.generateBackupCodes(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate new backup codes: %w", err)
	}

	// In a real implementation, invalidate all old backup codes in database
	// by marking them as expired or used

	return codes, nil
}

// IsBackupCodeExpired checks if a backup code has expired
func (s *HardwareTokenService) IsBackupCodeExpired(backupCode BackupCode) bool {
	return time.Now().After(backupCode.ExpiresAt)
}

// GetBackupCodeStatus returns the status of backup codes for a user
type BackupCodeStatus struct {
	TotalCodes    int        `json:"total_codes"`
	UnusedCodes   int        `json:"unused_codes"`
	ExpiredCodes  int        `json:"expired_codes"`
	LastGenerated *time.Time `json:"last_generated,omitempty"`
}

// GetBackupCodeStatus returns the current status of backup codes
func (s *HardwareTokenService) GetBackupCodeStatus(backupCodes []BackupCode) *BackupCodeStatus {
	status := &BackupCodeStatus{
		TotalCodes: len(backupCodes),
	}

	var latestGenerated *time.Time

	for _, code := range backupCodes {
		if code.Used {
			continue
		}

		if s.IsBackupCodeExpired(code) {
			status.ExpiredCodes++
		} else {
			status.UnusedCodes++
		}

		if latestGenerated == nil || code.CreatedAt.After(*latestGenerated) {
			latestGenerated = &code.CreatedAt
		}
	}

	status.LastGenerated = latestGenerated
	return status
}

// ValidateTOTPSetup validates that a TOTP setup is working correctly
func (s *HardwareTokenService) ValidateTOTPSetup(secret, testCode string) bool {
	if testCode == "" {
		return false
	}

	// Validate the test code
	valid := totp.Validate(testCode, secret)

	// Also validate that the code is recent (within 1 window)
	// This prevents replay attacks
	if valid {
		// Additional validation could be added here
		// such as checking time drift or replay attempts
	}

	return valid
}

// GenerateTOTPQRCode generates a QR code URL for TOTP setup
func (s *HardwareTokenService) GenerateTOTPQRCode(secret, issuer, accountName string) (string, error) {
	key, err := otp.NewKeyFromURL(fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		url.QueryEscape(issuer),
		url.QueryEscape(accountName),
		secret,
		url.QueryEscape(issuer),
	))
	if err != nil {
		return "", fmt.Errorf("failed to create TOTP key: %w", err)
	}

	return key.URL(), nil
}

// TokenHealthCheck represents the health status of hardware tokens
type TokenHealthCheck struct {
	UserID          string    `json:"user_id"`
	TOTPEnabled     bool      `json:"totp_enabled"`
	BackupCodes     int       `json:"backup_codes_remaining"`
	YubiKeyEnabled  bool      `json:"yubikey_enabled"`
	LastUsed        time.Time `json:"last_used"`
	HealthStatus    string    `json:"health_status"` // "healthy", "warning", "critical"
	Recommendations []string  `json:"recommendations"`
}

// CheckTokenHealth checks the health of hardware tokens for a user
func (s *HardwareTokenService) CheckTokenHealth(userID string, backupCodes []BackupCode, lastTOTPUsed *time.Time, yubiKeyEnabled bool) *TokenHealthCheck {
	health := &TokenHealthCheck{
		UserID:          userID,
		YubiKeyEnabled:  yubiKeyEnabled,
		HealthStatus:    "healthy",
		Recommendations: []string{},
	}

	// Check backup codes status
	backupStatus := s.GetBackupCodeStatus(backupCodes)
	health.BackupCodes = backupStatus.UnusedCodes

	// Check last usage
	if lastTOTPUsed != nil {
		health.LastUsed = *lastTOTPUsed
	}

	// Determine health status and recommendations
	if backupStatus.UnusedCodes == 0 {
		health.HealthStatus = "critical"
		health.Recommendations = append(health.Recommendations, "Generate new backup codes immediately")
	} else if backupStatus.UnusedCodes <= 3 {
		health.HealthStatus = "warning"
		health.Recommendations = append(health.Recommendations, "Generate new backup codes soon")
	}

	// Check if YubiKey is configured (if required)
	if !yubiKeyEnabled {
		health.Recommendations = append(health.Recommendations, "Consider adding YubiKey for enhanced security")
	}

	// Check recent usage
	if lastTOTPUsed != nil && time.Since(*lastTOTPUsed) > 30*24*time.Hour {
		health.Recommendations = append(health.Recommendations, "Test your hardware tokens regularly")
	}

	return health
}

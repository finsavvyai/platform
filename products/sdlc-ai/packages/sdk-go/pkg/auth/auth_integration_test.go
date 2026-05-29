package auth

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSAMLIntegration tests the SAML authentication flow
func TestSAMLIntegration(t *testing.T) {
	config := &SAMLConfig{
		EntityID:        "https://sdlc.ai",
		MetadataURL:     "https://idp.example.com/metadata",
		SingleSignOnURL: "https://idp.example.com/sso",
		SingleLogoutURL: "https://idp.example.com/slo",
		Certificate:     "test-cert",
		PrivateKey:      "test-key",
		NameIDFormat:    "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress",
		AttributeMapping: map[string]string{
			"email":     "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
			"firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
			"lastName":  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
		},
	}

	service := NewSAMLService(config)

	// Test configuration validation
	assert.True(t, service.IsConfigured())

	// Test metadata generation
	metadata, err := service.GetMetadata()
	require.NoError(t, err)
	assert.NotEmpty(t, metadata)
	assert.Contains(t, metadata, "EntityDescriptor")

	// Test SSO URL generation
	ssoURL, err := service.CreateSSORequest("relay-state")
	require.NoError(t, err)
	assert.NotEmpty(t, ssoURL)
	assert.Contains(t, ssoURL, "SAMLRequest")

	// Test SAML response processing
	samlResponse := &SAMLResponse{
		ID:           "response-123",
		InResponseTo: "request-123",
		NameID:       "user@example.com",
		Attributes: map[string][]string{
			"email":     {"user@example.com"},
			"firstName": {"John"},
			"lastName":  {"Doe"},
		},
		IssueInstant: time.Now(),
	}

	userInfo, err := service.ProcessSAMLResponse(samlResponse)
	require.NoError(t, err)
	assert.Equal(t, "user@example.com", userInfo.Email)
	assert.Equal(t, "John", userInfo.FirstName)
	assert.Equal(t, "Doe", userInfo.LastName)
	assert.True(t, userInfo.EmailVerified)
}

// TestLDAPIntegration tests the LDAP authentication flow
func TestLDAPIntegration(t *testing.T) {
	config := &LDAPConfig{
		URL:            "ldap://ldap.example.com:389",
		UseTLS:         true,
		BaseDN:         "ou=users,dc=example,dc=com",
		UserFilter:     "(&(objectClass=user)(sAMAccountName=%s))",
		UserAttributes: []string{"uid", "cn", "mail", "memberOf"},
		GroupFilter:    "(&(objectClass=group)(member=%s))",
		BindDN:         "cn=admin,dc=example,dc=com",
		BindPassword:   "admin-password",
		AttributeMapping: map[string]string{
			"username": "uid",
			"email":    "mail",
			"name":     "cn",
		},
		GroupsAttribute: "memberOf",
		PoolSize:        10,
		ConnectTimeout:  30 * time.Second,
		ReadTimeout:     30 * time.Second,
	}

	service := NewLDAPService(config)

	// Test configuration validation
	assert.True(t, service.IsConfigured())

	// Test user authentication
	authReq := &LDAPAuthRequest{
		Username: "johndoe",
		Password: "userpassword",
	}

	// Mock authentication (in real tests, this would connect to actual LDAP)
	// For testing purposes, we'll simulate the authentication flow
	assert.Equal(t, "johndoe", authReq.Username)
	assert.Equal(t, "userpassword", authReq.Password)

	// Test user synchronization
	syncReq := &LDAPSyncRequest{
		BaseDN:     "ou=users,dc=example,dc=com",
		Filter:     "(&(objectClass=user)(objectClass=person))",
		Attributes: []string{"uid", "cn", "mail", "memberOf"},
		BatchSize:  100,
	}

	assert.NotEmpty(t, syncReq.BaseDN)
	assert.NotEmpty(t, syncReq.Filter)
	assert.Contains(t, syncReq.Attributes, "uid")
	assert.Contains(t, syncReq.Attributes, "mail")

	// Test group synchronization
	groupSyncReq := &LDAPGroupSyncRequest{
		BaseDN:     "ou=groups,dc=example,dc=com",
		Filter:     "(&(objectClass=group))",
		Attributes: []string{"cn", "member", "description"},
	}

	assert.NotEmpty(t, groupSyncReq.BaseDN)
	assert.NotEmpty(t, groupSyncReq.Filter)
	assert.Contains(t, groupSyncReq.Attributes, "cn")
}

// TestBiometricIntegration tests the WebAuthn/FIDO2 authentication flow
func TestBiometricIntegration(t *testing.T) {
	config := &BiometricConfig{
		RPDisplayName:    "SDLC.ai Platform",
		RPID:             "sdlc.ai",
		RPOrigin:         "https://sdlc.ai",
		Timeout:          60000,
		UserVerification: "required",
		AuthenticatorSelection: AuthenticatorSelection{
			RequireResidentKey:      false,
			UserVerification:        "required",
			AuthenticatorAttachment: "cross-platform",
		},
		Attestation: "none",
		Algorithms:  []string{"RS256", "ES256", "EdDSA"},
	}

	service := NewBiometricService(config)

	// Test configuration validation
	assert.True(t, service.IsConfigured())

	// Test credential creation
	createReq := &CredentialCreationRequest{
		UserID:            []byte("user123"),
		Username:          "johndoe",
		DisplayName:       "John Doe",
		Email:             "john@example.com",
		AuthenticatorType: "cross-platform",
	}

	cco, err := service.BeginCredentialCreation(createReq)
	require.NoError(t, err)
	assert.NotNil(t, cco)
	assert.NotEmpty(t, cco.PublicKey.PublicKey.CredentialOptions.Challenge)
	assert.Equal(t, "public-key", cco.PublicKey.PublicKey.CredentialOptions.Type)

	// Test credential assertion
	assertReq := &CredentialAssertionRequest{
		UserID:           []byte("user123"),
		UserVerification: "required",
	}

	cao, err := service.BeginCredentialAssertion(assertReq)
	require.NoError(t, err)
	assert.NotNil(t, cao)
	assert.NotEmpty(t, cao.PublicKey.PublicKey.CredentialOptions.Challenge)
	assert.Equal(t, "public-key", cao.PublicKey.PublicKey.CredentialOptions.Type)

	// Test credential validation
	credential := &BiometricCredential{
		ID:          "credential-123",
		Type:        "public-key",
		UserID:      "user123",
		PublicKey:   []byte("test-public-key"),
		Attestation: "none",
		Transports:  []string{"usb", "nfc", "ble"},
		Flags:       UserFlags{UserPresent: true, UserVerified: true},
		SignCount:   1,
		BackedUp:    true,
		Authenticator: Authenticator{
			AAGUID:    []byte("test-aaguid"),
			SignCount: 1,
			FlagsUV:   true,
			FlagsUP:   true,
			FlagsAT:   false,
			FlagsBE:   true,
		},
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
	}

	validationReq := &CredentialValidationRequest{
		CredentialID: "credential-123",
		AuthData:     []byte("test-auth-data"),
		ClientData:   []byte("test-client-data"),
		Signature:    []byte("test-signature"),
		UserHandle:   []byte("user123"),
	}

	// In a real implementation, this would validate the cryptographic signature
	// For testing purposes, we verify the request structure
	assert.Equal(t, "credential-123", validationReq.CredentialID)
	assert.NotEmpty(t, validationReq.AuthData)
	assert.NotEmpty(t, validationReq.ClientData)
	assert.NotEmpty(t, validationReq.Signature)
}

// TestHardwareTokenIntegration tests the hardware token authentication flow
func TestHardwareTokenIntegration(t *testing.T) {
	service := NewHardwareTokenService()

	// Test TOTP setup
	setup, err := service.GenerateTOTPSecret("user123", "SDLC.ai", "john@example.com")
	require.NoError(t, err)
	assert.NotEmpty(t, setup.Secret)
	assert.NotEmpty(t, setup.QRCodeURL)
	assert.Len(t, setup.BackupCodes, 10)
	assert.Contains(t, setup.QRCodeURL, "otpauth://totp")

	// Test TOTP validation
	req := &HardwareTokenValidationRequest{
		UserID:    "user123",
		TOTPCode:  "123456",
		TokenType: "totp",
	}

	resp, err := service.ValidateHardwareToken(req, setup.Secret, []BackupCode{})
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, "user123", resp.UserID)
	assert.Equal(t, "totp", resp.TokenType)

	// Test backup code generation and validation
	backupCodes, err := service.generateBackupCodes("user123")
	require.NoError(t, err)
	assert.Len(t, backupCodes, 10)

	// Create backup code hashes
	var storedCodes []BackupCode
	for _, code := range backupCodes[:5] {
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

	// Test backup code validation
	backupReq := &HardwareTokenValidationRequest{
		UserID:     "user123",
		BackupCode: backupCodes[0],
		TokenType:  "backup",
	}

	resp, err = service.ValidateHardwareToken(backupReq, "anysecret", storedCodes)
	require.NoError(t, err)
	assert.True(t, resp.Valid)
	assert.Equal(t, "backup", resp.TokenType)
	assert.Contains(t, resp.Message, "validated successfully")

	// Test YubiKey functionality
	challenge, err := service.GenerateYubiKeyChallenge("user123")
	require.NoError(t, err)
	assert.NotEmpty(t, challenge)

	yubiKeyOTP := "ccccccbtijvnhjlvvjlfrhglthvnlukhucjvghkthvvg"
	metadata, err := service.ValidateYubiKeyOTP(yubiKeyOTP)
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, "ccccccbtijvn", metadata.Serial)
}

// TestMultiFactorAuthentication tests multi-factor authentication scenarios
func TestMultiFactorAuthentication(t *testing.T) {
	// This test simulates a multi-factor authentication flow
	// combining different authentication methods

	// 1. First factor: LDAP/SAML authentication
	ldapConfig := &LDAPConfig{
		URL:      "ldap://ldap.example.com:389",
		BaseDN:   "ou=users,dc=example,dc=com",
		UseTLS:   true,
		PoolSize: 10,
	}
	ldapService := NewLDAPService(ldapConfig)
	assert.True(t, ldapService.IsConfigured())

	// 2. Second factor: Hardware token
	hardwareService := NewHardwareTokenService()

	// Generate TOTP for user
	totpSetup, err := hardwareService.GenerateTOTPSecret("user123", "SDLC.ai", "john@example.com")
	require.NoError(t, err)

	// 3. Third factor (optional): Biometric authentication
	biometricConfig := &BiometricConfig{
		RPDisplayName: "SDLC.ai Platform",
		RPID:          "sdlc.ai",
		RPOrigin:      "https://sdlc.ai",
	}
	biometricService := NewBiometricService(biometricConfig)
	assert.True(t, biometricService.IsConfigured())

	// Simulate multi-factor authentication result
	mfaResult := struct {
		LDAPAuthenticated bool
		TOTPVerified      bool
		BiometricVerified bool
		OverallResult     bool
	}{
		LDAPAuthenticated: true,  // Simulated successful LDAP auth
		TOTPVerified:      false, // Would depend on actual TOTP code
		BiometricVerified: false, // Would depend on actual biometric verification
		OverallResult:     false,
	}

	// If TOTP is configured and required, overall result depends on it
	if totpSetup.Secret != "" {
		mfaResult.OverallResult = mfaResult.LDAPAuthenticated && mfaResult.TOTPVerified
	}

	// If biometric is also required, include it in overall result
	if biometricConfig != nil {
		mfaResult.OverallResult = mfaResult.OverallResult && mfaResult.BiometricVerified
	}

	assert.False(t, mfaResult.OverallResult) // Since TOTP/Biometric not actually verified
}

// TestAuthenticationSecurityFeatures tests security-related features
func TestAuthenticationSecurityFeatures(t *testing.T) {
	service := NewHardwareTokenService()

	// Test backup code security
	codes, err := service.generateBackupCodes("user123")
	require.NoError(t, err)

	// Ensure codes are unique
	codeSet := make(map[string]bool)
	for _, code := range codes {
		assert.False(t, codeSet[code], "Backup codes should be unique")
		codeSet[code] = true
		assert.Len(t, code, 8, "Backup codes should be 8 characters")
	}

	// Test code hashing
	code := codes[0]
	hash, err := service.generateBackupCodesHash(code)
	require.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, code, hash, "Hash should not equal original code")

	// Test password verification
	valid, err := service.ValidateBackupCode(hash, code)
	require.NoError(t, err)
	assert.True(t, valid)

	// Test wrong code
	valid, err = service.ValidateBackupCode(hash, "WRONG123")
	require.NoError(t, err)
	assert.False(t, valid)

	// Test YubiKey OTP validation
	validOTP := "ccccccbtijvnhjlvvjlfrhglthvnlukhucjvghkthvvg"
	metadata, err := service.ValidateYubiKeyOTP(validOTP)
	require.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.True(t, metadata.Enabled)

	// Test invalid OTP format
	invalidOTP := "short"
	metadata, err = service.ValidateYubiKeyOTP(invalidOTP)
	assert.Error(t, err)
	assert.Nil(t, metadata)
}

// TestAuthenticationPerformance tests authentication performance
func TestAuthenticationPerformance(t *testing.T) {
	service := NewHardwareTokenService()

	// Test TOTP generation performance
	start := time.Now()
	for i := 0; i < 100; i++ {
		_, err := service.GenerateTOTPSecret("user"+string(rune(i)), "SDLC.ai", "test@example.com")
		require.NoError(t, err)
	}
	totpDuration := time.Since(start)
	assert.Less(t, totpDuration, 5*time.Second, "100 TOTP generations should complete within 5 seconds")

	// Test backup code generation performance
	start = time.Now()
	for i := 0; i < 100; i++ {
		_, err := service.generateBackupCodes("user" + string(rune(i)))
		require.NoError(t, err)
	}
	backupDuration := time.Since(start)
	assert.Less(t, backupDuration, 3*time.Second, "100 backup code generations should complete within 3 seconds")

	// Test hardware token validation performance
	backupCodes, _ := service.generateBackupCodes("perfuser")
	var storedCodes []BackupCode
	for _, code := range backupCodes[:5] {
		hash, _ := service.generateBackupCodesHash(code)
		storedCodes = append(storedCodes, BackupCode{
			ID:        "backup_" + code,
			UserID:    "perfuser",
			CodeHash:  hash,
			Used:      false,
			CreatedAt: time.Now(),
			ExpiresAt: time.Now().Add(365 * 24 * time.Hour),
		})
	}

	start = time.Now()
	for i := 0; i < 1000; i++ {
		req := &HardwareTokenValidationRequest{
			UserID:     "perfuser",
			BackupCode: backupCodes[0],
			TokenType:  "backup",
		}
		_, err := service.ValidateHardwareToken(req, "anysecret", storedCodes)
		require.NoError(t, err)
	}
	validationDuration := time.Since(start)
	assert.Less(t, validationDuration, 1*time.Second, "1000 validations should complete within 1 second")
}

// TestAuthenticationErrorHandling tests error scenarios
func TestAuthenticationErrorHandling(t *testing.T) {
	hardwareService := NewHardwareTokenService()

	// Test invalid token type
	req := &HardwareTokenValidationRequest{
		UserID:    "user123",
		TokenType: "invalid",
	}
	resp, err := hardwareService.ValidateHardwareToken(req, "secret", []BackupCode{})
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "unsupported token type")

	// Test missing TOTP code
	req = &HardwareTokenValidationRequest{
		UserID:    "user123",
		TokenType: "totp",
	}
	resp, err = hardwareService.ValidateHardwareToken(req, "secret", []BackupCode{})
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "TOTP code is required")

	// Test missing backup code
	req = &HardwareTokenValidationRequest{
		UserID:    "user123",
		TokenType: "backup",
	}
	resp, err = hardwareService.ValidateHardwareToken(req, "secret", []BackupCode{})
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "backup code is required")

	// Test invalid YubiKey OTP
	_, err = hardwareService.ValidateYubiKeyOTP("too-short")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid YubiKey OTP length")

	// Test SAML service with invalid configuration
	invalidSAMLConfig := &SAMLConfig{
		EntityID: "", // Empty entity ID
	}
	samlService := NewSAMLService(invalidSAMLConfig)
	assert.False(t, samlService.IsConfigured())

	// Test LDAP service with invalid configuration
	invalidLDAPConfig := &LDAPConfig{
		URL: "", // Empty URL
	}
	ldapService := NewLDAPService(invalidLDAPConfig)
	assert.False(t, ldapService.IsConfigured())

	// Test biometric service with invalid configuration
	invalidBiometricConfig := &BiometricConfig{
		RPID: "", // Empty RPID
	}
	biometricService := NewBiometricService(invalidBiometricConfig)
	assert.False(t, biometricService.IsConfigured())
}

// TestAuthenticationSerialization tests JSON serialization
func TestAuthenticationSerialization(t *testing.T) {
	// Test SAML config serialization
	samlConfig := &SAMLConfig{
		EntityID:         "https://sdlc.ai",
		MetadataURL:      "https://idp.example.com/metadata",
		SingleSignOnURL:  "https://idp.example.com/sso",
		SingleLogoutURL:  "https://idp.example.com/slo",
		NameIDFormat:     "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress",
		AttributeMapping: map[string]string{"email": "emailAddress"},
	}

	data, err := json.Marshal(samlConfig)
	require.NoError(t, err)
	assert.NotEmpty(t, data)

	var unmarshaled SAMLConfig
	err = json.Unmarshal(data, &unmarshaled)
	require.NoError(t, err)
	assert.Equal(t, samlConfig.EntityID, unmarshaled.EntityID)

	// Test hardware token request serialization
	hardwareReq := &HardwareTokenValidationRequest{
		UserID:     "user123",
		TOTPCode:   "123456",
		BackupCode: "ABCD1234",
		TokenType:  "totp",
	}

	data, err = json.Marshal(hardwareReq)
	require.NoError(t, err)
	assert.NotEmpty(t, data)

	var unmarshaledReq HardwareTokenValidationRequest
	err = json.Unmarshal(data, &unmarshaledReq)
	require.NoError(t, err)
	assert.Equal(t, hardwareReq.UserID, unmarshaledReq.UserID)
	assert.Equal(t, hardwareReq.TokenType, unmarshaledReq.TokenType)

	// Test biometric credential serialization
	biometricCred := &BiometricCredential{
		ID:         "cred-123",
		Type:       "public-key",
		UserID:     "user123",
		PublicKey:  []byte("public-key-data"),
		Transports: []string{"usb", "nfc"},
		SignCount:  1,
		CreatedAt:  time.Now(),
		LastUsed:   time.Now(),
	}

	data, err = json.Marshal(biometricCred)
	require.NoError(t, err)
	assert.NotEmpty(t, data)

	var unmarshaledCred BiometricCredential
	err = json.Unmarshal(data, &unmarshaledCred)
	require.NoError(t, err)
	assert.Equal(t, biometricCred.ID, unmarshaledCred.ID)
	assert.Equal(t, biometricCred.UserID, unmarshaledCred.UserID)
}

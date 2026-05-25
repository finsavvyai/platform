package auth

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

// AuthenticationTestSuite runs all authentication-related tests
type AuthenticationTestSuite struct {
	suite.Suite
	samlService      *SAMLService
	ldapService      *LDAPService
	biometricService *BiometricService
	hardwareService  *HardwareTokenService
}

func (suite *AuthenticationTestSuite) SetupSuite() {
	// Initialize SAML service
	samlConfig := &SAMLConfig{
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
	suite.samlService = NewSAMLService(samlConfig)

	// Initialize LDAP service
	ldapConfig := &LDAPConfig{
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
		ConnectTimeout:  30 * 1000000000, // 30 seconds in nanoseconds
		ReadTimeout:     30 * 1000000000,
	}
	suite.ldapService = NewLDAPService(ldapConfig)

	// Initialize biometric service
	biometricConfig := &BiometricConfig{
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
	suite.biometricService = NewBiometricService(biometricConfig)

	// Initialize hardware token service
	suite.hardwareService = NewHardwareTokenService()
}

func (suite *AuthenticationTestSuite) TestSAMLConfiguration() {
	suite.True(suite.samlService.IsConfigured())
}

func (suite *AuthenticationTestSuite) TestLDAPConfiguration() {
	suite.True(suite.ldapService.IsConfigured())
}

func (suite *AuthenticationTestSuite) TestBiometricConfiguration() {
	suite.True(suite.biometricService.IsConfigured())
}

func (suite *AuthenticationTestSuite) TestHardwareTokenService() {
	// Test TOTP setup
	setup, err := suite.hardwareService.GenerateTOTPSecret("user123", "SDLC.ai", "test@example.com")
	suite.NoError(err)
	suite.NotEmpty(setup.Secret)
	suite.Len(setup.BackupCodes, 10)

	// Test backup code generation
	codes, err := suite.hardwareService.generateBackupCodes("user123")
	suite.NoError(err)
	suite.Len(codes, 10)

	// Test YubiKey challenge
	challenge, err := suite.hardwareService.GenerateYubiKeyChallenge("user123")
	suite.NoError(err)
	suite.NotEmpty(challenge)
}

func TestAuthenticationTestSuite(t *testing.T) {
	suite.Run(t, new(AuthenticationTestSuite))
}

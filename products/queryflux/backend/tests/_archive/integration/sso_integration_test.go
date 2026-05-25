package sso

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"golang.org/x/oauth2"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/domain/sso"
	"github.com/queryflux/backend/internal/infrastructure/repositories/postgres"
	"github.com/queryflux/backend/internal/infrastructure/sso/providers"
	"github.com/queryflux/backend/internal/services"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// SSOIntegrationTestSuite runs integration tests for SSO functionality
type SSOIntegrationTestSuite struct {
	suite.Suite
	db                  *pgxpool.Pool
	redisClient         *redis.Client
	providerRepo        sso.SSOProviderRepository
	identityRepo        sso.SSOIdentityRepository
	settingsRepo        sso.EnterpriseSettingsRepository
	sessionRepo         sso.SSOSessionRepository
	userRepo            repositories.UserRepository
	ssoService          services.SSOService
	provisioningService *services.EnterpriseProvisioningService
	sessionManager      *services.SSOSessionManager
	testProvider        *sso.SSOProvider
	testIdentity        *sso.SSOIdentity
	testUser            *entities.User
}

// SetupSuite sets up the test suite
func (suite *SSOIntegrationTestSuite) SetupSuite() {
	// Initialize database connection
	db, err := pgxpool.New(context.Background(), "postgres://localhost/queryflux_test?sslmode=disable")
	require.NoError(suite.T(), err)
	suite.db = db

	// Initialize Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   1, // Use separate DB for tests
	})
	suite.redisClient = redisClient

	// Clear Redis test DB
	redisClient.FlushDB(context.Background())

	// Initialize repositories
	suite.providerRepo = postgres.NewSSOProviderRepository(db)
	suite.identityRepo = postgres.NewSSOIdentityRepository(db)
	suite.settingsRepo = postgres.NewEnterpriseSettingsRepository(db)
	suite.sessionRepo = postgres.NewSSOSessionRepository(db)
	suite.userRepo = postgres.NewUserRepository(db) // Assuming this exists

	// Initialize services
	suite.provisioningService = services.NewEnterpriseProvisioningService(
		suite.userRepo,
		suite.identityRepo,
		suite.providerRepo,
		suite.sessionRepo,
		nil, // AuthService - would need to mock or implement
		suite.settingsRepo,
	)

	// Create SSO service
	suite.ssoService = services.NewSSOService(
		suite.providerRepo,
		suite.identityRepo,
		suite.settingsRepo,
		suite.userRepo,
		suite.sessionRepo,
		suite.provisioningService,
		&services.SSOConfig{
			BaseURL:     "https://test.queryflux.com",
			ACSURL:      "https://test.queryflux.com/auth/saml/acs",
			SLOURL:      "https://test.queryflux.com/auth/saml/slo",
			CallbackURL: "https://test.queryflux.com/auth/oidc/callback",
			SessionTTL:  30, // 30 minutes
			TokenTTL:    60, // 60 minutes
		},
	)

	// Initialize session manager
	suite.sessionManager = services.NewSSOSessionManager(
		suite.sessionRepo,
		redisClient,
		30*time.Minute,
	)

	// Setup test data
	suite.setupTestData()
}

// TearDownSuite cleans up after tests
func (suite *SSOIntegrationTestSuite) TearDownSuite() {
	// Clean up test data
	suite.cleanupTestData()

	// Close connections
	if suite.db != nil {
		suite.db.Close()
	}
	if suite.redisClient != nil {
		suite.redisClient.Close()
	}
}

// SetupTest runs before each test
func (suite *SSOIntegrationTestSuite) SetupTest() {
	// Ensure clean state for each test
	suite.redisClient.FlushDB(context.Background())
}

// setupTestData creates test data
func (suite *SSOIntegrationTestSuite) setupTestData() {
	ctx := context.Background()

	// Create test user
	suite.testUser = &entities.User{
		ID:           uuid.New().String(),
		Email:        "test@example.com",
		Name:         "Test User",
		Role:         entities.RoleUser,
		Plan:         entities.PlanFree,
		PasswordHash: "hash",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	err := suite.userRepo.Create(ctx, suite.testUser)
	require.NoError(suite.T(), err)

	// Create test SAML provider
	suite.testProvider, err = sso.NewSSOProvider("Test IdP", sso.SSOProviderTypeSAML, map[string]interface{}{
		"entity_id":    "https://idp.example.com",
		"metadata_url": "https://idp.example.com/metadata",
		"metadata_xml": `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>MIIC...</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`,
	})
	require.NoError(suite.T(), err)
	err = suite.providerRepo.Create(ctx, suite.testProvider)
	require.NoError(suite.T(), err)

	// Create test OIDC provider
	oidcProvider, err := sso.NewSSOProvider("Test OIDC", sso.SSOProviderTypeOIDC, map[string]interface{}{
		"client_id":     "test-client-id",
		"client_secret": "test-client-secret",
		"auth_url":      "https://oidc.example.com/auth",
		"token_url":     "https://oidc.example.com/token",
		"user_info_url": "https://oidc.example.com/userinfo",
	})
	require.NoError(suite.T(), err)
	err = suite.providerRepo.Create(ctx, oidcProvider)
	require.NoError(suite.T(), err)
}

// cleanupTestData removes test data
func (suite *SSOIntegrationTestSuite) cleanupTestData() {
	ctx := context.Background()

	// Delete test providers
	providers, _ := suite.providerRepo.List(ctx, 100, 0)
	for _, provider := range providers {
		if provider.Name == "Test IdP" || provider.Name == "Test OIDC" {
			suite.providerRepo.Delete(ctx, provider.ID)
		}
	}

	// Delete test user
	if suite.testUser != nil {
		suite.userRepo.Delete(ctx, suite.testUser.ID)
	}
}

// TestCreateProvider tests creating an SSO provider
func (suite *SSOIntegrationTestSuite) TestCreateProvider() {
	ctx := context.Background()

	// Create SAML provider
	samlConfig := map[string]interface{}{
		"entity_id":    "https://saml.example.com",
		"metadata_url": "https://saml.example.com/metadata",
	}
	provider, err := suite.ssoService.CreateProvider(ctx, "SAML Test", sso.SSOProviderTypeSAML, samlConfig)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "SAML Test", provider.Name)
	assert.Equal(suite.T(), sso.SSOProviderTypeSAML, provider.Type)

	// Verify provider was saved
	saved, err := suite.providerRepo.GetByID(ctx, provider.ID)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), provider.EntityID, saved.EntityID)

	// Create OIDC provider
	oidcConfig := map[string]interface{}{
		"client_id":     "oidc-client",
		"client_secret": "oidc-secret",
		"auth_url":      "https://oidc.example.com/auth",
		"token_url":     "https://oidc.example.com/token",
	}
	oidcProvider, err := suite.ssoService.CreateProvider(ctx, "OIDC Test", sso.SSOProviderTypeOIDC, oidcConfig)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "OIDC Test", oidcProvider.Name)
	assert.Equal(suite.T(), sso.SSOProviderTypeOIDC, oidcProvider.Type)

	// Cleanup
	suite.providerRepo.Delete(ctx, provider.ID)
	suite.providerRepo.Delete(ctx, oidcProvider.ID)
}

// TestGetProviders tests retrieving SSO providers
func (suite *SSOIntegrationTestSuite) TestGetProviders() {
	ctx := context.Background()

	// Get all providers
	providers, err := suite.ssoService.GetEnabledProviders(ctx)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(providers), 0)

	// Get providers by type
	samlProviders, err := suite.ssoService.GetProvidersByType(ctx, sso.SSOProviderTypeSAML)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(samlProviders), 0)

	oidcProviders, err := suite.ssoService.GetProvidersByType(ctx, sso.SSOProviderTypeOIDC)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(oidcProviders), 0)
}

// TestSAMLAuthenticationFlow tests the complete SAML authentication flow
func (suite *SSOIntegrationTestSuite) TestSAMLAuthenticationFlow() {
	ctx := context.Background()

	// Initiate SAML login
	session, authURL, err := suite.ssoService.InitiateSAMLLogin(ctx, suite.testProvider.ID, "https://app.example.com/callback")
	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), session.ID)
	assert.Contains(suite.T(), authURL, "SAMLRequest")
	assert.Contains(suite.T(), authURL, session.RequestID)

	// Create mock SAML identity
	identity, err := sso.NewSSOIdentity(suite.testProvider.ID, "user123", "john.doe@example.com", "John Doe")
	require.NoError(suite.T(), err)
	identity.SetAttribute("email", "john.doe@example.com")
	identity.SetAttribute("name", "John Doe")
	identity.SetAttribute("groups", []string{"users", "developers"})

	// Save identity first
	err = suite.identityRepo.Create(ctx, identity)
	assert.NoError(suite.T(), err)

	// Link session to identity (normally done during SAML response processing)
	session.IdentityID = &identity.ID
	err = suite.sessionRepo.Update(ctx, session)
	assert.NoError(suite.T(), err)

	// Validate session
	validatedIdentity, err := suite.ssoService.ValidateSession(ctx, session.ID)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), identity.ID, validatedIdentity.ID)

	// Test SAML metadata retrieval
	metadata, err := suite.ssoService.GetSAMLMetadata(ctx, suite.testProvider.ID)
	assert.NoError(suite.T(), err)
	assert.Contains(suite.T(), metadata, "EntityDescriptor")

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
	suite.sessionRepo.Delete(ctx, session.ID)
}

// TestOIDCAuthenticationFlow tests the complete OIDC authentication flow
func (suite *SSOIntegrationTestSuite) TestOIDCAuthenticationFlow() {
	ctx := context.Background()

	// Get OIDC provider
	oidcProviders, err := suite.providerRepo.GetByType(ctx, sso.SSOProviderTypeOIDC)
	require.NoError(suite.T(), err)
	require.Greater(suite.T(), len(oidcProviders), 0)
	oidcProvider := oidcProviders[0]

	// Initiate OIDC login
	session, authURL, err := suite.ssoService.InitiateOIDCLogin(ctx, oidcProvider.ID, "https://app.example.com/callback")
	assert.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), session.ID)
	assert.Contains(suite.T(), authURL, "response_type=code")
	assert.Contains(suite.T(), authURL, session.State)
	assert.Contains(suite.T(), authURL, session.Nonce)

	// Create mock OIDC identity
	identity, err := sso.NewSSOIdentity(oidcProvider.ID, "sub123", "jane@example.com", "Jane Smith")
	require.NoError(suite.T(), err)
	identity.SetAttribute("sub", "sub123")
	identity.SetAttribute("email", "jane@example.com")
	identity.SetAttribute("given_name", "Jane")
	identity.SetAttribute("family_name", "Smith")
	identity.SetAttribute("email_verified", true)

	// Save identity first
	err = suite.identityRepo.Create(ctx, identity)
	assert.NoError(suite.T(), err)

	// Link session to identity (normally done during OIDC callback processing)
	session.IdentityID = &identity.ID
	err = suite.sessionRepo.Update(ctx, session)
	assert.NoError(suite.T(), err)

	// Validate session
	validatedIdentity, err := suite.ssoService.ValidateSession(ctx, session.ID)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), identity.ID, validatedIdentity.ID)

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
	suite.sessionRepo.Delete(ctx, session.ID)
}

// TestEnterpriseUserProvisioning tests user provisioning from SSO
func (suite *SSOIntegrationTestSuite) TestEnterpriseUserProvisioning() {
	ctx := context.Background()

	// Create enterprise settings for the provider
	settings, err := sso.NewEnterpriseSettings("org123", suite.testProvider.ID)
	require.NoError(suite.T(), err)
	settings.RequireSSO = true
	settings.AllowLocalLogin = false
	settings.DomainWhitelist = "example.com,test.com"

	// Set role mappings
	roleMappings := map[string]string{
		"admin":     "admin",
		"developer": "user",
		"user":      "user",
	}
	roleMappingsJSON, _ := json.Marshal(roleMappings)
	settings.RoleMappings = string(roleMappingsJSON)

	err = suite.settingsRepo.Create(ctx, settings)
	assert.NoError(suite.T(), err)

	// Create SSO identity with admin role
	identity, err := sso.NewSSOIdentity(suite.testProvider.ID, "emp456", "admin@example.com", "Admin User")
	require.NoError(suite.T(), err)
	identity.SetAttribute("email", "admin@example.com")
	identity.SetAttribute("name", "Admin User")
	identity.SetAttribute("roles", "admin") // This should map to admin role

	// Provision user
	user, err := suite.provisioningService.ProvisionUser(ctx, identity, suite.testProvider)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), "admin@example.com", user.Email)
	assert.Equal(suite.T(), "Admin User", user.Name)
	assert.Equal(suite.T(), entities.RoleAdmin, user.Role) // Should be mapped to admin

	// Test domain validation
	err = suite.provisioningService.ValidateDomain(ctx, "user@example.com", "org123")
	assert.NoError(suite.T(), err)

	err = suite.provisioningService.ValidateDomain(ctx, "user@unauthorized.com", "org123")
	assert.Error(suite.T(), err) // Should fail for unauthorized domain

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
	suite.settingsRepo.Delete(ctx, settings.ID)
	suite.userRepo.Delete(ctx, user.ID)
}

// TestSessionManagement tests SSO session management
func (suite *SSOIntegrationTestSuite) TestSessionManagement() {
	ctx := context.Background()

	// Create test identity
	identity, err := sso.NewSSOIdentity(suite.testProvider.ID, "sess123", "session@example.com", "Session User")
	require.NoError(suite.T(), err)
	err = suite.identityRepo.Create(ctx, identity)
	assert.NoError(suite.T(), err)

	// Create session
	session, err := suite.sessionManager.CreateSession(ctx, identity.ID, "https://app.example.com")
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), session.IsActive)

	// Validate session
	validatedSession, err := suite.sessionManager.ValidateSession(ctx, session.ID)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), session.ID, validatedSession.ID)

	// Test retrieval by state
	sessionByState, err := suite.sessionManager.GetSessionByState(ctx, session.State)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), session.ID, sessionByState.ID)

	// Renew session
	renewedSession, err := suite.sessionManager.RenewSession(ctx, session.ID)
	assert.NoError(suite.T(), err)
	assert.True(suite.T(), renewedSession.ExpiresAt.After(session.ExpiresAt))

	// Invalidate session
	err = suite.sessionManager.InvalidateSession(ctx, session.ID)
	assert.NoError(suite.T(), err)

	// Verify session is inactive
	_, err = suite.sessionManager.ValidateSession(ctx, session.ID)
	assert.Error(suite.T(), err)

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
}

// TestRoleMapping tests role mapping from SSO attributes
func (suite *SSOIntegrationTestSuite) TestRoleMapping() {
	ctx := context.Background()

	// Test cases for role mapping
	testCases := []struct {
		name          string
		providerRoles []string
		expectedRole  string
	}{
		{
			name:          "Admin role mapping",
			providerRoles: []string{"admin", "superuser"},
			expectedRole:  entities.RoleAdmin,
		},
		{
			name:          "User role mapping",
			providerRoles: []string{"user", "member", "employee"},
			expectedRole:  entities.RoleUser,
		},
		{
			name:          "Mixed roles",
			providerRoles: []string{"user", "admin"},
			expectedRole:  entities.RoleAdmin, // Admin should take precedence
		},
		{
			name:          "Unknown role",
			providerRoles: []string{"unknown", "custom"},
			expectedRole:  "user", // Default role
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			// Create identity with test roles
			identity, err := sso.NewSSOIdentity(suite.testProvider.ID, "role123", "role@example.com", "Role User")
			require.NoError(t, err)
			identity.SetAttribute("roles", tc.providerRoles)
			err = suite.identityRepo.Create(ctx, identity)
			require.NoError(t, err)

			// Map roles
			mappedRoles, err := suite.provisioningService.MapUserRoles(ctx, identity, suite.testProvider)
			assert.NoError(t, err)
			assert.Contains(t, mappedRoles, tc.expectedRole)

			// Cleanup
			suite.identityRepo.Delete(ctx, identity.ID)
		})
	}
}

// TestProviderConfiguration tests SSO provider configuration
func (suite *SSOIntegrationTestSuite) TestProviderConfiguration() {
	// Create test identity
	var err error
	suite.testIdentity, err = sso.NewSSOIdentity(suite.testProvider.ID, "prov-test-id", "test@example.com", "Test User")
	require.NoError(suite.T(), err)
	err = suite.identityRepo.Create(context.Background(), suite.testIdentity)
	require.NoError(suite.T(), err)

	// Test linking identity to user
	err = suite.provisioningService.LinkIdentityToUser(context.Background(), suite.testIdentity.ID, suite.testUser.ID)
	require.NoError(suite.T(), err)

	ctx := context.Background()

	// Test updating provider configuration
	updatedProvider, err := suite.providerRepo.GetByID(ctx, suite.testProvider.ID)
	require.NoError(suite.T(), err)

	updatedProvider.Enabled = false
	updatedProvider.AutoProvision = true
	updatedProvider.DefaultRole = "admin"
	updatedProvider.DefaultPlan = "enterprise"

	err = suite.providerRepo.Update(ctx, updatedProvider)
	assert.NoError(suite.T(), err)

	// Verify changes
	saved, err := suite.providerRepo.GetByID(ctx, suite.testProvider.ID)
	assert.NoError(suite.T(), err)
	assert.False(suite.T(), saved.Enabled)
	assert.True(suite.T(), saved.AutoProvision)
	assert.Equal(suite.T(), "admin", saved.DefaultRole)
	assert.Equal(suite.T(), "enterprise", saved.DefaultPlan)

	// Test provider listing
	providers, err := suite.providerRepo.List(ctx, 10, 0)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), len(providers), 0)

	// Test provider count
	count, err := suite.providerRepo.Count(ctx)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), count, int64(0))
}

// TestCleanupExpiredSessions tests cleanup of expired sessions
func (suite *SSOIntegrationTestSuite) TestCleanupExpiredSessions() {
	ctx := context.Background()

	// Create expired session
	identity, err := sso.NewSSOIdentity(suite.testProvider.ID, "expired123", "expired@example.com", "Expired User")
	require.NoError(suite.T(), err)
	err = suite.identityRepo.Create(ctx, identity)
	assert.NoError(suite.T(), err)

	// Create session with past expiration
	expiredSession, err := sso.NewSSOSession(identity.ID, "https://app.example.com", time.Now().Add(-1*time.Hour))
	require.NoError(suite.T(), err)
	err = suite.sessionRepo.Create(ctx, expiredSession)
	assert.NoError(suite.T(), err)

	// Run cleanup
	err = suite.sessionManager.CleanupExpiredSessions(ctx)
	assert.NoError(suite.T(), err)

	// Verify expired session was deleted
	_, err = suite.sessionRepo.GetByID(ctx, expiredSession.ID)
	assert.Error(suite.T(), err) // Should not find expired session

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
}

// TestSAMLMetadata tests SAML metadata generation
func (suite *SSOIntegrationTestSuite) TestSAMLMetadata() {

	// Create a SAML provider with specific configuration
	samlConfig := &providers.SAMLConfig{
		EntityID: "https://sso.test.example.com",
		ACSURL:   "https://sso.test.example.com/auth/saml/acs",
		SLOURL:   "https://sso.test.example.com/auth/saml/slo",
	}

	provider, err := providers.NewSAMLProvider(samlConfig)
	assert.NoError(suite.T(), err)

	// Generate metadata
	metadata, err := provider.GetMetadata()
	assert.NoError(suite.T(), err)
	assert.Contains(suite.T(), metadata, "EntityDescriptor")
	assert.Contains(suite.T(), metadata, samlConfig.EntityID)
	assert.Contains(suite.T(), metadata, samlConfig.ACSURL)
}

// TestOIDCTokenRefresh tests OIDC token refresh
func (suite *SSOIntegrationTestSuite) TestOIDCTokenRefresh() {
	ctx := context.Background()

	// Create mock HTTP client for OIDC
	mockTransport := roundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: 200,
			Body: io.NopCloser(bytes.NewBufferString(`{
				"access_token": "new-mock-access-token",
				"token_type": "Bearer",
				"expires_in": 3600,
				"refresh_token": "new-mock-refresh-token",
				"id_token": "new-mock-id-token"
			}`)),
			Header: make(http.Header),
		}
	})
	httpClient := &http.Client{Transport: mockTransport}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)

	// Get OIDC provider
	oidcProviders, err := suite.providerRepo.GetByType(ctx, sso.SSOProviderTypeOIDC)
	require.NoError(suite.T(), err)
	require.Greater(suite.T(), len(oidcProviders), 0)
	oidcProvider := oidcProviders[0]

	// Create identity with refresh token
	identity, err := sso.NewSSOIdentity(oidcProvider.ID, "refresh123", "refresh@example.com", "Refresh User")
	require.NoError(suite.T(), err)
	identity.SetAttribute("refresh_token", "mock-refresh-token")
	err = suite.identityRepo.Create(ctx, identity)
	assert.NoError(suite.T(), err)

	// Test token refresh (mock implementation)
	err = suite.ssoService.RefreshOIDCToken(ctx, identity.ID)
	// In real implementation, this would make an HTTP call to refresh the token
	// For test, we expect it to not crash
	assert.NoError(suite.T(), err)

	// Cleanup
	suite.identityRepo.Delete(ctx, identity.ID)
}

// TestIntegration runs all integration tests
func TestSSOIntegration(t *testing.T) {
	suite.Run(t, new(SSOIntegrationTestSuite))
}

// Mock implementations for testing

// MockUserRepository implements UserRepository for testing
type MockUserRepository struct {
	users map[string]*entities.User
}

func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users: make(map[string]*entities.User),
	}
}

func (r *MockUserRepository) Create(ctx context.Context, user *entities.User) error {
	r.users[user.ID] = user
	return nil
}

func (r *MockUserRepository) GetByID(ctx context.Context, id string) (*entities.User, error) {
	user, exists := r.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

func (r *MockUserRepository) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	for _, user := range r.users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (r *MockUserRepository) Update(ctx context.Context, user *entities.User) error {
	r.users[user.ID] = user
	return nil
}

func (r *MockUserRepository) Delete(ctx context.Context, id string) error {
	delete(r.users, id)
	return nil
}

// Additional methods would be implemented as needed

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

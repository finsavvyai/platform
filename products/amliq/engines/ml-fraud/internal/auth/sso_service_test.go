package auth

import (
	"context"
	"encoding/base64"
	"encoding/xml"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockUserService is a mock implementation of UserService
type MockUserService struct {
	mock.Mock
}

func (m *MockUserService) CreateUser(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) UpdateUser(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserService) DeleteUser(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) ListUsers(ctx context.Context, filters *interfaces.UserFilters) ([]*models.User, error) {
	args := m.Called(ctx, filters)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserService) ActivateUser(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) DeactivateUser(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) UpdateLastLogin(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) UpdateUserRole(ctx context.Context, userID string, role models.UserRole) error {
	args := m.Called(ctx, userID, role)
	return args.Error(0)
}

func (m *MockUserService) CheckPermission(ctx context.Context, userID string, permission string) (bool, error) {
	args := m.Called(ctx, userID, permission)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserService) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]string), args.Error(1)
}

func setupSSOTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Limit to a single connection to avoid SQLite in-memory DB connection pool issues
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	// Auto-migrate the schema
	err = db.AutoMigrate(&models.User{}, &SSOConfig{}, &SSOSession{})
	require.NoError(t, err)

	return db
}

func createTestSSOConfig(t *testing.T, db *gorm.DB, provider string, ssoType string) *SSOConfig {
	config := &SSOConfig{
		Provider:    provider,
		DisplayName: provider + " SSO",
		Type:        ssoType,
		EntityID:    "quantumbeam-" + provider,
		SSOUrl:      "https://" + provider + ".example.com/sso",
		Certificate: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
		AttributeMap: map[string]string{
			"email":        "email",
			"given_name":   "first_name",
			"family_name":  "last_name",
			"organization": "company",
		},
		IsActive:        true,
		AutoCreateUsers: true,
	}

	err := db.Create(config).Error
	require.NoError(t, err)

	return config
}

func createSAMLAssertion(email, firstName, lastName, company string) string {
	samlResponse := SAMLResponse{
		ID:           "test-response-id",
		Version:      "2.0",
		IssueInstant: time.Now().Format(time.RFC3339),
		Destination:  "https://quantumbeam/auth/sso/test/callback",
		Issuer: SAMLIssuer{
			Value: "https://test.example.com",
		},
		Status: SAMLStatus{
			StatusCode: SAMLStatusCode{
				Value: "urn:oasis:names:tc:SAML:2.0:status:Success",
			},
		},
		Assertion: SAMLAssertion{
			ID:           "test-assertion-id",
			Version:      "2.0",
			IssueInstant: time.Now().Format(time.RFC3339),
			Issuer: SAMLIssuer{
				Value: "https://test.example.com",
			},
			Subject: SAMLSubject{
				NameID: SAMLNameID{
					Format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
					Value:  email,
				},
			},
			Conditions: SAMLConditions{
				NotBefore:    time.Now().Add(-5 * time.Minute).Format(time.RFC3339),
				NotOnOrAfter: time.Now().Add(5 * time.Minute).Format(time.RFC3339),
			},
			AttributeStatement: SAMLAttributeStatement{
				Attributes: []SAMLAttribute{
					{
						Name: "email",
						AttributeValue: SAMLAttributeValue{
							Value: email,
						},
					},
					{
						Name: "given_name",
						AttributeValue: SAMLAttributeValue{
							Value: firstName,
						},
					},
					{
						Name: "family_name",
						AttributeValue: SAMLAttributeValue{
							Value: lastName,
						},
					},
					{
						Name: "organization",
						AttributeValue: SAMLAttributeValue{
							Value: company,
						},
					},
				},
			},
		},
	}

	xmlData, _ := xml.Marshal(samlResponse)
	return base64.StdEncoding.EncodeToString(xmlData)
}

func TestSSOService_ProcessSSOLogin(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{
		secretKey:       []byte("test-secret-key-32-characters-long"),
		refreshKey:      []byte("test-refresh-key-32-characters-long"),
		issuer:          "quantumbeam-test",
		accessTokenTTL:  15 * time.Minute,
		refreshTokenTTL: 7 * 24 * time.Hour,
	}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	// Create test SSO config
	createTestSSOConfig(t, db, "test-provider", "saml")

	ctx := context.Background()

	t.Run("successful SAML login with new user", func(t *testing.T) {
		assertion := createSAMLAssertion("newuser@example.com", "John", "Doe", "Acme Corp")

		// Mock user service calls
		mockUserService.On("GetUserByEmail", ctx, "newuser@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		mockUserService.On("CreateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil).Run(func(args mock.Arguments) {
			user := args.Get(1).(*models.User)
			user.UserID = "new-user-123"
		})

		mockUserService.On("UpdateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil)

		result, err := service.ProcessSSOLogin(ctx, "test-provider", assertion)

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, result.IsNewUser)
		assert.Equal(t, "test-provider", result.Provider)
		assert.Equal(t, "newuser@example.com", result.User.Email)
		assert.Equal(t, "John", result.User.FirstName)
		assert.Equal(t, "Doe", result.User.LastName)
		assert.Equal(t, "Acme Corp", result.User.Company)
		assert.NotNil(t, result.Tokens)
		assert.NotEmpty(t, result.Tokens.AccessToken)

		mockUserService.AssertExpectations(t)
	})

	t.Run("successful SAML login with existing user", func(t *testing.T) {
		assertion := createSAMLAssertion("existing@example.com", "Jane", "Smith", "Tech Corp")

		existingUser := &models.User{
			UserID:    "existing-user-456",
			Email:     "existing@example.com",
			FirstName: "Jane",
			LastName:  "Smith",
			Role:      models.UserRoleDeveloper,
			IsActive:  true,
		}

		// Mock user service calls
		mockUserService.On("GetUserByEmail", ctx, "existing@example.com").
			Return(existingUser, nil)

		mockUserService.On("UpdateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil)

		result, err := service.ProcessSSOLogin(ctx, "test-provider", assertion)

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.False(t, result.IsNewUser)
		assert.Equal(t, "test-provider", result.Provider)
		assert.Equal(t, existingUser.UserID, result.User.UserID)
		assert.NotNil(t, result.Tokens)

		mockUserService.AssertExpectations(t)
	})

	t.Run("empty provider error", func(t *testing.T) {
		assertion := createSAMLAssertion("test@example.com", "Test", "User", "Test Corp")

		result, err := service.ProcessSSOLogin(ctx, "", assertion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "provider cannot be empty")
	})

	t.Run("empty assertion error", func(t *testing.T) {
		result, err := service.ProcessSSOLogin(ctx, "test-provider", "")

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "assertion cannot be empty")
	})

	t.Run("inactive SSO provider", func(t *testing.T) {
		// Create inactive SSO config - create first, then update IsActive to false
		// (GORM default:true prevents storing false during Create)
		inactiveConfig := &SSOConfig{
			Provider: "inactive-provider",
			Type:     "saml",
			SSOUrl:   "https://inactive.example.com/sso",
			IsActive: true,
		}
		db.Create(inactiveConfig)
		db.Model(&SSOConfig{}).Where("provider = ?", "inactive-provider").Update("is_active", false)

		assertion := createSAMLAssertion("test@example.com", "Test", "User", "Test Corp")

		result, err := service.ProcessSSOLogin(ctx, "inactive-provider", assertion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "SSO provider inactive-provider is not active")
	})

	t.Run("non-existent SSO provider", func(t *testing.T) {
		assertion := createSAMLAssertion("test@example.com", "Test", "User", "Test Corp")

		result, err := service.ProcessSSOLogin(ctx, "non-existent", assertion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "SSO provider not configured")
	})

	t.Run("invalid SAML assertion", func(t *testing.T) {
		invalidAssertion := base64.StdEncoding.EncodeToString([]byte("invalid xml"))

		result, err := service.ProcessSSOLogin(ctx, "test-provider", invalidAssertion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to validate SSO assertion")
	})

	t.Run("auto-create disabled", func(t *testing.T) {
		// Create SSO config with auto-create disabled
		noAutoCreateConfig := &SSOConfig{
			Provider:        "no-auto-create",
			Type:            "saml",
			SSOUrl:          "https://noautocreate.example.com/sso",
			Certificate:     "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
			IsActive:        true,
			AutoCreateUsers: false,
			AttributeMap: map[string]string{
				"email":        "email",
				"given_name":   "first_name",
				"family_name":  "last_name",
				"organization": "company",
			},
		}
		db.Create(noAutoCreateConfig)

		assertion := createSAMLAssertion("newuser2@example.com", "New", "User", "Corp")

		// Mock user service calls
		mockUserService.On("GetUserByEmail", ctx, "newuser2@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		result, err := service.ProcessSSOLogin(ctx, "no-auto-create", assertion)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "user not found and auto-creation is disabled")

		mockUserService.AssertExpectations(t)
	})
}

func TestSSOService_ConfigureSSO(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	ctx := context.Background()

	t.Run("successful SAML configuration", func(t *testing.T) {
		config := &interfaces.SSOConfig{
			Provider:    "new-saml-provider",
			EntityID:    "quantumbeam-new-saml",
			SSOUrl:      "https://newsaml.example.com/sso",
			Certificate: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
			AttributeMap: map[string]string{
				"email": "email",
			},
			IsActive:        true,
			AutoCreateUsers: true,
		}

		err := service.ConfigureSSO(ctx, config)

		assert.NoError(t, err)

		// Verify configuration was saved
		var savedConfig SSOConfig
		err = db.Where("provider = ?", "new-saml-provider").First(&savedConfig).Error
		assert.NoError(t, err)
		assert.Equal(t, config.Provider, savedConfig.Provider)
		assert.Equal(t, config.SSOUrl, savedConfig.SSOUrl)
		assert.Equal(t, "saml", savedConfig.Type) // Should be determined automatically
	})

	t.Run("successful OIDC configuration", func(t *testing.T) {
		config := &interfaces.SSOConfig{
			Provider:        "new-oidc-provider",
			EntityID:        "quantumbeam-new-oidc",
			SSOUrl:          "https://accounts.google.com", // Use a real OIDC provider URL for testing
			IsActive:        false,                         // Set to false to avoid OIDC initialization
			AutoCreateUsers: false,
		}

		err := service.ConfigureSSO(ctx, config)

		assert.NoError(t, err)

		// Verify configuration was saved
		var savedConfig SSOConfig
		err = db.Where("provider = ?", "new-oidc-provider").First(&savedConfig).Error
		assert.NoError(t, err)
		assert.Equal(t, config.Provider, savedConfig.Provider)
		assert.Equal(t, "saml", savedConfig.Type) // Default type when URL doesn't contain oidc/oauth
	})

	t.Run("empty provider name", func(t *testing.T) {
		config := &interfaces.SSOConfig{
			Provider: "",
			SSOUrl:   "https://test.example.com/sso",
		}

		err := service.ConfigureSSO(ctx, config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "provider name cannot be empty")
	})

	t.Run("invalid SSO URL", func(t *testing.T) {
		config := &interfaces.SSOConfig{
			Provider: "invalid-url-provider",
			SSOUrl:   "://invalid-url-with-no-scheme",
		}

		err := service.ConfigureSSO(ctx, config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid SSO URL")
	})

	t.Run("update existing configuration", func(t *testing.T) {
		// Create initial configuration
		initialConfig := &interfaces.SSOConfig{
			Provider:        "update-test-provider",
			SSOUrl:          "https://initial.example.com/sso",
			IsActive:        false,
			AutoCreateUsers: false,
		}

		err := service.ConfigureSSO(ctx, initialConfig)
		require.NoError(t, err)

		// Update configuration
		updatedConfig := &interfaces.SSOConfig{
			Provider:        "update-test-provider",
			SSOUrl:          "https://updated.example.com/sso",
			IsActive:        true,
			AutoCreateUsers: true,
		}

		err = service.ConfigureSSO(ctx, updatedConfig)
		assert.NoError(t, err)

		// Verify update
		var savedConfig SSOConfig
		err = db.Where("provider = ?", "update-test-provider").First(&savedConfig).Error
		assert.NoError(t, err)
		assert.Equal(t, updatedConfig.SSOUrl, savedConfig.SSOUrl)
		assert.Equal(t, updatedConfig.IsActive, savedConfig.IsActive)
		assert.Equal(t, updatedConfig.AutoCreateUsers, savedConfig.AutoCreateUsers)
	})
}

func TestSSOService_ValidateSSOAssertion(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	// Create test SSO config
	createTestSSOConfig(t, db, "validate-test", "saml")

	ctx := context.Background()

	t.Run("valid SAML assertion", func(t *testing.T) {
		assertion := createSAMLAssertion("validate@example.com", "Validate", "User", "Validate Corp")

		userInfo, err := service.ValidateSSOAssertion(ctx, "validate-test", assertion)

		require.NoError(t, err)
		assert.NotNil(t, userInfo)
		assert.Equal(t, "validate@example.com", userInfo.Email)
		assert.Equal(t, "Validate", userInfo.FirstName)
		assert.Equal(t, "User", userInfo.LastName)
		assert.Equal(t, "Validate Corp", userInfo.Company)
		assert.Equal(t, "validate@example.com", userInfo.Subject)
	})

	t.Run("invalid assertion format", func(t *testing.T) {
		invalidAssertion := "not-base64-encoded"

		userInfo, err := service.ValidateSSOAssertion(ctx, "validate-test", invalidAssertion)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "failed to decode SAML assertion")
	})

	t.Run("non-existent provider", func(t *testing.T) {
		assertion := createSAMLAssertion("test@example.com", "Test", "User", "Test Corp")

		userInfo, err := service.ValidateSSOAssertion(ctx, "non-existent", assertion)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "failed to get SSO config")
	})

	t.Run("unsupported provider type", func(t *testing.T) {
		// Create SSO config with unsupported type
		unsupportedConfig := &SSOConfig{
			Provider: "unsupported-type",
			Type:     "unsupported",
			SSOUrl:   "https://unsupported.example.com/sso",
			IsActive: true,
		}
		db.Create(unsupportedConfig)

		assertion := createSAMLAssertion("test@example.com", "Test", "User", "Test Corp")

		userInfo, err := service.ValidateSSOAssertion(ctx, "unsupported-type", assertion)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "unsupported SSO provider type")
	})
}

func TestSSOService_GetSSOProviders(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	ctx := context.Background()

	// Create test SSO configs
	activeConfig1 := createTestSSOConfig(t, db, "active-provider-1", "saml")
	activeConfig2 := createTestSSOConfig(t, db, "active-provider-2", "oidc")

	// Create inactive config - create first, then update IsActive to false
	// (GORM default:true prevents storing false during Create)
	inactiveConfig := &SSOConfig{
		Provider:    "inactive-provider",
		DisplayName: "Inactive Provider",
		Type:        "saml",
		SSOUrl:      "https://inactive.example.com/sso",
		IsActive:    true,
	}
	db.Create(inactiveConfig)
	db.Model(&SSOConfig{}).Where("provider = ?", "inactive-provider").Update("is_active", false)

	t.Run("get active providers only", func(t *testing.T) {
		providers, err := service.GetSSOProviders(ctx)

		require.NoError(t, err)
		assert.Len(t, providers, 2) // Only active providers

		providerNames := make([]string, len(providers))
		for i, p := range providers {
			providerNames[i] = p.Name
			assert.True(t, p.IsActive)
		}

		assert.Contains(t, providerNames, activeConfig1.Provider)
		assert.Contains(t, providerNames, activeConfig2.Provider)
		assert.NotContains(t, providerNames, inactiveConfig.Provider)
	})

	t.Run("no active providers", func(t *testing.T) {
		// Deactivate all providers
		db.Model(&SSOConfig{}).Where("is_active = ?", true).Update("is_active", false)

		providers, err := service.GetSSOProviders(ctx)

		require.NoError(t, err)
		assert.Len(t, providers, 0)
	})
}

func TestSSOService_validateSAMLAssertion(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	config := &SSOConfig{
		Provider: "test-saml",
		Type:     "saml",
		AttributeMap: map[string]string{
			"email":        "email",
			"given_name":   "first_name",
			"family_name":  "last_name",
			"organization": "company",
		},
	}

	ctx := context.Background()

	t.Run("valid SAML assertion parsing", func(t *testing.T) {
		assertion := createSAMLAssertion("saml@example.com", "SAML", "User", "SAML Corp")

		userInfo, err := service.validateSAMLAssertion(ctx, config, assertion)

		require.NoError(t, err)
		assert.Equal(t, "saml@example.com", userInfo.Email)
		assert.Equal(t, "SAML", userInfo.FirstName)
		assert.Equal(t, "User", userInfo.LastName)
		assert.Equal(t, "SAML Corp", userInfo.Company)
		assert.Equal(t, "saml@example.com", userInfo.Subject)
		assert.NotEmpty(t, userInfo.Attributes)
	})

	t.Run("invalid base64 assertion", func(t *testing.T) {
		invalidAssertion := "not-valid-base64!"

		userInfo, err := service.validateSAMLAssertion(ctx, config, invalidAssertion)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "failed to decode SAML assertion")
	})

	t.Run("invalid XML assertion", func(t *testing.T) {
		invalidXML := base64.StdEncoding.EncodeToString([]byte("not valid xml"))

		userInfo, err := service.validateSAMLAssertion(ctx, config, invalidXML)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "failed to parse SAML response")
	})

	t.Run("missing email in assertion", func(t *testing.T) {
		// Create SAML response without email attribute
		samlResponse := SAMLResponse{
			Assertion: SAMLAssertion{
				Subject: SAMLSubject{
					NameID: SAMLNameID{
						Value: "no-email-user",
					},
				},
				AttributeStatement: SAMLAttributeStatement{
					Attributes: []SAMLAttribute{
						{
							Name: "given_name",
							AttributeValue: SAMLAttributeValue{
								Value: "No Email",
							},
						},
					},
				},
			},
		}

		xmlData, _ := xml.Marshal(samlResponse)
		assertion := base64.StdEncoding.EncodeToString(xmlData)

		userInfo, err := service.validateSAMLAssertion(ctx, config, assertion)

		assert.Error(t, err)
		assert.Nil(t, userInfo)
		assert.Contains(t, err.Error(), "email not found in SAML assertion")
	})
}

func TestSSOService_findOrCreateUser(t *testing.T) {
	db := setupSSOTestDB(t)
	mockUserService := &MockUserService{}
	mockJWTService := &JWTService{}

	service := NewSSOService(&SSOServiceConfig{
		DB:          db,
		JWTService:  mockJWTService,
		UserService: mockUserService,
	})

	ctx := context.Background()
	provider := "test-provider"

	config := &SSOConfig{
		AutoCreateUsers: true,
	}

	userInfo := &interfaces.SSOUserInfo{
		Subject:   "sso-subject-123",
		Email:     "findcreate@example.com",
		FirstName: "Find",
		LastName:  "Create",
		Company:   "Test Corp",
	}

	t.Run("find existing user by SSO subject", func(t *testing.T) {
		// Create existing user with SSO info
		existingUser := &models.User{
			UserID:      "existing-sso-user",
			Email:       "findcreate@example.com",
			SSOProvider: &provider,
			SSOSubject:  &userInfo.Subject,
		}
		db.Create(existingUser)

		user, isNewUser, err := service.findOrCreateUser(ctx, userInfo, provider, config)

		require.NoError(t, err)
		assert.False(t, isNewUser)
		assert.Equal(t, existingUser.UserID, user.UserID)
		assert.Equal(t, existingUser.Email, user.Email)
	})

	t.Run("find existing user by email and link SSO", func(t *testing.T) {
		// Create existing user without SSO info
		existingUser := &models.User{
			UserID: "existing-email-user",
			Email:  "linkuser@example.com",
		}
		db.Create(existingUser)

		userInfoForLink := &interfaces.SSOUserInfo{
			Subject:   "link-sso-subject",
			Email:     "linkuser@example.com",
			FirstName: "Link",
			LastName:  "User",
		}

		mockUserService.On("GetUserByEmail", ctx, "linkuser@example.com").
			Return(existingUser, nil)

		user, isNewUser, err := service.findOrCreateUser(ctx, userInfoForLink, provider, config)

		require.NoError(t, err)
		assert.False(t, isNewUser)
		assert.Equal(t, existingUser.UserID, user.UserID)
		assert.Equal(t, &provider, user.SSOProvider)
		assert.Equal(t, &userInfoForLink.Subject, user.SSOSubject)

		mockUserService.AssertExpectations(t)
	})

	t.Run("create new user when auto-create enabled", func(t *testing.T) {
		newUserInfo := &interfaces.SSOUserInfo{
			Subject:   "new-user-subject",
			Email:     "newuser@example.com",
			FirstName: "New",
			LastName:  "User",
			Company:   "New Corp",
		}

		mockUserService.On("GetUserByEmail", ctx, "newuser@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		mockUserService.On("CreateUser", ctx, mock.AnythingOfType("*models.User")).
			Return(nil).Run(func(args mock.Arguments) {
			user := args.Get(1).(*models.User)
			user.UserID = "created-user-123"
		})

		user, isNewUser, err := service.findOrCreateUser(ctx, newUserInfo, provider, config)

		require.NoError(t, err)
		assert.True(t, isNewUser)
		assert.Equal(t, "created-user-123", user.UserID)
		assert.Equal(t, newUserInfo.Email, user.Email)
		assert.Equal(t, newUserInfo.FirstName, user.FirstName)
		assert.Equal(t, models.UserRoleDeveloper, user.Role) // Default role

		mockUserService.AssertExpectations(t)
	})

	t.Run("error when auto-create disabled and user not found", func(t *testing.T) {
		configNoAutoCreate := &SSOConfig{
			AutoCreateUsers: false,
		}

		newUserInfo := &interfaces.SSOUserInfo{
			Subject: "no-auto-create-subject",
			Email:   "noautocreate@example.com",
		}

		mockUserService.On("GetUserByEmail", ctx, "noautocreate@example.com").
			Return((*models.User)(nil), gorm.ErrRecordNotFound)

		user, isNewUser, err := service.findOrCreateUser(ctx, newUserInfo, provider, configNoAutoCreate)

		assert.Error(t, err)
		assert.False(t, isNewUser)
		assert.Nil(t, user)
		assert.Contains(t, err.Error(), "user not found and auto-creation is disabled")

		mockUserService.AssertExpectations(t)
	})
}

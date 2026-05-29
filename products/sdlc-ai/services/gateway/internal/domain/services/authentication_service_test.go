package services

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/security"
)

// Mock implementations for testing
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string, tenantID uuid.UUID) (*models.User, error) {
	args := m.Called(ctx, email, tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmailAcrossTenants(ctx context.Context, email string) ([]*models.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, tenantID uuid.UUID, filter repositories.UserFilter) ([]*models.User, error) {
	args := m.Called(ctx, tenantID, filter)
	return args.Get(0).([]*models.User), args.Error(1)
}

type MockTenantRepository struct {
	mock.Mock
}

func (m *MockTenantRepository) Create(ctx context.Context, tenant *models.Tenant) error {
	args := m.Called(ctx, tenant)
	return args.Error(0)
}

func (m *MockTenantRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) FindByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	args := m.Called(ctx, domain)
	return args.Get(0).(*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) Update(ctx context.Context, tenant *models.Tenant) error {
	args := m.Called(ctx, tenant)
	return args.Error(0)
}

func (m *MockTenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockTenantRepository) List(ctx context.Context, filter repositories.TenantFilter) ([]*models.Tenant, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]*models.Tenant), args.Error(1)
}

type MockSessionRepository struct {
	mock.Mock
}

func (m *MockSessionRepository) Create(ctx context.Context, session *models.UserSession) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockSessionRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.UserSession, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*models.UserSession, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) Update(ctx context.Context, session *models.UserSession) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockSessionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSessionRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

type MockJWTService struct {
	mock.Mock
}

func (m *MockJWTService) GenerateTokenPair(ctx context.Context, userID, tenantID uuid.UUID, email, role string, permissions []string, deviceFingerprint, sessionID string) (*TokenPair, error) {
	args := m.Called(ctx, userID, tenantID, email, role, permissions, deviceFingerprint, sessionID)
	return args.Get(0).(*TokenPair), args.Error(1)
}

func (m *MockJWTService) ValidateToken(ctx context.Context, tokenString string, expectedType string) (*TokenInfo, error) {
	args := m.Called(ctx, tokenString, expectedType)
	return args.Get(0).(*TokenInfo), args.Error(1)
}

func (m *MockJWTService) RefreshToken(ctx context.Context, refreshTokenString string, deviceFingerprint string) (*TokenPair, error) {
	args := m.Called(ctx, refreshTokenString, deviceFingerprint)
	return args.Get(0).(*TokenPair), args.Error(1)
}

func (m *MockJWTService) RevokeToken(ctx context.Context, tokenID string, expiresAt time.Time) error {
	args := m.Called(ctx, tokenID, expiresAt)
	return args.Error(0)
}

func (m *MockJWTService) IsTokenRevoked(ctx context.Context, tokenID string) (bool, error) {
	args := m.Called(ctx, tokenID)
	return args.Bool(0), args.Error(1)
}

func (m *MockJWTService) GenerateSecureKey(keyType string) (interface{}, error) {
	args := m.Called(keyType)
	return args.Get(0), args.Error(1)
}

func (m *MockJWTService) RotateKeys(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockJWTService) GetKeyInfo() KeyInfo {
	args := m.Called()
	return args.Get(0).(KeyInfo)
}

type MockBlacklistService struct {
	mock.Mock
}

func (m *MockBlacklistService) AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error {
	args := m.Called(ctx, tokenID, expiresAt)
	return args.Error(0)
}

func (m *MockBlacklistService) IsBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	args := m.Called(ctx, tokenID)
	return args.Bool(0), args.Error(1)
}

func (m *MockBlacklistService) RemoveFromBlacklist(ctx context.Context, tokenID string) error {
	args := m.Called(ctx, tokenID)
	return args.Error(0)
}

func (m *MockBlacklistService) CleanupExpired(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

type MockCredentialManager struct {
	mock.Mock
}

func (m *MockCredentialManager) StoreCredential(ctx context.Context, tenantID, createdBy uuid.UUID, name string, credType CredentialType, data []byte, metadata map[string]string, expiresAt *time.Time) (*security.Credential, error) {
	args := m.Called(ctx, tenantID, createdBy, name, credType, data, metadata, expiresAt)
	return args.Get(0).(*security.Credential), args.Error(1)
}

func (m *MockCredentialManager) GetCredential(ctx context.Context, id uuid.UUID, userID uuid.UUID) ([]byte, error) {
	args := m.Called(ctx, id, userID)
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockCredentialManager) GetCredentialByName(ctx context.Context, tenantID uuid.UUID, name string, userID uuid.UUID) ([]byte, error) {
	args := m.Called(ctx, tenantID, name, userID)
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockCredentialManager) UpdateCredential(ctx context.Context, id uuid.UUID, userID uuid.UUID, name string, data []byte, metadata map[string]string, expiresAt *time.Time) error {
	args := m.Called(ctx, id, userID, name, data, metadata, expiresAt)
	return args.Error(0)
}

func (m *MockCredentialManager) DeleteCredential(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockCredentialManager) RotateCredentialEncryption(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockCredentialManager) ListCredentials(ctx context.Context, tenantID uuid.UUID, filter security.CredentialFilter) ([]*security.Credential, error) {
	args := m.Called(ctx, tenantID, filter)
	return args.Get(0).([]*security.Credential), args.Error(1)
}

// Test Suite
type AuthenticationServiceTestSuite struct {
	suite.Suite
	authService      *AuthenticationService
	userRepo         *MockUserRepository
	tenantRepo       *MockTenantRepository
	sessionRepo      *MockSessionRepository
	jwtService       *MockJWTService
	credentialMgr    *MockCredentialManager
	blacklistService *MockBlacklistService
	config           AuthenticationConfig
}

func (suite *AuthenticationServiceTestSuite) SetupTest() {
	suite.userRepo = new(MockUserRepository)
	suite.tenantRepo = new(MockTenantRepository)
	suite.sessionRepo = new(MockSessionRepository)
	suite.jwtService = new(MockJWTService)
	suite.credentialMgr = new(MockCredentialManager)
	suite.blacklistService = new(MockBlacklistService)
	suite.config = DefaultAuthenticationConfig()

	suite.authService = NewAuthenticationService(
		suite.userRepo,
		suite.tenantRepo,
		suite.sessionRepo,
		suite.jwtService,
		suite.credentialMgr,
		suite.blacklistService,
		suite.config,
		nil, // logger
	)
}

// Test Authentication

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_Success() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	req := &AuthenticationRequest{
		Email:             "test@example.com",
		Password:          "password123",
		DeviceFingerprint: "device123",
		UserAgent:         "test-agent",
		IPAddress:         "192.168.1.1",
		RememberMe:        false,
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "test@example.com",
		PasswordHash:        "hashed_password",
		Role:                "user",
		IsActive:            true,
		EmailVerified:       true,
		MFAEnabled:          false,
		FailedLoginAttempts: 0,
		Permissions:         []string{"documents:read"},
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	tokenPair := &TokenPair{
		AccessToken:      "access_token",
		RefreshToken:     "refresh_token",
		ExpiresAt:        time.Now().Add(time.Hour),
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		TokenType:        "Bearer",
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, uuid.UUID{}).Return(user, nil)
	suite.jwtService.On("GenerateTokenPair", ctx, userID, tenantID, user.Email, user.Role, user.Permissions, req.DeviceFingerprint, mock.AnythingOfType("string")).Return(tokenPair, nil)
	suite.sessionRepo.On("Create", ctx, mock.AnythingOfType("*models.UserSession")).Return(nil)

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), user.Email, result.User.Email)
	assert.Equal(suite.T(), tokenPair, result.TokenPair)
	assert.False(suite.T(), result.RequiresMFA)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
	suite.jwtService.AssertExpectations(suite.T())
	suite.sessionRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_UserNotFound() {
	ctx := context.Background()
	req := &AuthenticationRequest{
		Email:    "nonexistent@example.com",
		Password: "password123",
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, uuid.UUID{}).Return(nil, assert.AnError)

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "authentication failed")

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_AccountLocked() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()
	lockoutUntil := time.Now().Add(15 * time.Minute)

	req := &AuthenticationRequest{
		Email:    "locked@example.com",
		Password: "password123",
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "locked@example.com",
		PasswordHash:        "hashed_password",
		Role:                "user",
		IsActive:            true,
		LockedUntil:         &lockoutUntil,
		FailedLoginAttempts: 5,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, uuid.UUID{}).Return(user, nil)

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err) // Should not return error for locked account
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 0, result.RemainingAttempts)
	assert.NotNil(suite.T(), result.LockoutRemaining)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_InvalidPassword() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	req := &AuthenticationRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "test@example.com",
		PasswordHash:        "hashed_password", // This won't match wrongpassword
		Role:                "user",
		IsActive:            true,
		FailedLoginAttempts: 0,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, uuid.UUID{}).Return(user, nil)
	suite.userRepo.On("Update", ctx, mock.MatchedBy(func(u *models.User) bool {
		return u.FailedLoginAttempts == 1
	})).Return(nil)

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 4, result.RemainingAttempts) // 5 - 1 attempt

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_MFARequired() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	req := &AuthenticationRequest{
		Email:    "mfa@example.com",
		Password: "password123",
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "mfa@example.com",
		PasswordHash:        "hashed_password",
		Role:                "user",
		IsActive:            true,
		MFAEnabled:          true,
		FailedLoginAttempts: 0,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, uuid.UUID{}).Return(user, nil)

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.True(suite.T(), result.RequiresMFA)
	assert.Contains(suite.T(), result.MFAMethods, "totp")
	assert.Nil(suite.T(), result.TokenPair) // No tokens until MFA is completed

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

// Test User Registration

func (suite *AuthenticationServiceTestSuite) TestRegisterUser_Success() {
	ctx := context.Background()
	tenantID := uuid.New()

	req := &RegistrationRequest{
		FirstName:       "John",
		LastName:        "Doe",
		Email:           "john.doe@example.com",
		Password:        "Password123!",
		ConfirmPassword: "Password123!",
		Role:            "user",
		Profile: map[string]string{
			"first_name": "John",
			"last_name":  "Doe",
		},
	}

	tenant := &models.Tenant{
		ID:     tenantID,
		Name:   "Test Tenant",
		Domain: "test.example.com",
		Status: "active",
	}

	user := &models.User{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Email:         req.Email,
		PasswordHash:  "hashed_password",
		Role:          "user",
		IsActive:      true,
		EmailVerified: false,
		Profile:       req.Profile,
		Permissions:   []string{"documents:read"},
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Setup mock expectations
	suite.tenantRepo.On("FindByDomain", ctx, mock.AnythingOfType("string")).Return(tenant, nil)
	suite.userRepo.On("FindByEmail", ctx, req.Email, tenantID).Return(nil, assert.AnError) // User doesn't exist
	suite.userRepo.On("Create", ctx, mock.MatchedBy(func(u *models.User) bool {
		return u.Email == req.Email && u.TenantID == tenantID
	})).Return(nil)

	// Execute test
	result, err := suite.authService.RegisterUser(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), req.Email, result.Email)
	assert.Equal(suite.T(), "John", result.Profile["first_name"])
	assert.Equal(suite.T(), "Doe", result.Profile["last_name"])

	// Verify mock calls
	suite.tenantRepo.AssertExpectations(suite.T())
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRegisterUser_InvalidPassword() {
	ctx := context.Background()

	req := &RegistrationRequest{
		FirstName:       "John",
		LastName:        "Doe",
		Email:           "john.doe@example.com",
		Password:        "weak", // Too short
		ConfirmPassword: "weak",
	}

	// Execute test
	result, err := suite.authService.RegisterUser(ctx, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "password does not meet security requirements")
}

func (suite *AuthenticationServiceTestSuite) TestRegisterUser_PasswordMismatch() {
	ctx := context.Background()

	req := &RegistrationRequest{
		FirstName:       "John",
		LastName:        "Doe",
		Email:           "john.doe@example.com",
		Password:        "Password123!",
		ConfirmPassword: "DifferentPassword123!",
	}

	// Execute test
	result, err := suite.authService.RegisterUser(ctx, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "passwords do not match")
}

// Test Password Change

func (suite *AuthenticationServiceTestSuite) TestChangePassword_Success() {
	ctx := context.Background()
	userID := uuid.New()

	req := &PasswordChangeRequest{
		CurrentPassword: "oldpassword123",
		NewPassword:     "newpassword123!",
		ConfirmPassword: "newpassword123!",
	}

	user := &models.User{
		ID:           userID,
		TenantID:     uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "hashed_old_password",
		Role:         "user",
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByID", ctx, userID).Return(user, nil)
	suite.userRepo.On("Update", ctx, mock.MatchedBy(func(u *models.User) bool {
		return u.PasswordHash != "hashed_old_password" // Password should be changed
	})).Return(nil)

	// Execute test
	err := suite.authService.ChangePassword(ctx, userID, req)

	// Assertions
	require.NoError(suite.T(), err)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestChangePassword_InvalidCurrentPassword() {
	ctx := context.Background()
	userID := uuid.New()

	req := &PasswordChangeRequest{
		CurrentPassword: "wrongpassword",
		NewPassword:     "newpassword123!",
		ConfirmPassword: "newpassword123!",
	}

	user := &models.User{
		ID:           userID,
		TenantID:     uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "hashed_old_password",
		Role:         "user",
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByID", ctx, userID).Return(user, nil)

	// Execute test
	err := suite.authService.ChangePassword(ctx, userID, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "current password is incorrect")

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestChangePassword_PasswordsDoNotMatch() {
	ctx := context.Background()
	userID := uuid.New()

	req := &PasswordChangeRequest{
		CurrentPassword: "oldpassword123",
		NewPassword:     "newpassword123!",
		ConfirmPassword: "differentpassword123!",
	}

	// Execute test
	err := suite.authService.ChangePassword(ctx, userID, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "passwords do not match")
}

// Test Password Reset

func (suite *AuthenticationServiceTestSuite) TestRequestPasswordReset_Success() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	req := &PasswordResetRequest{
		Email:     "test@example.com",
		TenantID:  tenantID.String(),
		IPAddress: "192.168.1.1",
	}

	user := &models.User{
		ID:       userID,
		TenantID: tenantID,
		Email:    req.Email,
		Role:     "user",
		IsActive: true,
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, tenantID).Return(user, nil)

	// Execute test
	err := suite.authService.RequestPasswordReset(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRequestPasswordReset_UserNotFound() {
	ctx := context.Background()
	tenantID := uuid.New()

	req := &PasswordResetRequest{
		Email:    "nonexistent@example.com",
		TenantID: tenantID.String(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, req.Email, tenantID).Return(nil, assert.AnError)

	// Execute test
	err := suite.authService.RequestPasswordReset(ctx, req)

	// Assertions
	require.NoError(suite.T(), err) // Should not error for security - don't reveal user existence

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestResetPassword_Success() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	token := "reset_token_123"
	email := "test@example.com"
	newPassword := "NewPassword123!"

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               email,
		PasswordHash:        "old_hashed_password",
		Role:                "user",
		IsActive:            true,
		FailedLoginAttempts: 3,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("FindByEmail", ctx, email, "").Return(user, nil)
	suite.userRepo.On("Update", ctx, mock.MatchedBy(func(u *models.User) bool {
		return u.PasswordHash != "old_hashed_password" && u.FailedLoginAttempts == 0
	})).Return(nil)

	// Execute test
	err := suite.authService.ResetPassword(ctx, token, email, newPassword)

	// Assertions
	require.NoError(suite.T(), err)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

// Test Token Refresh

func (suite *AuthenticationServiceTestSuite) TestRefreshToken_Success() {
	ctx := context.Background()
	refreshToken := "refresh_token_123"
	deviceFingerprint := "device123"

	tokenInfo := &TokenInfo{
		UserID:            uuid.New(),
		TenantID:          uuid.New(),
		Email:             "test@example.com",
		Role:              "user",
		Permissions:       []string{"documents:read"},
		TokenID:           "token_id_123",
		DeviceFingerprint: deviceFingerprint,
		TokenType:         "refresh",
		ExpiresAt:         time.Now().Add(24 * time.Hour),
		IssuedAt:          time.Now(),
	}

	newTokenPair := &TokenPair{
		AccessToken:      "new_access_token",
		RefreshToken:     "new_refresh_token",
		ExpiresAt:        time.Now().Add(time.Hour),
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		TokenType:        "Bearer",
	}

	// Setup mock expectations
	suite.jwtService.On("ValidateToken", ctx, refreshToken, "refresh").Return(tokenInfo, nil)
	suite.jwtService.On("RevokeToken", ctx, tokenInfo.TokenID, tokenInfo.ExpiresAt).Return(nil)
	suite.jwtService.On("GenerateTokenPair", ctx, tokenInfo.UserID, tokenInfo.TenantID, tokenInfo.Email, tokenInfo.Role, tokenInfo.Permissions, tokenInfo.DeviceFingerprint, tokenInfo.SessionID).Return(newTokenPair, nil)

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, deviceFingerprint)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), newTokenPair, result)

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRefreshToken_InvalidToken() {
	ctx := context.Background()
	refreshToken := "invalid_token"

	// Setup mock expectations
	suite.jwtService.On("ValidateToken", ctx, refreshToken, "refresh").Return(nil, assert.AnError)

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, "")

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "failed to refresh token")

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRefreshToken_DeviceMismatch() {
	ctx := context.Background()
	refreshToken := "refresh_token_123"
	deviceFingerprint := "different_device"

	tokenInfo := &TokenInfo{
		UserID:            uuid.New(),
		TenantID:          uuid.New(),
		Email:             "test@example.com",
		Role:              "user",
		Permissions:       []string{"documents:read"},
		TokenID:           "token_id_123",
		DeviceFingerprint: "original_device",
		TokenType:         "refresh",
		ExpiresAt:         time.Now().Add(24 * time.Hour),
		IssuedAt:          time.Now(),
	}

	// Setup mock expectations
	suite.jwtService.On("ValidateToken", ctx, refreshToken, "refresh").Return(tokenInfo, nil)

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, deviceFingerprint)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "failed to refresh token")

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

// Test Logout

func (suite *AuthenticationServiceTestSuite) TestLogout_Success() {
	ctx := context.Background()
	accessToken := "access_token_123"
	refreshToken := "refresh_token_123"
	userID := uuid.New()

	accessTokensInfo := &TokenInfo{
		UserID:    userID,
		TokenID:   "access_token_id_123",
		TokenType: "access",
		ExpiresAt: time.Now().Add(time.Hour),
	}

	refreshTokenInfo := &TokenInfo{
		UserID:    userID,
		TokenID:   "refresh_token_id_123",
		TokenType: "refresh",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	// Setup mock expectations
	suite.jwtService.On("ValidateToken", ctx, accessToken, "access").Return(accessTokensInfo, nil)
	suite.jwtService.On("RevokeToken", ctx, accessTokensInfo.TokenID, accessTokensInfo.ExpiresAt).Return(nil)
	suite.jwtService.On("ValidateToken", ctx, refreshToken, "refresh").Return(refreshTokenInfo, nil)
	suite.jwtService.On("RevokeToken", ctx, refreshTokenInfo.TokenID, refreshTokenInfo.ExpiresAt).Return(nil)

	// Execute test
	err := suite.authService.Logout(ctx, accessToken, refreshToken, userID)

	// Assertions
	require.NoError(suite.T(), err)

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestLogout_InvalidAccessToken() {
	ctx := context.Background()
	accessToken := "invalid_access_token"
	refreshToken := "refresh_token_123"
	userID := uuid.New()

	// Setup mock expectations
	suite.jwtService.On("ValidateToken", ctx, accessToken, "access").Return(nil, assert.AnError)
	// Still try to revoke refresh token if provided
	suite.jwtService.On("ValidateToken", ctx, refreshToken, "refresh").Return(&TokenInfo{
		UserID:    userID,
		TokenID:   "refresh_token_id_123",
		TokenType: "refresh",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}, nil)
	suite.jwtService.On("RevokeToken", ctx, "refresh_token_id_123", mock.AnythingOfType("time.Time")).Return(nil)

	// Execute test
	err := suite.authService.Logout(ctx, accessToken, refreshToken, userID)

	// Assertions
	require.NoError(suite.T(), err) // Should not error even with invalid access token

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

// Test Utility Functions

func (suite *AuthenticationServiceTestSuite) TestValidatePasswordStrength() {
	tests := []struct {
		name     string
		password string
		valid    bool
	}{
		{
			name:     "Valid password with all requirements",
			password: "Password123!",
			valid:    true,
		},
		{
			name:     "Too short",
			password: "Pass1!",
			valid:    false,
		},
		{
			name:     "Missing uppercase",
			password: "password123!",
			valid:    false,
		},
		{
			name:     "Missing lowercase",
			password: "PASSWORD123!",
			valid:    false,
		},
		{
			name:     "Missing numbers",
			password: "Password!",
			valid:    false,
		},
		{
			name:     "Valid without symbols (not required)",
			password: "Password123",
			valid:    true,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := suite.authService.validatePasswordStrength(tt.password)
			assert.Equal(suite.T(), tt.valid, result)
		})
	}
}

func (suite *AuthenticationServiceTestSuite) TestHashPassword() {
	password := "test_password_123"

	// Execute test
	hashedPassword, err := suite.authService.hashPassword(password)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), hashedPassword)
	assert.NotEqual(suite.T(), password, hashedPassword)
}

func (suite *AuthenticationServiceTestSuite) TestVerifyPassword() {
	password := "test_password_123"

	// Hash password first
	hashedPassword, err := suite.authService.hashPassword(password)
	require.NoError(suite.T(), err)

	// Test correct password
	isValid := suite.authService.verifyPassword(hashedPassword, password)
	assert.True(suite.T(), isValid)

	// Test incorrect password
	isValid = suite.authService.verifyPassword(hashedPassword, "wrong_password")
	assert.False(suite.T(), isValid)
}

func (suite *AuthenticationServiceTestSuite) TestGenerateSecureToken() {
	// Execute test
	token, err := suite.authService.generateSecureToken()

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), token)

	// Tokens should be unique
	token2, err := suite.authService.generateSecureToken()
	require.NoError(suite.T(), err)
	assert.NotEqual(suite.T(), token, token2)
}

func (suite *AuthenticationServiceTestSuite) TestGetDefaultPermissions() {
	tests := []struct {
		role          string
		expectedPerms []string
	}{
		{
			role:          "super_admin",
			expectedPerms: []string{"*"},
		},
		{
			role:          "tenant_admin",
			expectedPerms: []string{"users:*", "documents:*", "policies:*", "settings:*"},
		},
		{
			role:          "data_scientist",
			expectedPerms: []string{"documents:read", "documents:write", "vectors:*", "search:*"},
		},
		{
			role:          "analyst",
			expectedPerms: []string{"documents:read", "search:*", "export:*"},
		},
		{
			role:          "viewer",
			expectedPerms: []string{"documents:read"},
		},
		{
			role:          "unknown_role",
			expectedPerms: []string{"documents:read"},
		},
	}

	for _, tt := range tests {
		suite.Run(tt.role, func() {
			permissions := suite.authService.getDefaultPermissions(tt.role)
			assert.Equal(suite.T(), tt.expectedPerms, permissions)
		})
	}
}

// Benchmark tests
func (suite *AuthenticationServiceTestSuite) BenchmarkHashPassword(b *testing.B) {
	password := "test_password_123"
	authService := suite.authService

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := authService.hashPassword(password)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func (suite *AuthenticationServiceTestSuite) BenchmarkVerifyPassword(b *testing.B) {
	password := "test_password_123"
	authService := suite.authService

	hashedPassword, err := authService.hashPassword(password)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		authService.verifyPassword(hashedPassword, password)
	}
}

// Run the test suite
func TestAuthenticationService(t *testing.T) {
	suite.Run(t, new(AuthenticationServiceTestSuite))
}

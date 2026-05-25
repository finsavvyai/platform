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
)

// MockUserRepository mocks the UserRepository interface
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*models.User, error) {
	args := m.Called(ctx, tenantID, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.UserFilter) ([]*models.User, error) {
	args := m.Called(ctx, tenantID, filter)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) GetActiveUsers(ctx context.Context, tenantID uuid.UUID) ([]*models.User, error) {
	args := m.Called(ctx, tenantID)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByRole(ctx context.Context, tenantID uuid.UUID, role models.UserRole) ([]*models.User, error) {
	args := m.Called(ctx, tenantID, role)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) IncrementFailedLogin(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) ResetFailedLogin(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) LockAccount(ctx context.Context, id uuid.UUID, duration int) error {
	args := m.Called(ctx, id, duration)
	return args.Error(0)
}

func (m *MockUserRepository) UnlockAccount(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) GetUserCount(ctx context.Context, tenantID uuid.UUID) (int, error) {
	args := m.Called(ctx, tenantID)
	return args.Int(0), args.Error(1)
}

func (m *MockUserRepository) SearchUsers(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.User, error) {
	args := m.Called(ctx, tenantID, query, limit, offset)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(ctx context.Context, id uuid.UUID, updates interface{}) error {
	args := m.Called(ctx, id, updates)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, filter interface{}, limit, offset int) ([]*models.User, error) {
	args := m.Called(ctx, filter, limit, offset)
	return args.Get(0).([]*models.User), args.Error(1)
}

func (m *MockUserRepository) Count(ctx context.Context, filter interface{}) (int, error) {
	args := m.Called(ctx, filter)
	return args.Int(0), args.Error(1)
}

// MockTenantRepository mocks the TenantRepository interface
type MockTenantRepository struct {
	mock.Mock
}

func (m *MockTenantRepository) Create(ctx context.Context, tenant *models.Tenant) error {
	args := m.Called(ctx, tenant)
	return args.Error(0)
}

func (m *MockTenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) GetByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	args := m.Called(ctx, domain)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) GetActive(ctx context.Context) ([]*models.Tenant, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) GetBySubscriptionTier(ctx context.Context, tier string) ([]*models.Tenant, error) {
	args := m.Called(ctx, tier)
	return args.Get(0).([]*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.TenantStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockTenantRepository) CheckDomainExists(ctx context.Context, domain string) (bool, error) {
	args := m.Called(ctx, domain)
	return args.Bool(0), args.Error(1)
}

func (m *MockTenantRepository) GetTenantCount(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockTenantRepository) Update(ctx context.Context, id uuid.UUID, updates interface{}) error {
	args := m.Called(ctx, id, updates)
	return args.Error(0)
}

func (m *MockTenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockTenantRepository) List(ctx context.Context, filter interface{}, limit, offset int) ([]*models.Tenant, error) {
	args := m.Called(ctx, filter, limit, offset)
	return args.Get(0).([]*models.Tenant), args.Error(1)
}

func (m *MockTenantRepository) Count(ctx context.Context, filter interface{}) (int, error) {
	args := m.Called(ctx, filter)
	return args.Int(0), args.Error(1)
}

// MockSessionRepository mocks the SessionRepository interface
type MockSessionRepository struct {
	mock.Mock
}

func (m *MockSessionRepository) Create(ctx context.Context, session *models.UserSession) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockSessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.UserSession, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) GetByToken(ctx context.Context, sessionToken string) (*models.UserSession, error) {
	args := m.Called(ctx, sessionToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*models.UserSession, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) GetActiveSessions(ctx context.Context, userID uuid.UUID) ([]*models.UserSession, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) RevokeSession(ctx context.Context, sessionToken string) error {
	args := m.Called(ctx, sessionToken)
	return args.Error(0)
}

func (m *MockSessionRepository) RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockSessionRepository) CleanupExpiredSessions(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockSessionRepository) UpdateLastActivity(ctx context.Context, sessionToken string) error {
	args := m.Called(ctx, sessionToken)
	return args.Error(0)
}

func (m *MockSessionRepository) Update(ctx context.Context, id uuid.UUID, updates interface{}) error {
	args := m.Called(ctx, id, updates)
	return args.Error(0)
}

func (m *MockSessionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSessionRepository) List(ctx context.Context, filter interface{}, limit, offset int) ([]*models.UserSession, error) {
	args := m.Called(ctx, filter, limit, offset)
	return args.Get(0).([]*models.UserSession), args.Error(1)
}

func (m *MockSessionRepository) Count(ctx context.Context, filter interface{}) (int, error) {
	args := m.Called(ctx, filter)
	return args.Int(0), args.Error(1)
}

// MockJWTService mocks the JWTService interface
type MockJWTService struct {
	mock.Mock
}

func (m *MockJWTService) GenerateTokenPair(ctx context.Context, userID, tenantID uuid.UUID, email, role string, permissions []string, deviceFingerprint, sessionID string) (*TokenPair, error) {
	args := m.Called(ctx, userID, tenantID, email, role, permissions, deviceFingerprint, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*TokenPair), args.Error(1)
}

func (m *MockJWTService) ValidateToken(ctx context.Context, tokenString string, expectedType string) (*TokenInfo, error) {
	args := m.Called(ctx, tokenString, expectedType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*TokenInfo), args.Error(1)
}

func (m *MockJWTService) RefreshToken(ctx context.Context, refreshTokenString string, deviceFingerprint string) (*TokenPair, error) {
	args := m.Called(ctx, refreshTokenString, deviceFingerprint)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
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

// MockBlacklistService mocks the BlacklistService interface
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

// Test Suite
type AuthenticationServiceTestSuite struct {
	suite.Suite
	authService      *AuthenticationService
	userRepo         *MockUserRepository
	tenantRepo       *MockTenantRepository
	sessionRepo      *MockSessionRepository
	jwtService       *MockJWTService
	blacklistService *MockBlacklistService
	config           AuthenticationConfig
}

func (suite *AuthenticationServiceTestSuite) SetupTest() {
	suite.userRepo = new(MockUserRepository)
	suite.tenantRepo = new(MockTenantRepository)
	suite.sessionRepo = new(MockSessionRepository)
	suite.jwtService = new(MockJWTService)
	suite.blacklistService = new(MockBlacklistService)
	suite.config = DefaultAuthenticationConfig()

	suite.authService = NewAuthenticationService(
		suite.userRepo,
		suite.tenantRepo,
		suite.sessionRepo,
		suite.jwtService,
		suite.blacklistService,
		nil, // cache
		nil, // metricsCollector
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
		Password:          "Password123!",
		DeviceFingerprint: "device123",
		UserAgent:         "test-agent",
		IPAddress:         "192.168.1.1",
		RememberMe:        false,
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "test@example.com",
		PasswordHash:        "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.", // bcrypt hash of "Password123!"
		Role:                models.RoleUser,
		IsActive:            true,
		EmailVerified:       true,
		MFAEnabled:          false,
		FailedLoginAttempts: 0,
		Permissions:         models.JSONB{"documents": "read"},
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

	// Setup mock expectations - use mock.Anything for all context and UUID params since
	// the authentication service internally derives tenantID from the user
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(user, nil).Once()
	// completeAuthentication calls Update to update last login
	suite.userRepo.On("Update", mock.Anything, mock.Anything, mock.AnythingOfType("*models.User")).Return(nil).Once()
	suite.jwtService.On("GenerateTokenPair", mock.Anything, userID, mock.Anything, user.Email, string(user.Role), mock.Anything, req.DeviceFingerprint, mock.AnythingOfType("string")).Return(tokenPair, nil).Once()
	// Session creation is optional and may fail silently, so we don't enforce the expectation
	suite.sessionRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.UserSession")).Return(nil).Maybe()

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), user.Email, result.User.Email)
	assert.Equal(suite.T(), tokenPair.AccessToken, result.TokenPair.AccessToken)
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
		Password: "Password123!",
	}

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(nil, assert.AnError).Once()

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)

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
		Password: "Password123!",
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "locked@example.com",
		PasswordHash:        "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:                models.RoleUser,
		IsActive:            true,
		LockedUntil:         &lockoutUntil,
		FailedLoginAttempts: 5,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(user, nil).Once()

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
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
		PasswordHash:        "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:                models.RoleUser,
		IsActive:            true,
		FailedLoginAttempts: 0,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	// The authentication service internally derives tenantID from the user
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(user, nil).Once()
	// handleFailedLogin calls Update to increment failed login attempts
	suite.userRepo.On("Update", mock.Anything, mock.Anything, mock.AnythingOfType("*models.User")).Return(nil).Once()

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 4, result.RemainingAttempts)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestAuthenticate_MFARequired() {
	ctx := context.Background()
	userID := uuid.New()
	tenantID := uuid.New()

	req := &AuthenticationRequest{
		Email:    "mfa@example.com",
		Password: "Password123!",
	}

	user := &models.User{
		ID:                  userID,
		TenantID:            tenantID,
		Email:               "mfa@example.com",
		PasswordHash:        "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:                models.RoleUser,
		IsActive:            true,
		MFAEnabled:          true,
		FailedLoginAttempts: 0,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(user, nil).Once()

	// Execute test
	result, err := suite.authService.Authenticate(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.True(suite.T(), result.RequiresMFA)
	assert.Contains(suite.T(), result.MFAMethods, "totp")
	assert.Nil(suite.T(), result.TokenPair)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

// Test User Registration

func (suite *AuthenticationServiceTestSuite) TestRegisterUser_Success() {
	ctx := context.Background()
	tenantID := uuid.New()

	req := &RegistrationRequest{
		TenantID:        tenantID.String(),
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

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(nil, assert.AnError).Once()
	suite.userRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.User")).Return(nil).Once()

	// Execute test
	result, err := suite.authService.RegisterUser(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), req.Email, result.Email)

	// Verify mock calls
	suite.userRepo.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRegisterUser_InvalidPassword() {
	ctx := context.Background()

	req := &RegistrationRequest{
		FirstName:       "John",
		LastName:        "Doe",
		Email:           "john.doe@example.com",
		Password:        "weak",
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
		CurrentPassword: "Password123!",
		NewPassword:     "Newpassword123!",
		ConfirmPassword: "Newpassword123!",
	}

	user := &models.User{
		ID:           userID,
		TenantID:     uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:         models.RoleUser,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("GetByID", mock.Anything, userID).Return(user, nil).Once()
	suite.userRepo.On("Update", mock.Anything, userID, mock.Anything).Return(nil).Once()

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
		NewPassword:     "Newpassword123!",
		ConfirmPassword: "Newpassword123!",
	}

	user := &models.User{
		ID:           userID,
		TenantID:     uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:         models.RoleUser,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("GetByID", mock.Anything, userID).Return(user, nil).Once()

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
		CurrentPassword: "Password123!",
		NewPassword:     "Newpassword123!",
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
		Role:     models.RoleUser,
		IsActive: true,
	}

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, req.Email).Return(user, nil).Once()

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
	suite.userRepo.On("GetByEmail", mock.Anything, tenantID, req.Email).Return(nil, assert.AnError).Once()

	// Execute test
	err := suite.authService.RequestPasswordReset(ctx, req)

	// Assertions
	require.NoError(suite.T(), err)

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
		PasswordHash:        "$2a$12$Q8rolyTMVSx510DVNHp0M.xfRrxza0cLraNogbPME2uETwGRvZr8.",
		Role:                models.RoleUser,
		IsActive:            true,
		FailedLoginAttempts: 3,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Setup mock expectations
	suite.userRepo.On("GetByEmail", mock.Anything, mock.Anything, email).Return(user, nil).Once()
	suite.userRepo.On("Update", mock.Anything, userID, mock.Anything).Return(nil).Once()

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

	newTokenPair := &TokenPair{
		AccessToken:      "new_access_token",
		RefreshToken:     "new_refresh_token",
		ExpiresAt:        time.Now().Add(time.Hour),
		RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		TokenType:        "Bearer",
	}

	// Setup mock expectations
	suite.jwtService.On("RefreshToken", mock.Anything, refreshToken, deviceFingerprint).Return(newTokenPair, nil).Once()

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, deviceFingerprint)

	// Assertions
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), newTokenPair.AccessToken, result.AccessToken)

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRefreshToken_InvalidToken() {
	ctx := context.Background()
	refreshToken := "invalid_token"

	// Setup mock expectations
	suite.jwtService.On("RefreshToken", mock.Anything, refreshToken, "").Return(nil, assert.AnError).Once()

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, "")

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)

	// Verify mock calls
	suite.jwtService.AssertExpectations(suite.T())
}

func (suite *AuthenticationServiceTestSuite) TestRefreshToken_DeviceMismatch() {
	ctx := context.Background()
	refreshToken := "refresh_token_123"
	deviceFingerprint := "different_device"

	// Setup mock expectations - RefreshToken returns error when device fingerprint doesn't match
	suite.jwtService.On("RefreshToken", mock.Anything, refreshToken, deviceFingerprint).Return(nil, assert.AnError).Once()

	// Execute test
	result, err := suite.authService.RefreshToken(ctx, refreshToken, deviceFingerprint)

	// Assertions
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)

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
	suite.jwtService.On("ValidateToken", mock.Anything, accessToken, "access").Return(accessTokensInfo, nil).Once()
	suite.jwtService.On("RevokeToken", mock.Anything, accessTokensInfo.TokenID, accessTokensInfo.ExpiresAt).Return(nil).Once()
	suite.jwtService.On("ValidateToken", mock.Anything, refreshToken, "refresh").Return(refreshTokenInfo, nil).Once()
	suite.jwtService.On("RevokeToken", mock.Anything, refreshTokenInfo.TokenID, refreshTokenInfo.ExpiresAt).Return(nil).Once()

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
	suite.jwtService.On("ValidateToken", mock.Anything, accessToken, "access").Return(nil, assert.AnError).Once()
	suite.jwtService.On("ValidateToken", mock.Anything, refreshToken, "refresh").Return(&TokenInfo{
		UserID:    userID,
		TokenID:   "refresh_token_id_123",
		TokenType: "refresh",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}, nil).Once()
	suite.jwtService.On("RevokeToken", mock.Anything, "refresh_token_id_123", mock.AnythingOfType("time.Time")).Return(nil).Once()

	// Execute test
	err := suite.authService.Logout(ctx, accessToken, refreshToken, userID)

	// Assertions
	require.NoError(suite.T(), err)

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
			expectedPerms: []string{"documents:read", "search:read"},
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

// Run the test suite
func TestAuthenticationService(t *testing.T) {
	suite.Run(t, new(AuthenticationServiceTestSuite))
}

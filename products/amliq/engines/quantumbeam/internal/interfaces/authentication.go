package interfaces

import (
	"context"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"quantumbeam/internal/models"
)

// AuthService defines the authentication service interface
type AuthService interface {
	// JWT Authentication
	AuthenticateJWT(ctx context.Context, token string) (*models.User, error)
	GenerateJWT(ctx context.Context, user *models.User) (*JWTTokens, error)
	RefreshJWT(ctx context.Context, refreshToken string) (*JWTTokens, error)
	ValidateJWT(ctx context.Context, token string) (*JWTClaims, error)
	RevokeJWT(ctx context.Context, token string) error

	// API Key Authentication
	ValidateAPIKey(ctx context.Context, apiKey string) (*models.APIKey, error)
	GenerateAPIKey(ctx context.Context, userID string, tier models.PricingTier, name string) (*APIKeyResponse, error)
	RevokeAPIKey(ctx context.Context, keyID string) error
	RotateAPIKey(ctx context.Context, keyID string) (*APIKeyResponse, error)
	ListAPIKeys(ctx context.Context, userID string) ([]*models.APIKey, error)

	// SSO Authentication
	ProcessSSOLogin(ctx context.Context, provider string, assertion string) (*SSOResult, error)
	ConfigureSSO(ctx context.Context, config *SSOConfig) error
	ValidateSSOAssertion(ctx context.Context, provider string, assertion string) (*SSOUserInfo, error)
	GetSSOProviders(ctx context.Context) ([]SSOProvider, error)
}

// UserService defines the user management interface
type UserService interface {
	// User CRUD operations
	CreateUser(ctx context.Context, user *models.User) error
	GetUser(ctx context.Context, userID string) (*models.User, error)
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	UpdateUser(ctx context.Context, user *models.User) error
	DeleteUser(ctx context.Context, userID string) error
	ListUsers(ctx context.Context, filters *UserFilters) ([]*models.User, error)

	// User status management
	ActivateUser(ctx context.Context, userID string) error
	DeactivateUser(ctx context.Context, userID string) error
	UpdateLastLogin(ctx context.Context, userID string) error

	// Role and permission management
	UpdateUserRole(ctx context.Context, userID string, role models.UserRole) error
	CheckPermission(ctx context.Context, userID string, permission string) (bool, error)
	GetUserPermissions(ctx context.Context, userID string) ([]string, error)
}

// SessionService defines session management interface
type SessionService interface {
	CreateSession(ctx context.Context, userID string, metadata *SessionMetadata) (*Session, error)
	GetSession(ctx context.Context, sessionID string) (*Session, error)
	UpdateSession(ctx context.Context, sessionID string, metadata *SessionMetadata) error
	DeleteSession(ctx context.Context, sessionID string) error
	CleanupExpiredSessions(ctx context.Context) error
	GetUserSessions(ctx context.Context, userID string) ([]*Session, error)
}

// RateLimitService defines rate limiting interface
type RateLimitService interface {
	CheckRateLimit(ctx context.Context, key string, limit int, window int) (*RateLimitResult, error)
	IncrementCounter(ctx context.Context, key string, window int) error
	GetRateLimitStatus(ctx context.Context, key string) (*RateLimitStatus, error)
	ResetRateLimit(ctx context.Context, key string) error
}

// Supporting types for authentication interfaces

// JWTTokens represents JWT token pair
type JWTTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID    string          `json:"user_id"`
	Email     string          `json:"email"`
	Role      models.UserRole `json:"role"`
	IssuedAt  int64           `json:"iat"`
	ExpiresAt int64           `json:"exp"`
	Subject   string          `json:"sub"`
	Issuer    string          `json:"iss"`
	Audience  string          `json:"aud"`
}

// GetExpirationTime implements jwt.Claims interface
func (c *JWTClaims) GetExpirationTime() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(time.Unix(c.ExpiresAt, 0)), nil
}

// GetIssuedAt implements jwt.Claims interface
func (c *JWTClaims) GetIssuedAt() (*jwt.NumericDate, error) {
	return jwt.NewNumericDate(time.Unix(c.IssuedAt, 0)), nil
}

// GetNotBefore implements jwt.Claims interface
func (c *JWTClaims) GetNotBefore() (*jwt.NumericDate, error) {
	return nil, nil
}

// GetIssuer implements jwt.Claims interface
func (c *JWTClaims) GetIssuer() (string, error) {
	return c.Issuer, nil
}

// GetSubject implements jwt.Claims interface
func (c *JWTClaims) GetSubject() (string, error) {
	return c.Subject, nil
}

// GetAudience implements jwt.Claims interface
func (c *JWTClaims) GetAudience() (jwt.ClaimStrings, error) {
	return jwt.ClaimStrings{c.Audience}, nil
}

// APIKeyResponse represents API key generation response
type APIKeyResponse struct {
	KeyID     string             `json:"key_id"`
	Key       string             `json:"key"`
	Name      string             `json:"name"`
	UsageTier models.PricingTier `json:"usage_tier"`
	RateLimit int                `json:"rate_limit"`
	CreatedAt int64              `json:"created_at"`
	ExpiresAt *int64             `json:"expires_at,omitempty"`
}

// SSOResult represents SSO authentication result
type SSOResult struct {
	User       *models.User `json:"user"`
	IsNewUser  bool         `json:"is_new_user"`
	Tokens     *JWTTokens   `json:"tokens"`
	Provider   string       `json:"provider"`
	SSOSubject string       `json:"sso_subject"`
}

// SSOConfig represents SSO provider configuration
type SSOConfig struct {
	Provider        string            `json:"provider"`
	EntityID        string            `json:"entity_id"`
	SSOUrl          string            `json:"sso_url"`
	Certificate     string            `json:"certificate"`
	AttributeMap    map[string]string `json:"attribute_map"`
	IsActive        bool              `json:"is_active"`
	AutoCreateUsers bool              `json:"auto_create_users"`
}

// SSOUserInfo represents user information from SSO provider
type SSOUserInfo struct {
	Subject    string            `json:"subject"`
	Email      string            `json:"email"`
	FirstName  string            `json:"first_name"`
	LastName   string            `json:"last_name"`
	Company    string            `json:"company"`
	Attributes map[string]string `json:"attributes"`
}

// SSOProvider represents available SSO providers
type SSOProvider struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"` // saml, oidc
	IsActive    bool   `json:"is_active"`
	LoginURL    string `json:"login_url"`
}

// UserFilters represents filters for user listing
type UserFilters struct {
	Role          *models.UserRole `json:"role,omitempty"`
	IsActive      *bool            `json:"is_active,omitempty"`
	Company       *string          `json:"company,omitempty"`
	CreatedAfter  *int64           `json:"created_after,omitempty"`
	CreatedBefore *int64           `json:"created_before,omitempty"`
	Limit         int              `json:"limit"`
	Offset        int              `json:"offset"`
}

// Session represents a user session
type Session struct {
	SessionID string           `json:"session_id"`
	UserID    string           `json:"user_id"`
	CreatedAt int64            `json:"created_at"`
	ExpiresAt int64            `json:"expires_at"`
	IsActive  bool             `json:"is_active"`
	Metadata  *SessionMetadata `json:"metadata"`
}

// SessionMetadata represents session metadata
type SessionMetadata struct {
	IPAddress    string              `json:"ip_address"`
	UserAgent    string              `json:"user_agent"`
	Location     *models.GeoLocation `json:"location,omitempty"`
	DeviceInfo   map[string]string   `json:"device_info"`
	LastActivity int64               `json:"last_activity"`
}

// RateLimitResult represents rate limit check result
type RateLimitResult struct {
	Allowed    bool  `json:"allowed"`
	Remaining  int   `json:"remaining"`
	ResetTime  int64 `json:"reset_time"`
	RetryAfter int   `json:"retry_after,omitempty"`
}

// RateLimitStatus represents current rate limit status
type RateLimitStatus struct {
	Key         string `json:"key"`
	Current     int    `json:"current"`
	Limit       int    `json:"limit"`
	WindowStart int64  `json:"window_start"`
	WindowEnd   int64  `json:"window_end"`
	ResetTime   int64  `json:"reset_time"`
}

package services

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/sso"
)

// SSOService defines the interface for SSO business logic
type SSOService interface {
	// Provider Management

	// CreateProvider creates a new SSO provider
	CreateProvider(ctx context.Context, name string, providerType sso.SSOProviderType, config map[string]interface{}) (*sso.SSOProvider, error)

	// GetProvider retrieves an SSO provider by ID
	GetProvider(ctx context.Context, id string) (*sso.SSOProvider, error)

	// GetProvidersByType retrieves SSO providers by type
	GetProvidersByType(ctx context.Context, providerType sso.SSOProviderType) ([]*sso.SSOProvider, error)

	// GetEnabledProviders retrieves all enabled SSO providers
	GetEnabledProviders(ctx context.Context) ([]*sso.SSOProvider, error)

	// UpdateProvider updates an SSO provider
	UpdateProvider(ctx context.Context, provider *sso.SSOProvider) error

	// DeleteProvider deletes an SSO provider
	DeleteProvider(ctx context.Context, id string) error

	// ListProviders lists SSO providers with pagination
	ListProviders(ctx context.Context, limit, offset int) ([]*sso.SSOProvider, error)

	// TestProvider tests the configuration of an SSO provider
	TestProvider(ctx context.Context, providerID string) error

	// SAML Authentication

	// InitiateSAMLLogin initiates a SAML SSO login flow
	InitiateSAMLLogin(ctx context.Context, providerID, redirectURL string) (*sso.SSOSession, string, error)

	// ProcessSAMLResponse processes a SAML response from the IdP
	ProcessSAMLResponse(ctx context.Context, requestID, samlResponse string) (*entities.User, string, error)

	// GetSAMLMetadata returns the SAML metadata for our service
	GetSAMLMetadata(ctx context.Context, providerID string) (string, error)

	// OIDC Authentication

	// InitiateOIDCLogin initiates an OIDC SSO login flow
	InitiateOIDCLogin(ctx context.Context, providerID, redirectURL string) (*sso.SSOSession, string, error)

	// ProcessOIDCCallback processes an OIDC callback from the IdP
	ProcessOIDCCallback(ctx context.Context, state, code string) (*entities.User, string, error)

	// RefreshOIDCToken refreshes an OIDC token
	RefreshOIDCToken(ctx context.Context, identityID string) error

	// Identity Management

	// GetIdentity retrieves an SSO identity by ID
	GetIdentity(ctx context.Context, id string) (*sso.SSOIdentity, error)

	// GetIdentityByProviderAndExternalID retrieves an identity by provider and external ID
	GetIdentityByProviderAndExternalID(ctx context.Context, providerID, externalID string) (*sso.SSOIdentity, error)

	// GetIdentitiesByUser retrieves all identities for a user
	GetIdentitiesByUser(ctx context.Context, userID string) ([]*sso.SSOIdentity, error)

	// LinkIdentityToUser links an SSO identity to a user account
	LinkIdentityToUser(ctx context.Context, identityID, userID string) error

	// UnlinkIdentityFromUser unlinks an SSO identity from a user account
	UnlinkIdentityFromUser(ctx context.Context, identityID string) error

	// DeleteIdentity deletes an SSO identity
	DeleteIdentity(ctx context.Context, identityID string) error

	// Enterprise Management

	// CreateEnterpriseSettings creates enterprise SSO settings
	CreateEnterpriseSettings(ctx context.Context, organizationID, providerID string) (*sso.EnterpriseSettings, error)

	// GetEnterpriseSettings retrieves enterprise settings by organization
	GetEnterpriseSettings(ctx context.Context, organizationID string) (*sso.EnterpriseSettings, error)

	// UpdateEnterpriseSettings updates enterprise settings
	UpdateEnterpriseSettings(ctx context.Context, settings *sso.EnterpriseSettings, config map[string]interface{}) error

	// DeleteEnterpriseSettings deletes enterprise settings
	DeleteEnterpriseSettings(ctx context.Context, id string) error

	// ListEnterpriseSettings lists enterprise settings with pagination
	ListEnterpriseSettings(ctx context.Context, limit, offset int) ([]*sso.EnterpriseSettings, error)

	// Session Management

	// GetSession retrieves an SSO session by ID
	GetSession(ctx context.Context, id string) (*sso.SSOSession, error)

	// GetSessionByState retrieves an SSO session by state
	GetSessionByState(ctx context.Context, state string) (*sso.SSOSession, error)

	// ValidateSession validates an SSO session
	ValidateSession(ctx context.Context, sessionID string) (*sso.SSOIdentity, error)

	// InvalidateSession invalidates an SSO session
	InvalidateSession(ctx context.Context, sessionID string) error

	// InvalidateUserSessions invalidates all sessions for a user
	InvalidateUserSessions(ctx context.Context, userID string) error

	// CleanupExpiredSessions cleans up expired sessions
	CleanupExpiredSessions(ctx context.Context) error

	// User Provisioning

	// ProvisionUser provisions a new user from SSO identity
	ProvisionUser(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) (*entities.User, error)

	// UpdateUserFromIdentity updates user attributes from SSO identity
	UpdateUserFromIdentity(ctx context.Context, user *entities.User, identity *sso.SSOIdentity, provider *sso.SSOProvider) error

	// GetUserFromIdentity retrieves or creates a user from an SSO identity
	GetUserFromIdentity(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) (*entities.User, error)

	// Role Mapping

	// MapUserRoles maps user roles based on SSO attributes
	MapUserRoles(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) ([]string, error)

	// ApplyRoleMapping applies role mappings to a user
	ApplyRoleMapping(ctx context.Context, userID string, roles []string) error

	// Utility Methods

	// GenerateAuthURL generates an authentication URL for SSO provider
	GenerateAuthURL(ctx context.Context, session *sso.SSOSession) (string, error)

	// ValidateDomain validates if a user's email domain is allowed for enterprise SSO
	ValidateDomain(ctx context.Context, email string, organizationID string) error

	// GetProviderForDomain returns the SSO provider for a given email domain
	GetProviderForDomain(ctx context.Context, domain string) (*sso.SSOProvider, error)
}

// SSOConfig represents SSO configuration
type SSOConfig struct {
	// Service URLs
	BaseURL      string `json:"base_url"`
	ACSURL       string `json:"acs_url"`       // SAML Assertion Consumer Service URL
	SLOURL       string `json:"slo_url"`       // SAML Single Logout URL
	CallbackURL  string `json:"callback_url"`  // OIDC Callback URL

	// Security
	JWTSecret    string `json:"jwt_secret"`
	SessionTTL   int    `json:"session_ttl"`   // Session TTL in minutes
	TokenTTL     int    `json:"token_ttl"`     // Token TTL in minutes

	// Features
	AutoProvision bool   `json:"auto_provision"`
	DefaultRole   string `json:"default_role"`
	DefaultPlan   string `json:"default_plan"`
}

// SSOAttribute represents an SSO attribute mapping
type SSOAttribute struct {
	ProviderAttribute string `json:"provider_attribute"`
	LocalAttribute    string `json:"local_attribute"`
	Transform         string `json:"transform"` // Optional: lower, upper, etc.
}

// SAMLResponse represents a parsed SAML response
type SAMLResponse struct {
	Attributes    map[string]string `json:"attributes"`
	NameID        string            `json:"name_id"`
	SessionIndex  string            `json:"session_index"`
	NotOnOrAfter  time.Time         `json:"not_on_or_after"`
}

// OIDCTokenResponse represents an OIDC token response
type OIDCTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
}

// OIDCUserInfo represents OIDC user information
type OIDCUserInfo struct {
	Sub               string `json:"sub"`
	Name              string `json:"name"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	Email             string `json:"email"`
	EmailVerified     bool   `json:"email_verified"`
	Picture           string `json:"picture"`
	Groups            []string `json:"groups"`
	Attributes        map[string]interface{} `json:"attributes"`
}

// RoleMappingRequest represents a role mapping request
type RoleMappingRequest struct {
	ProviderAttribute string   `json:"provider_attribute"`
	LocalRoles        []string `json:"local_roles"`
	Condition         string   `json:"condition"` // Optional: equals, contains, etc.
}

// ProviderTestRequest represents a provider test request
type ProviderTestRequest struct {
	Type     sso.SSOProviderType `json:"type"`
	Config   map[string]interface{} `json:"config"`
	TestUser string              `json:"test_user"` // Optional: test user email/ID
}

// ProviderTestResponse represents a provider test response
type ProviderTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}
package sso

import (
	"context"
)

// SSOProviderRepository defines the interface for SSO provider persistence
type SSOProviderRepository interface {
	// Create creates a new SSO provider
	Create(ctx context.Context, provider *SSOProvider) error

	// GetByID retrieves an SSO provider by ID
	GetByID(ctx context.Context, id string) (*SSOProvider, error)

	// GetByType retrieves SSO providers by type
	GetByType(ctx context.Context, providerType SSOProviderType) ([]*SSOProvider, error)

	// GetEnabled retrieves all enabled SSO providers
	GetEnabled(ctx context.Context) ([]*SSOProvider, error)

	// GetByEntityID retrieves a SAML provider by EntityID
	GetByEntityID(ctx context.Context, entityID string) (*SSOProvider, error)

	// GetByClientID retrieves an OIDC provider by ClientID
	GetByClientID(ctx context.Context, clientID string) (*SSOProvider, error)

	// Update updates an SSO provider
	Update(ctx context.Context, provider *SSOProvider) error

	// Delete deletes an SSO provider
	Delete(ctx context.Context, id string) error

	// List retrieves SSO providers with pagination
	List(ctx context.Context, limit, offset int) ([]*SSOProvider, error)

	// Count returns the total number of SSO providers
	Count(ctx context.Context) (int64, error)
}

// SSOIdentityRepository defines the interface for SSO identity persistence
type SSOIdentityRepository interface {
	// Create creates a new SSO identity
	Create(ctx context.Context, identity *SSOIdentity) error

	// GetByID retrieves an SSO identity by ID
	GetByID(ctx context.Context, id string) (*SSOIdentity, error)

	// GetByProviderAndExternalID retrieves an SSO identity by provider and external ID
	GetByProviderAndExternalID(ctx context.Context, providerID, externalID string) (*SSOIdentity, error)

	// GetByUserID retrieves all SSO identities for a user
	GetByUserID(ctx context.Context, userID string) ([]*SSOIdentity, error)

	// GetByEmail retrieves SSO identities by email
	GetByEmail(ctx context.Context, email string) ([]*SSOIdentity, error)

	// Update updates an SSO identity
	Update(ctx context.Context, identity *SSOIdentity) error

	// Delete deletes an SSO identity
	Delete(ctx context.Context, id string) error

	// List retrieves SSO identities with pagination
	List(ctx context.Context, limit, offset int) ([]*SSOIdentity, error)

	// Count returns the total number of SSO identities
	Count(ctx context.Context) (int64, error)

	// LinkToUser links an identity to a user account
	LinkToUser(ctx context.Context, identityID, userID string) error

	// UnlinkFromUser unlinks an identity from a user account
	UnlinkFromUser(ctx context.Context, identityID string) error
}

// SSOSessionRepository defines the interface for SSO session persistence
type SSOSessionRepository interface {
	// Create creates a new SSO session
	Create(ctx context.Context, session *SSOSession) error

	// GetByID retrieves an SSO session by ID
	GetByID(ctx context.Context, id string) (*SSOSession, error)

	// GetByRequestID retrieves an SSO session by request ID (SAML)
	GetByRequestID(ctx context.Context, requestID string) (*SSOSession, error)

	// GetByState retrieves an SSO session by state (OIDC)
	GetByState(ctx context.Context, state string) (*SSOSession, error)

	// GetActiveByIdentity retrieves active sessions for an identity
	GetActiveByIdentity(ctx context.Context, identityID string) ([]*SSOSession, error)

	// Update updates an SSO session
	Update(ctx context.Context, session *SSOSession) error

	// Delete deletes an SSO session
	Delete(ctx context.Context, id string) error

	// DeleteExpired deletes all expired sessions
	DeleteExpired(ctx context.Context) error

	// DeactivateByIdentity deactivates all sessions for an identity
	DeactivateByIdentity(ctx context.Context, identityID string) error

	// DeactivateByUser deactivates all sessions for a user
	DeactivateByUser(ctx context.Context, userID string) error
}

// EnterpriseSettingsRepository defines the interface for enterprise settings persistence
type EnterpriseSettingsRepository interface {
	// Create creates new enterprise settings
	Create(ctx context.Context, settings *EnterpriseSettings) error

	// GetByID retrieves enterprise settings by ID
	GetByID(ctx context.Context, id string) (*EnterpriseSettings, error)

	// GetByOrganization retrieves enterprise settings by organization
	GetByOrganization(ctx context.Context, organizationID string) (*EnterpriseSettings, error)

	// GetByProvider retrieves enterprise settings by provider
	GetByProvider(ctx context.Context, providerID string) ([]*EnterpriseSettings, error)

	// Update updates enterprise settings
	Update(ctx context.Context, settings *EnterpriseSettings) error

	// Delete deletes enterprise settings
	Delete(ctx context.Context, id string) error

	// List retrieves enterprise settings with pagination
	List(ctx context.Context, limit, offset int) ([]*EnterpriseSettings, error)

	// Count returns the total number of enterprise settings
	Count(ctx context.Context) (int64, error)
}

// SSORepository combines all SSO-related repositories
// NOTE: Temporarily commented out due to duplicate method names from embedded interfaces
// type SSORepository interface {
// 	SSOProviderRepository
// 	SSOIdentityRepository
// 	SSOSessionRepository
// 	EnterpriseSettingsRepository
// }

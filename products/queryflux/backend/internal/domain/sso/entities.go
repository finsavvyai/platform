package sso

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// SSOProviderType represents the type of SSO provider
type SSOProviderType string

const (
	SSOProviderTypeSAML SSOProviderType = "saml"
	SSOProviderTypeOIDC SSOProviderType = "oidc"
)

// SSOProvider represents an SSO provider configuration
type SSOProvider struct {
	ID               string          `json:"id" db:"id"`
	Name             string          `json:"name" db:"name"`
	Type             SSOProviderType `json:"type" db:"type"`
	EntityID         string          `json:"entity_id" db:"entity_id"`
	MetadataURL      string          `json:"metadata_url" db:"metadata_url"`
	MetadataXML      string          `json:"metadata_xml" db:"metadata_xml"`
	ClientID         string          `json:"client_id" db:"client_id"`
	ClientSecret     string          `json:"-" db:"client_secret"` // Never include in JSON responses
	AuthURL          string          `json:"auth_url" db:"auth_url"`
	TokenURL         string          `json:"token_url" db:"token_url"`
	UserInfoURL      string          `json:"user_info_url" db:"user_info_url"`
	Scopes           string          `json:"scopes" db:"scopes"`
	Enabled          bool            `json:"enabled" db:"enabled"`
	AutoProvision    bool            `json:"auto_provision" db:"auto_provision"`
	DefaultRole      string          `json:"default_role" db:"default_role"`
	DefaultPlan      string          `json:"default_plan" db:"default_plan"`
	AttributeMapping string          `json:"attribute_mapping" db:"attribute_mapping"` // JSON string
	CreatedAt        time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at" db:"updated_at"`
}

// SSOIdentity represents a user identity from an SSO provider
type SSOIdentity struct {
	ID                string                 `json:"id" db:"id"`
	UserID            *string                `json:"user_id" db:"user_id"` // Nullable - can be null if user not yet provisioned
	ProviderID        string                 `json:"provider_id" db:"provider_id"`
	ExternalID        string                 `json:"external_id" db:"external_id"` // Unique ID from provider
	Email             string                 `json:"email" db:"email"`
	Name              string                 `json:"name" db:"name"`
	FirstName         string                 `json:"first_name" db:"first_name"`
	LastName          string                 `json:"last_name" db:"last_name"`
	Attributes        map[string]interface{} `json:"attributes" db:"attributes"` // JSON field
	LastAuthenticated *time.Time             `json:"last_authenticated" db:"last_authenticated"`
	CreatedAt         time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at" db:"updated_at"`
}

// SSOSession represents an SSO authentication session
type SSOSession struct {
	ID          string                 `json:"id" db:"id"`
	IdentityID  *string                `json:"identity_id" db:"identity_id"` // Nullable for pre-auth sessions
	RequestID   string                 `json:"request_id" db:"request_id"`   // For SAML request tracking
	State       string                 `json:"state" db:"state"`             // For OIDC state tracking
	Nonce       string                 `json:"nonce" db:"nonce"`             // For OIDC nonce
	RedirectURL string                 `json:"redirect_url" db:"redirect_url"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"` // JSON field for additional data
	ExpiresAt   time.Time              `json:"expires_at" db:"expires_at"`
	IsActive    bool                   `json:"is_active" db:"is_active"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

// EnterpriseSettings represents enterprise-specific SSO settings
type EnterpriseSettings struct {
	ID              string    `json:"id" db:"id"`
	OrganizationID  string    `json:"organization_id" db:"organization_id"`
	ProviderID      string    `json:"provider_id" db:"provider_id"`
	RequireSSO      bool      `json:"require_sso" db:"require_sso"`
	AllowLocalLogin bool      `json:"allow_local_login" db:"allow_local_login"`
	DomainWhitelist string    `json:"domain_whitelist" db:"domain_whitelist"` // Comma-separated list
	RoleMappings    string    `json:"role_mappings" db:"role_mappings"`       // JSON string
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// NewSSOProvider creates a new SSO provider with validation
func NewSSOProvider(name string, providerType SSOProviderType, config map[string]interface{}) (*SSOProvider, error) {
	if name == "" {
		return nil, fmt.Errorf("provider name is required")
	}

	if providerType != SSOProviderTypeSAML && providerType != SSOProviderTypeOIDC {
		return nil, fmt.Errorf("invalid provider type: %s", providerType)
	}

	now := time.Now()
	provider := &SSOProvider{
		ID:            uuid.New().String(),
		Name:          name,
		Type:          providerType,
		Enabled:       true,
		AutoProvision: true,
		DefaultRole:   "user",
		DefaultPlan:   "free",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Set provider-specific configuration
	if providerType == SSOProviderTypeSAML {
		if entityID, ok := config["entity_id"].(string); ok {
			provider.EntityID = entityID
		}
		if metadataURL, ok := config["metadata_url"].(string); ok {
			provider.MetadataURL = metadataURL
		}
		if metadataXML, ok := config["metadata_xml"].(string); ok {
			provider.MetadataXML = metadataXML
		}
	} else if providerType == SSOProviderTypeOIDC {
		if clientID, ok := config["client_id"].(string); ok {
			provider.ClientID = clientID
		}
		if clientSecret, ok := config["client_secret"].(string); ok {
			provider.ClientSecret = clientSecret
		}
		if authURL, ok := config["auth_url"].(string); ok {
			provider.AuthURL = authURL
		}
		if tokenURL, ok := config["token_url"].(string); ok {
			provider.TokenURL = tokenURL
		}
		if userInfoURL, ok := config["user_info_url"].(string); ok {
			provider.UserInfoURL = userInfoURL
		}
		if scopes, ok := config["scopes"].(string); ok {
			provider.Scopes = scopes
		} else {
			provider.Scopes = "openid email profile"
		}
	}

	return provider, nil
}

// Validate validates the SSO provider entity
func (p *SSOProvider) Validate() error {
	if p.ID == "" {
		return fmt.Errorf("provider ID is required")
	}

	if p.Name == "" {
		return fmt.Errorf("provider name is required")
	}

	if p.Type != SSOProviderTypeSAML && p.Type != SSOProviderTypeOIDC {
		return fmt.Errorf("invalid provider type: %s", p.Type)
	}

	// Validate SAML-specific fields
	if p.Type == SSOProviderTypeSAML {
		if p.EntityID == "" && p.MetadataURL == "" && p.MetadataXML == "" {
			return fmt.Errorf("SAML provider requires either EntityID, MetadataURL, or MetadataXML")
		}
	}

	// Validate OIDC-specific fields
	if p.Type == SSOProviderTypeOIDC {
		if p.ClientID == "" {
			return fmt.Errorf("OIDC provider requires ClientID")
		}
		if p.AuthURL == "" {
			return fmt.Errorf("OIDC provider requires AuthURL")
		}
		if p.TokenURL == "" {
			return fmt.Errorf("OIDC provider requires TokenURL")
		}
	}

	return nil
}

// GetAttributeMapping returns the attribute mapping as a map
func (p *SSOProvider) GetAttributeMapping() map[string]string {
	// Default mapping
	defaultMapping := map[string]string{
		"email":      "email",
		"name":       "name",
		"first_name": "given_name",
		"last_name":  "family_name",
	}

	// TODO: Parse p.AttributeMapping JSON and merge with defaults
	return defaultMapping
}

// NewSSOIdentity creates a new SSO identity with validation
func NewSSOIdentity(providerID, externalID, email, name string) (*SSOIdentity, error) {
	if providerID == "" {
		return nil, fmt.Errorf("provider ID is required")
	}
	if externalID == "" {
		return nil, fmt.Errorf("external ID is required")
	}
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}

	now := time.Now()
	return &SSOIdentity{
		ID:         uuid.New().String(),
		ProviderID: providerID,
		ExternalID: externalID,
		Email:      email,
		Name:       name,
		Attributes: make(map[string]interface{}),
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

// Validate validates the SSO identity entity
func (i *SSOIdentity) Validate() error {
	if i.ID == "" {
		return fmt.Errorf("identity ID is required")
	}

	if i.ProviderID == "" {
		return fmt.Errorf("provider ID is required")
	}

	if i.ExternalID == "" {
		return fmt.Errorf("external ID is required")
	}

	if i.Email == "" {
		return fmt.Errorf("email is required")
	}

	return nil
}

// SetAttribute sets an attribute on the identity
func (i *SSOIdentity) SetAttribute(key string, value interface{}) {
	if i.Attributes == nil {
		i.Attributes = make(map[string]interface{})
	}
	i.Attributes[key] = value
	i.UpdatedAt = time.Now()
}

// GetAttribute gets an attribute from the identity
func (i *SSOIdentity) GetAttribute(key string) (interface{}, bool) {
	if i.Attributes == nil {
		return nil, false
	}
	value, exists := i.Attributes[key]
	return value, exists
}

// UpdateLastAuthentication updates the last authentication timestamp
func (i *SSOIdentity) UpdateLastAuthentication() {
	now := time.Now()
	i.LastAuthenticated = &now
	i.UpdatedAt = now
}

// LinkUser links the identity to a user
func (i *SSOIdentity) LinkUser(userID string) {
	i.UserID = &userID
	i.UpdatedAt = time.Now()
}

// NewSSOSession creates a new SSO session
func NewSSOSession(identityID, redirectURL string, expiresAt time.Time) (*SSOSession, error) {
	// identityID can be empty for pre-auth sessions
	if redirectURL == "" {
		return nil, fmt.Errorf("redirect URL is required")
	}

	now := time.Now()
	var idID *string
	if identityID != "" {
		idID = &identityID
	}

	return &SSOSession{
		ID:          uuid.New().String(),
		IdentityID:  idID,
		RequestID:   uuid.New().String(),
		State:       uuid.New().String(),
		Nonce:       uuid.New().String(),
		RedirectURL: redirectURL,
		Metadata:    make(map[string]interface{}),
		ExpiresAt:   expiresAt,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// Validate validates the SSO session entity
func (s *SSOSession) Validate() error {
	if s.ID == "" {
		return fmt.Errorf("session ID is required")
	}

	// IdentityID can be nil for pre-auth sessions

	if s.RedirectURL == "" {
		return fmt.Errorf("redirect URL is required")
	}

	if s.ExpiresAt.Before(time.Now()) {
		return fmt.Errorf("session has expired")
	}

	if !s.IsActive {
		return fmt.Errorf("session is inactive")
	}

	return nil
}

// IsExpired checks if the session has expired
func (s *SSOSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// Deactivate deactivates the session
func (s *SSOSession) Deactivate() {
	s.IsActive = false
	s.UpdatedAt = time.Now()
}

// SetMetadata sets metadata on the session
func (s *SSOSession) SetMetadata(key string, value interface{}) {
	if s.Metadata == nil {
		s.Metadata = make(map[string]interface{})
	}
	s.Metadata[key] = value
	s.UpdatedAt = time.Now()
}

// NewEnterpriseSettings creates new enterprise settings
func NewEnterpriseSettings(organizationID, providerID string) (*EnterpriseSettings, error) {
	if organizationID == "" {
		return nil, fmt.Errorf("organization ID is required")
	}
	if providerID == "" {
		return nil, fmt.Errorf("provider ID is required")
	}

	now := time.Now()
	return &EnterpriseSettings{
		ID:              uuid.New().String(),
		OrganizationID:  organizationID,
		ProviderID:      providerID,
		RequireSSO:      false,
		AllowLocalLogin: true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}

// Validate validates the enterprise settings entity
func (e *EnterpriseSettings) Validate() error {
	if e.ID == "" {
		return fmt.Errorf("settings ID is required")
	}

	if e.OrganizationID == "" {
		return fmt.Errorf("organization ID is required")
	}

	if e.ProviderID == "" {
		return fmt.Errorf("provider ID is required")
	}

	return nil
}

// GetDomainWhitelist returns the domain whitelist as a slice
func (e *EnterpriseSettings) GetDomainWhitelist() []string {
	if e.DomainWhitelist == "" {
		return []string{}
	}

	domains := strings.Split(e.DomainWhitelist, ",")
	for i, d := range domains {
		domains[i] = strings.TrimSpace(d)
	}
	return domains
}

// GetRoleMappings returns the role mappings as a map
func (e *EnterpriseSettings) GetRoleMappings() map[string]string {
	// Default mappings
	mappings := map[string]string{
		"admin": "admin",
		"user":  "user",
	}

	// Parse e.RoleMappings JSON and merge with defaults
	if e.RoleMappings != "" {
		var customMappings map[string]string
		if err := json.Unmarshal([]byte(e.RoleMappings), &customMappings); err == nil {
			for k, v := range customMappings {
				mappings[k] = v
			}
		}
	}

	return mappings
}

package models

import (
	"time"

	"gorm.io/gorm"
)

// OAuthConnection represents an OAuth connection between a user and a provider
type OAuthConnection struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	UserID      string  `json:"user_id" gorm:"not null;index"`
	ProviderID  string  `json:"provider_id" gorm:"not null;index"`
	ConnectorID *string `json:"connector_id,omitempty" gorm:"index"`

	AccessToken  string     `json:"access_token" gorm:"not null"`
	TokenType    string     `json:"token_type" gorm:"not null"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	RefreshToken string     `json:"refresh_token,omitempty"`
	Scope        string     `json:"scope,omitempty"`

	// Provider-specific user information
	ProviderUserID string `json:"provider_user_id" gorm:"not null;index"`
	Email          string `json:"email" gorm:"not null;index"`
	Name           string `json:"name,omitempty"`
	Avatar         string `json:"avatar,omitempty"`
	Verified       bool   `json:"verified" gorm:"default:false"`

	// Status and metadata
	IsActive bool       `json:"is_active" gorm:"default:true"`
	LastUsed *time.Time `json:"last_used,omitempty"`
	Metadata string     `json:"metadata,omitempty" gorm:"type:jsonb"`
}

// OAuthProvider represents an OAuth provider configuration in the database
type OAuthProvider struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Name        string `json:"name" gorm:"not null"`
	DisplayName string `json:"display_name" gorm:"not null"`
	Description string `json:"description,omitempty"`

	ClientID     string `json:"client_id" gorm:"not null"`
	ClientSecret string `json:"client_secret" gorm:"not null"`

	AuthURL     string `json:"auth_url" gorm:"not null"`
	TokenURL    string `json:"token_url" gorm:"not null"`
	UserInfoURL string `json:"user_info_url" gorm:"not null"`
	RevokeURL   string `json:"revoke_url,omitempty"`

	Scopes string `json:"scopes" gorm:"not null"`

	// Provider-specific settings
	PKCEEnabled     bool `json:"pkce_enabled" gorm:"default:true"`
	StateTTLMinutes int  `json:"state_ttl_minutes" gorm:"default:10"`

	// Configuration
	Config   string `json:"config,omitempty" gorm:"type:jsonb"`
	IsActive bool   `json:"is_active" gorm:"default:true"`
}

// OAuthTokenLog represents a log of token operations
type OAuthTokenLog struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CreatedAt time.Time `json:"created_at"`

	UserID      string  `json:"user_id" gorm:"not null;index"`
	ProviderID  string  `json:"provider_id" gorm:"not null;index"`
	ConnectorID *string `json:"connector_id,omitempty" gorm:"index"`

	Operation    string `json:"operation" gorm:"not null"` // "create", "refresh", "revoke", "validate"
	Status       string `json:"status" gorm:"not null"`    // "success", "failed", "expired"
	ErrorMessage string `json:"error_message,omitempty"`

	// Token metadata (without actual tokens)
	TokenType string     `json:"token_type,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Scope     string     `json:"scope,omitempty"`

	IPAddress string `json:"ip_address,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
	Metadata  string `json:"metadata,omitempty" gorm:"type:jsonb"`
}

// BeforeCreate hook for OAuthConnection
func (oc *OAuthConnection) BeforeCreate(tx *gorm.DB) error {
	if oc.ExpiresAt != nil && oc.ExpiresAt.Before(time.Now()) {
		oc.IsActive = false
	}
	return nil
}

// IsExpired checks if the OAuth connection is expired
func (oc *OAuthConnection) IsExpired() bool {
	if oc.ExpiresAt == nil {
		return false
	}
	return oc.ExpiresAt.Before(time.Now())
}

// IsRefreshable checks if the connection can be refreshed
func (oc *OAuthConnection) IsRefreshable() bool {
	return oc.RefreshToken != "" && oc.IsActive
}

// ToSafeJSON returns a JSON representation without sensitive data
func (oc *OAuthConnection) ToSafeJSON() map[string]interface{} {
	return map[string]interface{}{
		"id":               oc.ID,
		"created_at":       oc.CreatedAt,
		"updated_at":       oc.UpdatedAt,
		"user_id":          oc.UserID,
		"provider_id":      oc.ProviderID,
		"connector_id":     oc.ConnectorID,
		"token_type":       oc.TokenType,
		"expires_at":       oc.ExpiresAt,
		"scope":            oc.Scope,
		"provider_user_id": oc.ProviderUserID,
		"email":            oc.Email,
		"name":             oc.Name,
		"avatar":           oc.Avatar,
		"verified":         oc.Verified,
		"is_active":        oc.IsActive,
		"last_used":        oc.LastUsed,
		"is_expired":       oc.IsExpired(),
		"is_refreshable":   oc.IsRefreshable(),
	}
}

// BeforeCreate hook for OAuthProvider
func (op *OAuthProvider) BeforeCreate(tx *gorm.DB) error {
	if op.DisplayName == "" {
		op.DisplayName = op.Name
	}
	return nil
}

// TableName returns the table name for OAuthConnection
func (OAuthConnection) TableName() string {
	return "oauth_connections"
}

// TableName returns the table name for OAuthProvider
func (OAuthProvider) TableName() string {
	return "oauth_providers"
}

// TableName returns the table name for OAuthTokenLog
func (OAuthTokenLog) TableName() string {
	return "oauth_token_logs"
}

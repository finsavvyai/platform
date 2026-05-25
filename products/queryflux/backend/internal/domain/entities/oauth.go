package entities

import (
	"time"

	"github.com/google/uuid"
)

// OAuthProvider represents supported OAuth providers
type OAuthProvider string

const (
	OAuthProviderGoogle   OAuthProvider = "google"
	OAuthProviderGitHub   OAuthProvider = "github"
	OAuthProviderMicrosoft OAuthProvider = "microsoft"
	OAuthProviderAzureAD  OAuthProvider = "azuread"
)

// OAuthAccount represents a linked OAuth account
type OAuthAccount struct {
	ID           string       `json:"id" db:"id"`
	UserID       string       `json:"user_id" db:"user_id"`
	Provider     OAuthProvider `json:"provider" db:"provider"`
	ProviderID   string       `json:"provider_id" db:"provider_id"` // Provider's user ID
	Email        string       `json:"email" db:"email"`
	AccessToken  string       `json:"-" db:"access_token"` // Encrypted
	RefreshToken string       `json:"-" db:"refresh_token"` // Encrypted
	TokenExpiry  *time.Time   `json:"token_expiry" db:"token_expiry"`
	Scopes       string       `json:"scopes" db:"scopes"` // Comma-separated
	Metadata     string       `json:"metadata" db:"metadata"` // JSON string
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`
	LastUsedAt   *time.Time   `json:"last_used_at" db:"last_used_at"`
}

// NewOAuthAccount creates a new OAuth account
func NewOAuthAccount(userID string, provider OAuthProvider, providerID, email, accessToken, refreshToken string, scopes []string) *OAuthAccount {
	now := time.Now()
	return &OAuthAccount{
		ID:           uuid.New().String(),
		UserID:       userID,
		Provider:     provider,
		ProviderID:   providerID,
		Email:        email,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Scopes:       joinScopes(scopes),
		Metadata:     "{}",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// IsTokenExpired checks if the access token is expired
func (oa *OAuthAccount) IsTokenExpired() bool {
	if oa.TokenExpiry == nil {
		return false
	}
	return time.Now().After(*oa.TokenExpiry)
}

// UpdateTokens updates the OAuth tokens
func (oa *OAuthAccount) UpdateTokens(accessToken, refreshToken string, expiry *time.Time) {
	oa.AccessToken = accessToken
	oa.RefreshToken = refreshToken
	oa.TokenExpiry = expiry
	oa.UpdatedAt = time.Now()
	now := time.Now()
	oa.LastUsedAt = &now
}

// GetScopeList returns scopes as a slice
func (oa *OAuthAccount) GetScopeList() []string {
	return splitScopes(oa.Scopes)
}

// OAuthState represents an OAuth state parameter for CSRF protection
type OAuthState struct {
	ID        string    `json:"id" db:"id"`
	State     string    `json:"state" db:"state"`
	Provider  OAuthProvider `json:"provider" db:"provider"`
	RedirectURI string  `json:"redirect_uri" db:"redirect_uri"`
	UserID    *string   `json:"user_id" db:"user_id"` // Optional: for linking existing accounts
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// NewOAuthState creates a new OAuth state
func NewOAuthState(provider OAuthProvider, redirectURI string, userID *string) *OAuthState {
	now := time.Now()
	expiresAt := now.Add(10 * time.Minute) // States expire in 10 minutes
	return &OAuthState{
		ID:          uuid.New().String(),
		State:       generateStateToken(),
		Provider:    provider,
		RedirectURI: redirectURI,
		UserID:      userID,
		ExpiresAt:   expiresAt,
		CreatedAt:   now,
	}
}

// IsExpired checks if the state is expired
func (os *OAuthState) IsExpired() bool {
	return time.Now().After(os.ExpiresAt)
}

// OAuthUserProfile represents a user profile from OAuth provider
type OAuthUserProfile struct {
	Provider     OAuthProvider `json:"provider"`
	ProviderID   string        `json:"provider_id"`
	Email        string        `json:"email"`
	EmailVerified bool         `json:"email_verified"`
	Name         string        `json:"name"`
	FirstName    string        `json:"given_name"`
	LastName     string        `json:"family_name"`
	Picture      string        `json:"picture"`
	Locale       string        `json:"locale"`
	HD           string        `json:"hd"` // For Google: hosted domain
}

// OAuthTokenResponse represents OAuth token response
type OAuthTokenResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	TokenType    string    `json:"token_type"`
	Scope        string    `json:"scope"`
	IDToken      string    `json:"id_token"` // For OpenID Connect
}

// OAuthConfig represents OAuth provider configuration
type OAuthConfig struct {
	Provider      OAuthProvider `json:"provider"`
	ClientID      string        `json:"client_id"`
	ClientSecret  string        `json:"client_secret"`
	RedirectURL   string        `json:"redirect_url"`
	AuthURL       string        `json:"auth_url"`
	TokenURL      string        `json:"token_url"`
	UserInfoURL   string        `json:"user_info_url"`
	Scopes        []string      `json:"scopes"`
	Enabled       bool          `json:"enabled"`
}

// Helper functions

func joinScopes(scopes []string) string {
	if len(scopes) == 0 {
		return ""
	}
	result := scopes[0]
	for i := 1; i < len(scopes); i++ {
		result += "," + scopes[i]
	}
	return result
}

func splitScopes(scopes string) []string {
	if scopes == "" {
		return []string{}
	}
	result := []string{}
	current := ""
	for _, char := range scopes {
		if char == ',' {
			result = append(result, current)
			current = ""
		} else {
			current += string(char)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func generateStateToken() string {
	return uuid.New().String()
}

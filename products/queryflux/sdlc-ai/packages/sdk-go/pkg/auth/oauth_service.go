package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

// OAuthService manages OAuth 2.0 social login integrations
type OAuthService struct {
	configs map[string]*OAuthProviderConfig
	storage OAuthTokenStorage
}

// OAuthProviderConfig represents configuration for an OAuth provider
type OAuthProviderConfig struct {
	Name         string            `json:"name"`
	ClientID     string            `json:"client_id"`
	ClientSecret string            `json:"client_secret"`
	RedirectURL  string            `json:"redirect_url"`
	Scopes       []string          `json:"scopes"`
	AuthURL      string            `json:"auth_url"`
	TokenURL     string            `json:"token_url"`
	UserInfoURL  string            `json:"user_info_url"`
	Enabled      bool              `json:"enabled"`
	FieldMapping map[string]string `json:"field_mapping"`
	ExtraParams  map[string]string `json:"extra_params"`
}

// OAuthTokenStorage interface for storing OAuth tokens
type OAuthTokenStorage interface {
	StoreToken(ctx context.Context, userID, provider string, token *OAuthToken) error
	GetToken(ctx context.Context, userID, provider string) (*OAuthToken, error)
	DeleteToken(ctx context.Context, userID, provider string) error
	RefreshToken(ctx context.Context, userID, provider string) (*OAuthToken, error)
}

// OAuthToken represents an OAuth access token
type OAuthToken struct {
	AccessToken  string    `json:"access_token"`
	TokenType    string    `json:"token_type"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
	Scope        string    `json:"scope,omitempty"`
	UserID       string    `json:"user_id"`
	Provider     string    `json:"provider"`
	CreatedAt    time.Time `json:"created_at"`
}

// OAuthUserInfo represents user information from OAuth provider
type OAuthUserInfo struct {
	ID            string                 `json:"id"`
	Email         string                 `json:"email"`
	Name          string                 `json:"name"`
	FirstName     string                 `json:"first_name"`
	LastName      string                 `json:"last_name"`
	Username      string                 `json:"username"`
	Avatar        string                 `json:"avatar"`
	EmailVerified bool                   `json:"email_verified"`
	Locale        string                 `json:"locale"`
	Provider      string                 `json:"provider"`
	RawData       map[string]interface{} `json:"raw_data"`
}

// OAuthAuthURLRequest represents a request to generate OAuth auth URL
type OAuthAuthURLRequest struct {
	Provider    string   `json:"provider"`
	State       string   `json:"state,omitempty"`
	RedirectURL string   `json:"redirect_url,omitempty"`
	Scopes      []string `json:"scopes,omitempty"`
	Prompt      string   `json:"prompt,omitempty"` // "consent", "none", "login"
}

// OAuthAuthURLResponse contains the generated authorization URL
type OAuthAuthURLResponse struct {
	AuthURL string `json:"auth_url"`
	State   string `json:"state"`
}

// OAuthCallbackRequest represents an OAuth callback request
type OAuthCallbackRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
	Error string `json:"error,omitempty"`
}

// OAuthExchangeRequest represents a request to exchange code for tokens
type OAuthExchangeRequest struct {
	Provider    string `json:"provider"`
	Code        string `json:"code"`
	RedirectURL string `json:"redirect_url,omitempty"`
	State       string `json:"state,omitempty"`
}

// OAuthExchangeResponse contains the result of token exchange
type OAuthExchangeResponse struct {
	UserInfo *OAuthUserInfo `json:"user_info"`
	Token    *OAuthToken    `json:"token"`
	Message  string         `json:"message"`
}

// NewOAuthService creates a new OAuth service
func NewOAuthService(storage OAuthTokenStorage) *OAuthService {
	service := &OAuthService{
		configs: make(map[string]*OAuthProviderConfig),
		storage: storage,
	}

	// Initialize default providers
	service.initializeDefaultProviders()
	return service
}

// initializeDefaultProviders sets up common OAuth providers
func (s *OAuthService) initializeDefaultProviders() {
	// Google OAuth
	s.configs["google"] = &OAuthProviderConfig{
		Name:        "Google",
		AuthURL:     "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL:    "https://oauth2.googleapis.com/token",
		UserInfoURL: "https://www.googleapis.com/oauth2/v2/userinfo",
		Scopes:      []string{"openid", "email", "profile"},
		Enabled:     false, // Requires configuration
		FieldMapping: map[string]string{
			"id":             "id",
			"email":          "email",
			"name":           "name",
			"first_name":     "given_name",
			"last_name":      "family_name",
			"avatar":         "picture",
			"email_verified": "verified_email",
		},
	}

	// GitHub OAuth
	s.configs["github"] = &OAuthProviderConfig{
		Name:        "GitHub",
		AuthURL:     "https://github.com/login/oauth/authorize",
		TokenURL:    "https://github.com/login/oauth/access_token",
		UserInfoURL: "https://api.github.com/user",
		Scopes:      []string{"user:email"},
		Enabled:     false, // Requires configuration
		FieldMapping: map[string]string{
			"id":       "id",
			"email":    "email",
			"name":     "name",
			"username": "login",
			"avatar":   "avatar_url",
		},
	}

	// Microsoft OAuth
	s.configs["microsoft"] = &OAuthProviderConfig{
		Name:        "Microsoft",
		AuthURL:     "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		TokenURL:    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		UserInfoURL: "https://graph.microsoft.com/v1.0/me",
		Scopes:      []string{"openid", "email", "profile"},
		Enabled:     false, // Requires configuration
		FieldMapping: map[string]string{
			"id":             "id",
			"email":          "mail",
			"name":           "displayName",
			"first_name":     "givenName",
			"last_name":      "surname",
			"email_verified": "verifiedEmail",
		},
	}

	// LinkedIn OAuth
	s.configs["linkedin"] = &OAuthProviderConfig{
		Name:        "LinkedIn",
		AuthURL:     "https://www.linkedin.com/oauth/v2/authorization",
		TokenURL:    "https://www.linkedin.com/oauth/v2/accessToken",
		UserInfoURL: "https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))",
		Scopes:      []string{"r_liteprofile", "r_emailaddress"},
		Enabled:     false, // Requires configuration
		FieldMapping: map[string]string{
			"id":         "id",
			"email":      "emailAddress",
			"first_name": "localizedFirstName",
			"last_name":  "localizedLastName",
			"avatar":     "profilePicture.displayImage~.elements[0].identifiers[0].identifier",
		},
	}
}

// ConfigureProvider configures an OAuth provider
func (s *OAuthService) ConfigureProvider(provider, clientID, clientSecret, redirectURL string) error {
	config, exists := s.configs[provider]
	if !exists {
		return fmt.Errorf("unsupported OAuth provider: %s", provider)
	}

	config.ClientID = clientID
	config.ClientSecret = clientSecret
	config.RedirectURL = redirectURL
	config.Enabled = true

	return nil
}

// GenerateAuthURL generates an OAuth authorization URL
func (s *OAuthService) GenerateAuthURL(ctx context.Context, req *OAuthAuthURLRequest) (*OAuthAuthURLResponse, error) {
	config, exists := s.configs[req.Provider]
	if !exists || !config.Enabled {
		return nil, fmt.Errorf("OAuth provider not configured: %s", req.Provider)
	}

	// Generate state if not provided
	state := req.State
	if state == "" {
		state = s.generateSecureToken(32)
	}

	// Prepare OAuth2 config
	oauthConfig := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  req.RedirectURL,
		Scopes:       req.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:  config.AuthURL,
			TokenURL: config.TokenURL,
		},
	}

	// Use provider's default scopes if none specified
	if len(req.Scopes) == 0 {
		oauthConfig.Scopes = config.Scopes
	}

	// Build auth URL options
	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOnline}

	if req.Prompt != "" {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", req.Prompt))
	}

	// Add any extra parameters
	for key, value := range config.ExtraParams {
		opts = append(opts, oauth2.SetAuthURLParam(key, value))
	}

	authURL := oauthConfig.AuthCodeURL(state, opts...)

	return &OAuthAuthURLResponse{
		AuthURL: authURL,
		State:   state,
	}, nil
}

// ExchangeCodeForToken exchanges authorization code for access token
func (s *OAuthService) ExchangeCodeForToken(ctx context.Context, req *OAuthExchangeRequest) (*OAuthExchangeResponse, error) {
	config, exists := s.configs[req.Provider]
	if !exists || !config.Enabled {
		return nil, fmt.Errorf("OAuth provider not configured: %s", req.Provider)
	}

	// Prepare OAuth2 config
	oauthConfig := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  req.RedirectURL,
		Scopes:       config.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:  config.AuthURL,
			TokenURL: config.TokenURL,
		},
	}

	// Exchange code for token
	token, err := oauthConfig.Exchange(ctx, req.Code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	// Get user information
	userInfo, err := s.getUserInfo(ctx, config, token.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	// Create OAuth token object
	oauthToken := &OAuthToken{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(token.ExpiresIn) * time.Second),
		Scope:        token.Extra("scope").(string),
		Provider:     req.Provider,
		CreatedAt:    time.Now(),
	}

	return &OAuthExchangeResponse{
		UserInfo: userInfo,
		Token:    oauthToken,
		Message:  "Authentication successful",
	}, nil
}

// getUserInfo fetches user information from OAuth provider
func (s *OAuthService) getUserInfo(ctx context.Context, config *OAuthProviderConfig, accessToken string) (*OAuthUserInfo, error) {
	// Create HTTP client with access token
	client := &http.Client{
		Transport: &oauth2.Transport{
			Source: oauth2.StaticTokenSource(&oauth2.Token{
				AccessToken: accessToken,
				TokenType:   "Bearer",
			}),
		},
	}

	// Make request to user info endpoint
	resp, err := client.Get(config.UserInfoURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status: %d", resp.StatusCode)
	}

	// Parse response
	var rawData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawData); err != nil {
		return nil, fmt.Errorf("failed to decode user info response: %w", err)
	}

	// Map fields based on provider configuration
	userInfo := &OAuthUserInfo{
		Provider: config.Name,
		RawData:  rawData,
	}

	// Apply field mapping
	for targetField, sourceField := range config.FieldMapping {
		if value, exists := rawData[sourceField]; exists {
			s.mapFieldToUserInfo(userInfo, targetField, value)
		}
	}

	// Handle email verification differently for each provider
	if config.Name == "Google" {
		if verified, ok := rawData["verified_email"].(bool); ok {
			userInfo.EmailVerified = verified
		}
	} else if config.Name == "GitHub" {
		// GitHub email verification requires separate API call
		// For simplicity, we'll assume unverified
		userInfo.EmailVerified = false
	}

	return userInfo, nil
}

// mapFieldToUserInfo maps a field value to the appropriate user info field
func (s *OAuthService) mapFieldToUserInfo(userInfo *OAuthUserInfo, field string, value interface{}) {
	switch field {
	case "id":
		if str, ok := value.(string); ok {
			userInfo.ID = str
		} else if num, ok := value.(float64); ok {
			userInfo.ID = fmt.Sprintf("%.0f", num)
		}
	case "email":
		if str, ok := value.(string); ok {
			userInfo.Email = str
		}
	case "name":
		if str, ok := value.(string); ok {
			userInfo.Name = str
		}
	case "first_name":
		if str, ok := value.(string); ok {
			userInfo.FirstName = str
		}
	case "last_name":
		if str, ok := value.(string); ok {
			userInfo.LastName = str
		}
	case "username":
		if str, ok := value.(string); ok {
			userInfo.Username = str
		}
	case "avatar":
		if str, ok := value.(string); ok {
			userInfo.Avatar = str
		}
	case "email_verified":
		if verified, ok := value.(bool); ok {
			userInfo.EmailVerified = verified
		}
	case "locale":
		if str, ok := value.(string); ok {
			userInfo.Locale = str
		}
	}
}

// StoreToken stores an OAuth token for a user
func (s *OAuthService) StoreToken(ctx context.Context, userID string, token *OAuthToken) error {
	token.UserID = userID
	return s.storage.StoreToken(ctx, userID, token.Provider, token)
}

// GetToken retrieves an OAuth token for a user
func (s *OAuthService) GetToken(ctx context.Context, userID, provider string) (*OAuthToken, error) {
	return s.storage.GetToken(ctx, userID, provider)
}

// RefreshToken refreshes an OAuth access token
func (s *OAuthService) RefreshToken(ctx context.Context, userID, provider string) (*OAuthToken, error) {
	return s.storage.RefreshToken(ctx, userID, provider)
}

// DeleteToken deletes an OAuth token for a user
func (s *OAuthService) DeleteToken(ctx context.Context, userID, provider string) error {
	return s.storage.DeleteToken(ctx, userID, provider)
}

// GetConnectedProviders returns list of connected OAuth providers for a user
func (s *OAuthService) GetConnectedProviders(ctx context.Context, userID string) ([]string, error) {
	// This would typically query the storage for all tokens for a user
	// For now, return a placeholder implementation
	return []string{}, nil
}

// ValidateState validates OAuth state parameter
func (s *OAuthService) ValidateState(state, expectedState string) bool {
	return state == expectedState
}

// generateSecureToken generates a cryptographically secure random token
func (s *OAuthService) generateSecureToken(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to less secure method if crypto/rand fails
		return s.generateFallbackToken(length)
	}
	return base64.URLEncoding.EncodeToString(bytes)
}

// generateFallbackToken generates a fallback token using time and random numbers
func (s *OAuthService) generateFallbackToken(length int) string {
	timestamp := time.Now().UnixNano()
	random := make([]byte, 8)
	rand.Read(random)
	return fmt.Sprintf("%x-%x", timestamp, random)
}

// GetSupportedProviders returns list of supported OAuth providers
func (s *OAuthService) GetSupportedProviders() []string {
	providers := make([]string, 0, len(s.configs))
	for name := range s.configs {
		providers = append(providers, name)
	}
	return providers
}

// IsProviderConfigured checks if a provider is properly configured
func (s *OAuthService) IsProviderConfigured(provider string) bool {
	config, exists := s.configs[provider]
	return exists && config.Enabled && config.ClientID != "" && config.ClientSecret != ""
}

// GetProviderConfig returns the configuration for a provider (excluding secrets)
func (s *OAuthService) GetProviderConfig(provider string) *OAuthProviderConfig {
	config, exists := s.configs[provider]
	if !exists {
		return nil
	}

	// Return a copy without sensitive information
	return &OAuthProviderConfig{
		Name:         config.Name,
		AuthURL:      config.AuthURL,
		TokenURL:     config.TokenURL,
		UserInfoURL:  config.UserInfoURL,
		Scopes:       config.Scopes,
		Enabled:      config.Enabled,
		FieldMapping: config.FieldMapping,
		ExtraParams:  config.ExtraParams,
	}
}

// RevokeToken revokes an OAuth token
func (s *OAuthService) RevokeToken(ctx context.Context, userID, provider string) error {
	// First delete from storage
	if err := s.DeleteToken(ctx, userID, provider); err != nil {
		return err
	}

	// For some providers like Google, we could also revoke at the provider level
	// This would require additional implementation per provider

	return nil
}

// ValidateUserInfo validates user information from OAuth provider
func (s *OAuthService) ValidateUserInfo(userInfo *OAuthUserInfo) error {
	if userInfo.ID == "" {
		return fmt.Errorf("user ID is required")
	}

	if userInfo.Email == "" {
		return fmt.Errorf("email is required")
	}

	if !strings.Contains(userInfo.Email, "@") {
		return fmt.Errorf("invalid email format")
	}

	return nil
}

// ExtractEmailFromRawData extracts email from raw OAuth data for complex cases
func (s *OAuthService) ExtractEmailFromRawData(rawData map[string]interface{}, provider string) string {
	switch provider {
	case "github":
		// GitHub email is in a separate field or requires separate API call
		if email, ok := rawData["email"].(string); ok && email != "" {
			return email
		}
	case "microsoft":
		// Microsoft might return email in different fields
		for _, field := range []string{"mail", "userPrincipalName", "email"} {
			if email, ok := rawData[field].(string); ok && email != "" {
				return email
			}
		}
	case "linkedin":
		// LinkedIn email might be nested
		if elements, ok := rawData["elements"].([]interface{}); ok && len(elements) > 0 {
			if element, ok := elements[0].(map[string]interface{}); ok {
				if email, ok := element["handle~"].(map[string]interface{})["emailAddress"].(string); ok {
					return email
				}
			}
		}
	default:
		// Try common email fields
		for _, field := range []string{"email", "emailAddress", "mail"} {
			if email, ok := rawData[field].(string); ok && email != "" {
				return email
			}
		}
	}
	return ""
}

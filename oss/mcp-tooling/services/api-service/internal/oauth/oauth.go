package oauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
	"gorm.io/gorm"
)

// OAuthProvider represents an OAuth provider configuration
type OAuthProvider struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	AuthURL      string `json:"auth_url"`
	TokenURL     string `json:"token_url"`
	UserInfoURL  string `json:"user_info_url"`
	Scopes       string `json:"scopes"`
}

// OAuthState represents the OAuth state stored during the authorization flow
type OAuthState struct {
	State         string    `json:"state"`
	ProviderID    string    `json:"provider_id"`
	RedirectURI   string    `json:"redirect_uri"`
	CodeVerifier  string    `json:"code_verifier"`
	CodeChallenge string    `json:"code_challenge"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	UserID        *string   `json:"user_id,omitempty"`
	ConnectorID   *string   `json:"connector_id,omitempty"`
}

// OAuthToken represents the token response from OAuth provider
type OAuthToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
}

// OAuthUserInfo represents user information from OAuth provider
type OAuthUserInfo struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Avatar   string `json:"avatar"`
	Verified bool   `json:"verified"`
}

// Service handles OAuth operations
type Service struct {
	db         *gorm.DB
	config     *config.Config
	httpClient *http.Client
	providers  map[string]*OAuthProvider
	states     map[string]*OAuthState
}

// NewService creates a new OAuth service
func NewService(db *gorm.DB, cfg *config.Config) *Service {
	svc := &Service{
		db:         db,
		config:     cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		providers:  make(map[string]*OAuthProvider),
		states:     make(map[string]*OAuthState),
	}

	// Initialize default providers
	svc.initializeProviders()

	// Start cleanup goroutine for expired states
	go svc.cleanupExpiredStates()

	return svc
}

// initializeProviders sets up default OAuth providers
func (s *Service) initializeProviders() {
	// Google OAuth
	s.providers["google"] = &OAuthProvider{
		ID:           "google",
		Name:         "Google",
		ClientID:     s.config.OAuth.Google.ClientID,
		ClientSecret: s.config.OAuth.Google.ClientSecret,
		AuthURL:      "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL:     "https://oauth2.googleapis.com/token",
		UserInfoURL:  "https://www.googleapis.com/oauth2/v2/userinfo",
		Scopes:       "openid email profile",
	}

	// GitHub OAuth
	s.providers["github"] = &OAuthProvider{
		ID:           "github",
		Name:         "GitHub",
		ClientID:     s.config.OAuth.GitHub.ClientID,
		ClientSecret: s.config.OAuth.GitHub.ClientSecret,
		AuthURL:      "https://github.com/login/oauth/authorize",
		TokenURL:     "https://github.com/login/oauth/access_token",
		UserInfoURL:  "https://api.github.com/user",
		Scopes:       "user:email",
	}

	// Microsoft OAuth
	s.providers["microsoft"] = &OAuthProvider{
		ID:           "microsoft",
		Name:         "Microsoft",
		ClientID:     s.config.OAuth.Microsoft.ClientID,
		ClientSecret: s.config.OAuth.Microsoft.ClientSecret,
		AuthURL:      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		TokenURL:     "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		UserInfoURL:  "https://graph.microsoft.com/v1.0/me",
		Scopes:       "openid email profile",
	}

	// Apple Sign In
	if s.config.OAuth.Apple.ClientID != "" {
		s.providers["apple"] = &OAuthProvider{
			ID:           "apple",
			Name:         "Apple",
			ClientID:     s.config.OAuth.Apple.ClientID,
			ClientSecret: s.config.OAuth.Apple.ClientSecret,
			AuthURL:      "https://appleid.apple.com/auth/authorize",
			TokenURL:     "https://appleid.apple.com/auth/token",
			UserInfoURL:  "", // Apple doesn't have a separate user info endpoint
			Scopes:       "name email",
		}
	}
}

// GetAuthorizationURL generates the OAuth authorization URL
func (s *Service) GetAuthorizationURL(ctx context.Context, providerID, redirectURI string, userID, connectorID *string) (string, string, error) {
	provider, exists := s.providers[providerID]
	if !exists {
		return "", "", fmt.Errorf("OAuth provider not found: %s", providerID)
	}

	// Generate PKCE parameters
	codeVerifier, codeChallenge, err := s.generatePKCE()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate PKCE: %w", err)
	}

	// Generate state
	state, err := s.generateState()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate state: %w", err)
	}

	// Store state
	oauthState := &OAuthState{
		State:         state,
		ProviderID:    providerID,
		RedirectURI:   redirectURI,
		CodeVerifier:  codeVerifier,
		CodeChallenge: codeChallenge,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(10 * time.Minute),
		UserID:        userID,
		ConnectorID:   connectorID,
	}

	s.states[state] = oauthState

	// Build authorization URL
	authURL, err := url.Parse(provider.AuthURL)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse auth URL: %w", err)
	}

	params := url.Values{}
	params.Set("client_id", provider.ClientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", provider.Scopes)
	params.Set("state", state)
	params.Set("code_challenge", codeChallenge)
	params.Set("code_challenge_method", "S256")

	authURL.RawQuery = params.Encode()

	return authURL.String(), state, nil
}

// ExchangeCodeForToken exchanges the authorization code for an access token
func (s *Service) ExchangeCodeForToken(ctx context.Context, state, code string) (*OAuthToken, *OAuthUserInfo, error) {
	// Retrieve and validate state
	oauthState, exists := s.states[state]
	if !exists {
		return nil, nil, fmt.Errorf("invalid or expired state")
	}

	if time.Now().After(oauthState.ExpiresAt) {
		delete(s.states, state)
		return nil, nil, fmt.Errorf("state expired")
	}

	provider, exists := s.providers[oauthState.ProviderID]
	if !exists {
		return nil, nil, fmt.Errorf("OAuth provider not found: %s", oauthState.ProviderID)
	}

	// Exchange code for token
	token, err := s.exchangeCode(ctx, provider, oauthState, code)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	// Get user info
	userInfo, err := s.getUserInfo(ctx, provider, token.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get user info: %w", err)
	}

	// Clean up state
	delete(s.states, state)

	return token, userInfo, nil
}

// exchangeCode performs the token exchange
func (s *Service) exchangeCode(ctx context.Context, provider *OAuthProvider, state *OAuthState, code string) (*OAuthToken, error) {
	data := url.Values{}
	data.Set("client_id", provider.ClientID)
	data.Set("client_secret", provider.ClientSecret)
	data.Set("code", code)
	data.Set("redirect_uri", state.RedirectURI)
	data.Set("grant_type", "authorization_code")
	data.Set("code_verifier", state.CodeVerifier)

	req, err := http.NewRequestWithContext(ctx, "POST", provider.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var token OAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &token, nil
}

// getUserInfo retrieves user information from the OAuth provider
func (s *Service) getUserInfo(ctx context.Context, provider *OAuthProvider, accessToken string) (*OAuthUserInfo, error) {
	if provider.ID == "apple" {
		// Apple Sign In: user info is in the JWT ID token
		return s.getAppleUserInfo(ctx, accessToken)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", provider.UserInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make user info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user info request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var userInfo OAuthUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info response: %w", err)
	}

	return &userInfo, nil
}

// getAppleUserInfo extracts user info from Apple ID token
func (s *Service) getAppleUserInfo(ctx context.Context, idToken string) (*OAuthUserInfo, error) {
	// Parse the Apple ID token (JWT)
	token, err := jwt.Parse(idToken, func(token *jwt.Token) (interface{}, error) {
		// For production, you should validate the token against Apple's public keys
		// For now, we'll parse without signature verification
		return []byte("apple"), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse Apple ID token: %w", err)
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userInfo := &OAuthUserInfo{}

		if sub, ok := claims["sub"].(string); ok {
			userInfo.ID = sub
		}

		if email, ok := claims["email"].(string); ok {
			userInfo.Email = email
		}

		if emailVerified, ok := claims["email_verified"].(bool); ok {
			userInfo.Verified = emailVerified
		}

		// Apple may include name in the token
		if name, ok := claims["name"].(string); ok {
			userInfo.Name = name
		}

		return userInfo, nil
	}

	return nil, fmt.Errorf("invalid Apple ID token claims")
}

// SaveOAuthConnection saves or updates an OAuth connection
func (s *Service) SaveOAuthConnection(ctx context.Context, userID, providerID string, token *OAuthToken, userInfo *OAuthUserInfo, connectorID *string) error {
	expiresAt := time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)

	oauthConnection := &models.OAuthConnection{
		UserID:         userID,
		ProviderID:     providerID,
		AccessToken:    token.AccessToken,
		TokenType:      token.TokenType,
		ExpiresAt:      &expiresAt,
		RefreshToken:   token.RefreshToken,
		Scope:          token.Scope,
		ProviderUserID: userInfo.ID,
		Email:          userInfo.Email,
		Name:           userInfo.Name,
		Avatar:         userInfo.Avatar,
		Verified:       userInfo.Verified,
	}

	// Check if connection already exists
	var existing models.OAuthConnection
	err := s.db.Where("user_id = ? AND provider_id = ?", userID, providerID).First(&existing).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("failed to check existing OAuth connection: %w", err)
	}

	if err == nil {
		// Update existing connection
		oauthConnection.ID = existing.ID
		oauthConnection.CreatedAt = existing.CreatedAt
		if err := s.db.Save(oauthConnection).Error; err != nil {
			return fmt.Errorf("failed to update OAuth connection: %w", err)
		}
	} else {
		// Create new connection
		if err := s.db.Create(oauthConnection).Error; err != nil {
			return fmt.Errorf("failed to create OAuth connection: %w", err)
		}
	}

	return nil
}

// GetOAuthConnection retrieves an OAuth connection
func (s *Service) GetOAuthConnection(ctx context.Context, userID, providerID string) (*models.OAuthConnection, error) {
	var connection models.OAuthConnection
	err := s.db.Where("user_id = ? AND provider_id = ?", userID, providerID).First(&connection).Error
	if err != nil {
		return nil, fmt.Errorf("OAuth connection not found: %w", err)
	}

	return &connection, nil
}

// RefreshToken refreshes an OAuth access token
func (s *Service) RefreshToken(ctx context.Context, userID, providerID string) (*OAuthToken, error) {
	connection, err := s.GetOAuthConnection(ctx, userID, providerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get OAuth connection: %w", err)
	}

	if connection.RefreshToken == "" {
		return nil, fmt.Errorf("no refresh token available")
	}

	provider, exists := s.providers[providerID]
	if !exists {
		return nil, fmt.Errorf("OAuth provider not found: %s", providerID)
	}

	data := url.Values{}
	data.Set("client_id", provider.ClientID)
	data.Set("client_secret", provider.ClientSecret)
	data.Set("refresh_token", connection.RefreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, "POST", provider.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make refresh token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("refresh token request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var token OAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to decode refresh token response: %w", err)
	}

	// Update connection with new token
	updates := map[string]interface{}{
		"access_token": token.AccessToken,
		"token_type":   token.TokenType,
		"expires_at":   time.Now().Add(time.Duration(token.ExpiresIn) * time.Second),
	}

	if token.RefreshToken != "" {
		updates["refresh_token"] = token.RefreshToken
	}

	if err := s.db.Model(&connection).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update OAuth connection: %w", err)
	}

	return &token, nil
}

// DeleteOAuthConnection deletes an OAuth connection
func (s *Service) DeleteOAuthConnection(ctx context.Context, userID, providerID string) error {
	return s.db.Where("user_id = ? AND provider_id = ?", userID, providerID).Delete(&models.OAuthConnection{}).Error
}

// ListOAuthConnections lists all OAuth connections for a user
func (s *Service) ListOAuthConnections(ctx context.Context, userID string) ([]*models.OAuthConnection, error) {
	var connections []*models.OAuthConnection
	err := s.db.Where("user_id = ?", userID).Find(&connections).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list OAuth connections: %w", err)
	}

	return connections, nil
}

// GetProviders returns all available OAuth providers
func (s *Service) GetProviders() map[string]*OAuthProvider {
	return s.providers
}

// AddProvider adds a new OAuth provider
func (s *Service) AddProvider(provider *OAuthProvider) {
	s.providers[provider.ID] = provider
}

// generateState generates a secure random state string
func (s *Service) generateState() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// generatePKCE generates PKCE code verifier and challenge
func (s *Service) generatePKCE() (string, string, error) {
	// Generate code verifier (43-128 characters)
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", "", err
	}
	codeVerifier := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(b)

	// Generate code challenge (SHA256 hash)
	hash := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(hash[:])

	return codeVerifier, codeChallenge, nil
}

// cleanupExpiredStates removes expired states from memory
func (s *Service) cleanupExpiredStates() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		for state, oauthState := range s.states {
			if now.After(oauthState.ExpiresAt) {
				delete(s.states, state)
			}
		}
	}
}

// ValidateToken validates an OAuth access token by making a request to the user info endpoint
func (s *Service) ValidateToken(ctx context.Context, providerID, accessToken string) (*OAuthUserInfo, error) {
	provider, exists := s.providers[providerID]
	if !exists {
		return nil, fmt.Errorf("OAuth provider not found: %s", providerID)
	}

	return s.getUserInfo(ctx, provider, accessToken)
}

// RevokeToken revokes an OAuth access token
// RevokeToken revokes an OAuth access token
func (s *Service) RevokeToken(ctx context.Context, providerID, accessToken string) error {
	_, exists := s.providers[providerID]
	if !exists {
		return fmt.Errorf("OAuth provider not found: %s", providerID)
	}

	// Note: Not all providers support token revocation
	// This is a placeholder for providers that do support it
	return nil
}

// generateSignedState creates a signed JWT state for additional security
func (s *Service) generateSignedState(state *OAuthState) (string, error) {
	claims := jwt.MapClaims{
		"state":       state.State,
		"provider_id": state.ProviderID,
		"exp":         state.ExpiresAt.Unix(),
		"iat":         state.CreatedAt.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWT.Secret))
}

// validateSignedState validates a signed JWT state
func (s *Service) validateSignedState(signedState string) (*OAuthState, error) {
	token, err := jwt.Parse(signedState, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWT.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse signed state: %w", err)
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		stateStr, _ := claims["state"].(string)
		// providerID is available in claims but not needed for lookup

		if state, exists := s.states[stateStr]; exists {
			return state, nil
		}
	}

	return nil, fmt.Errorf("invalid or expired signed state")
}

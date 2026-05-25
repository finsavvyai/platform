package providers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCProvider implements OpenID Connect authentication
type OIDCProvider struct {
	provider    *oidc.Provider
	oauthConfig *oauth2.Config
	config      *OIDCConfig
	verifier    *oidc.IDTokenVerifier
}

// OIDCConfig holds OIDC provider configuration
type OIDCConfig struct {
	ClientID       string
	ClientSecret   string
	AuthURL        string
	TokenURL       string
	UserInfoURL    string
	Scopes         []string
	RedirectURL    string
	EndpointParams map[string]string // Additional parameters for auth URL
	SkipVerify     bool              // Skip JWT verification (for testing only)
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
	Sub           string                 `json:"sub"`
	Name          string                 `json:"name"`
	GivenName     string                 `json:"given_name"`
	FamilyName    string                 `json:"family_name"`
	Email         string                 `json:"email"`
	EmailVerified bool                   `json:"email_verified"`
	Picture       string                 `json:"picture"`
	Groups        []string               `json:"groups"`
	Attributes    map[string]interface{} `json:"attributes"`
}

// NewOIDCProvider creates a new OIDC provider
func NewOIDCProvider(config *OIDCConfig) (*OIDCProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("OIDC config is required")
	}

	// Set default scopes if none provided
	if len(config.Scopes) == 0 {
		config.Scopes = []string{oidc.ScopeOpenID, "email", "profile"}
	}

	// Create OAuth2 config
	oauthConfig := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Scopes:       config.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:  config.AuthURL,
			TokenURL: config.TokenURL,
		},
	}

	provider := &OIDCProvider{
		oauthConfig: oauthConfig,
		config:      config,
	}

	// If we have a token URL, try to discover the provider
	if config.TokenURL != "" {
		// Extract issuer URL from token URL or use discovery
		issuerURL := extractIssuerURL(config.TokenURL)
		if issuerURL != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			oidcProvider, err := oidc.NewProvider(ctx, issuerURL)
			if err == nil {
				provider.provider = oidcProvider
				// Create verifier
				provider.verifier = oidcProvider.Verifier(&oidc.Config{
					ClientID: config.ClientID,
				})
			}
			// If discovery fails, continue with manual configuration
		}
	}

	return provider, nil
}

// NewOIDCProviderFromIssuer creates an OIDC provider from an issuer URL
func NewOIDCProviderFromIssuer(ctx context.Context, issuerURL, clientID, clientSecret, redirectURL string, scopes []string) (*OIDCProvider, error) {
	// Discover provider
	provider, err := oidc.NewProvider(ctx, issuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to discover OIDC provider: %w", err)
	}

	// Set default scopes if none provided
	if len(scopes) == 0 {
		scopes = []string{oidc.ScopeOpenID, "email", "profile"}
	}

	// Create OAuth2 config
	oauthConfig := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       scopes,
		Endpoint:     provider.Endpoint(),
	}

	// Create verifier
	verifier := provider.Verifier(&oidc.Config{
		ClientID: clientID,
	})

	return &OIDCProvider{
		provider:    provider,
		oauthConfig: oauthConfig,
		config: &OIDCConfig{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       scopes,
		},
		verifier: verifier,
	}, nil
}

// GenerateAuthURL generates an OIDC authorization URL
func (p *OIDCProvider) GenerateAuthURL(session *sso.SSOSession) (string, error) {
	// Add state and nonce to auth options
	opts := []oauth2.AuthCodeOption{
		oauth2.SetAuthURLParam("state", session.State),
		oauth2.SetAuthURLParam("nonce", session.Nonce),
	}

	// Add any additional parameters from config
	for key, value := range p.config.EndpointParams {
		opts = append(opts, oauth2.SetAuthURLParam(key, value))
	}

	// Generate auth URL
	authURL := p.oauthConfig.AuthCodeURL(session.State, opts...)

	return authURL, nil
}

// ExchangeCodeForTokens exchanges an authorization code for tokens
func (p *OIDCProvider) ExchangeCodeForToken(ctx context.Context, code string) (*OIDCTokenResponse, error) {
	// Exchange authorization code for tokens
	token, err := p.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	// Extract tokens
	response := &OIDCTokenResponse{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		ExpiresIn:    token.Expiry.Second(),
		RefreshToken: token.RefreshToken,
	}

	// Extract ID token if present
	if token.Extra("id_token") != nil {
		response.IDToken = token.Extra("id_token").(string)
	}

	return response, nil
}

// VerifyIDToken verifies and parses an ID token
func (p *OIDCProvider) VerifyIDToken(ctx context.Context, idToken string) (*oidc.IDToken, error) {
	if p.config.SkipVerify {
		// For testing only - parse without verification
		return p.parseIDTokenWithoutVerification(idToken)
	}

	if p.verifier == nil {
		return nil, fmt.Errorf("no token verifier configured")
	}

	return p.verifier.Verify(ctx, idToken)
}

// GetUserInfo retrieves user information using the access token
func (p *OIDCProvider) GetUserInfo(ctx context.Context, accessToken string) (*OIDCUserInfo, error) {
	// Use provider's userinfo endpoint if available
	if p.provider != nil {
		userInfo, err := p.provider.UserInfo(ctx, oauth2.StaticTokenSource(&oauth2.Token{
			AccessToken: accessToken,
		}))
		if err != nil {
			return nil, fmt.Errorf("failed to get user info: %w", err)
		}

		// Parse claims
		var claims map[string]interface{}
		if err := userInfo.Claims(&claims); err != nil {
			return nil, fmt.Errorf("failed to parse user claims: %w", err)
		}

		return p.parseUserInfo(claims)
	}

	// Fallback to manual userinfo request if URL is configured
	if p.config.UserInfoURL != "" {
		return p.getUserInfoFromURL(ctx, p.config.UserInfoURL, accessToken)
	}

	return nil, fmt.Errorf("no userinfo endpoint available")
}

// RefreshAccessToken refreshes an access token
func (p *OIDCProvider) RefreshAccessToken(ctx context.Context, refreshToken string) (*OIDCTokenResponse, error) {
	// Configure token source with refresh token
	token := &oauth2.Token{
		RefreshToken: refreshToken,
	}

	// Create a new token source
	tokenSource := p.oauthConfig.TokenSource(ctx, token)

	// Get new token
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Extract tokens
	response := &OIDCTokenResponse{
		AccessToken:  newToken.AccessToken,
		TokenType:    newToken.TokenType,
		ExpiresIn:    newToken.Expiry.Second(),
		RefreshToken: newToken.RefreshToken,
	}

	// Extract ID token if present
	if newToken.Extra("id_token") != nil {
		response.IDToken = newToken.Extra("id_token").(string)
	}

	return response, nil
}

// parseUserInfo parses user info claims into OIDCUserInfo
func (p *OIDCProvider) parseUserInfo(claims map[string]interface{}) (*OIDCUserInfo, error) {
	userInfo := &OIDCUserInfo{
		Attributes: make(map[string]interface{}),
	}

	// Extract standard claims
	if sub, ok := claims["sub"].(string); ok {
		userInfo.Sub = sub
	}
	if name, ok := claims["name"].(string); ok {
		userInfo.Name = name
	}
	if givenName, ok := claims["given_name"].(string); ok {
		userInfo.GivenName = givenName
	}
	if familyName, ok := claims["family_name"].(string); ok {
		userInfo.FamilyName = familyName
	}
	if email, ok := claims["email"].(string); ok {
		userInfo.Email = email
	}
	if emailVerified, ok := claims["email_verified"].(bool); ok {
		userInfo.EmailVerified = emailVerified
	}
	if picture, ok := claims["picture"].(string); ok {
		userInfo.Picture = picture
	}

	// Extract groups if present
	if groups, ok := claims["groups"].([]interface{}); ok {
		for _, group := range groups {
			if groupStr, ok := group.(string); ok {
				userInfo.Groups = append(userInfo.Groups, groupStr)
			}
		}
	}

	// Store all claims as attributes
	for key, value := range claims {
		userInfo.Attributes[key] = value
	}

	return userInfo, nil
}

// getUserInfoFromURL fetches user info from a URL
func (p *OIDCProvider) getUserInfoFromURL(ctx context.Context, userInfoURL, accessToken string) (*OIDCUserInfo, error) {
	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	// Add authorization header
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	// Execute request
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info endpoint returned status %d", resp.StatusCode)
	}

	// Parse response
	var claims map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse user info response: %w", err)
	}

	return p.parseUserInfo(claims)
}

// parseIDTokenWithoutVerification parses an ID token without verification (for testing only)
func (p *OIDCProvider) parseIDTokenWithoutVerification(idToken string) (*oidc.IDToken, error) {
	// This is a simplified parser for testing
	// In production, always use the verifier
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid ID token format")
	}

	// Decode payload
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode ID token payload: %w", err)
	}

	// Parse claims
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse ID token claims: %w", err)
	}

	// Create a mock ID token
	return &oidc.IDToken{
		Issuer:  getStringClaim(claims, "iss"),
		Subject: getStringClaim(claims, "sub"),
	}, nil
}

// getStringClaim safely extracts a string claim
func getStringClaim(claims map[string]interface{}, key string) string {
	if value, ok := claims[key].(string); ok {
		return value
	}
	return ""
}

// extractIssuerURL extracts the issuer URL from the token URL
func extractIssuerURL(tokenURL string) string {
	_, err := url.Parse(tokenURL)
	if err != nil {
		return ""
	}

	// Remove /token suffix if present
	baseURL := strings.TrimSuffix(tokenURL, "/token")
	if strings.HasSuffix(baseURL, "/") {
		baseURL = baseURL[:len(baseURL)-1]
	}

	// Try to discover the well-known configuration
	wellKnownURL := baseURL + "/.well-known/openid-configuration"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", wellKnownURL, nil)
	if err != nil {
		return ""
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()

	var config struct {
		Issuer string `json:"issuer"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return ""
	}

	return config.Issuer
}

// RevokeToken revokes an access token (if supported by the provider)
func (p *OIDCProvider) RevokeToken(ctx context.Context, accessToken string) error {
	// Check if provider supports revocation
	if p.provider != nil {
		// Try to get revocation endpoint from provider's discovery document
		var wellKnown struct {
			RevocationEndpoint string `json:"revocation_endpoint"`
		}

		// Fetch discovery document
		issuerURL := p.provider.Endpoint().AuthURL
		if idx := strings.LastIndex(issuerURL, "/"); idx > 0 {
			wellKnownURL := issuerURL[:idx] + "/.well-known/openid_configuration"
			req, _ := http.NewRequestWithContext(ctx, "GET", wellKnownURL, nil)
			resp, _ := http.DefaultClient.Do(req)
			if resp != nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				json.NewDecoder(resp.Body).Decode(&wellKnown)
			}
		}

		if wellKnown.RevocationEndpoint != "" {
			// Revoke token
			form := url.Values{}
			form.Add("token", accessToken)
			form.Add("client_id", p.config.ClientID)
			form.Add("client_secret", p.config.ClientSecret)

			req, err := http.NewRequestWithContext(ctx, "POST", wellKnown.RevocationEndpoint, strings.NewReader(form.Encode()))
			if err != nil {
				return err
			}
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("token revocation failed with status %d", resp.StatusCode)
			}

			return nil
		}
	}

	// Token revocation not supported
	return fmt.Errorf("token revocation not supported by provider")
}

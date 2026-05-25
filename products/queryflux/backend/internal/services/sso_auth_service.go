//go:build experimental_services

/**
 * SSO Authentication Service
 *
 * Handles SAML 2.0 and OIDC authentication for enterprise SSO
 */

package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// SSOAuthService handles single sign-on authentication
type SSOAuthService struct {
	userRepo       UserRepository
	teamRepo       TeamRepository
	samlConfig     *SAMLConfig
	oidcProviders  map[string]*OIDCProvider
	sessionManager *SSOSessionManager
	logger         *zap.Logger
	mu             sync.RWMutex
}

// SAMLConfig represents SAML configuration
type SAMLConfig struct {
	IDPEndpoint                string `json:"idpEndpoint"`
	Issuer                     string `json:"issuer"`
	SPAssertionConsumerService string `json:"spAssertionConsumerService"`
	SPEntityID                 string `json:"spEntityID"`
	X509Cert                   string `json:"x509Cert"`
	PrivateKey                 string `json:"privateKey"`
}

// OIDCProvider represents an OIDC provider configuration
type OIDCProvider struct {
	Name         string   `json:"name"`
	DiscoveryURL string   `json:"discoveryUrl"`
	ClientID     string   `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	RedirectURI  string   `json:"redirectUri"`
	Scopes       []string `json:"scopes"`
}

// SSOSessionManager manages SSO sessions
type SSOSessionManager struct {
	sessions map[string]*SSOSession
	mu       sync.RWMutex
	logger   *zap.Logger
}

// SSOSession represents an SSO authentication session
type SSOSession struct {
	ID             string            `json:"id"`
	State          string            `json:"state"`
	Nonce          string            `json:"nonce"`
	Provider       string            `json:"provider"`
	ProviderType   string            `json:"providerType"` // saml or oidc
	RedirectURL    string            `json:"redirectUrl"`
	CreatedAt      time.Time         `json:"createdAt"`
	ExpiresAt      time.Time         `json:"expiresAt"`
	UserAttributes map[string]string `json:"userAttributes"`
	CompletedAt    *time.Time        `json:"completedAt,omitempty"`
}

// SAMLResponse represents a SAML response
type SAMLResponse struct {
	ID           string        `xml:"ID,attr"`
	InResponseTo string        `xml:"InResponseTo,attr"`
	Issuer       SAMLIssuer    `xml:"Issuer"`
	Status       SAMLStatus    `xml:"Status"`
	Assertion    SAMLAssertion `xml:"Assertion"`
}

// SAMLIssuer represents the SAML issuer
type SAMLIssuer struct {
	Format string `xml:"Format,attr"`
	Value  string `xml:",chardata"`
}

// SAMLStatus represents the SAML status
type SAMLStatus struct {
	StatusCode    SAMLStatusCode `xml:"StatusCode"`
	StatusMessage string         `xml:"StatusMessage"`
}

// SAMLStatusCode represents the SAML status code
type SAMLStatusCode struct {
	Value string `xml:"Value,attr"`
}

// SAMLAssertion represents a SAML assertion
type SAMLAssertion struct {
	ID                 string                 `xml:"ID,attr"`
	IssueInstant       string                 `xml:"IssueInstant,attr"`
	Version            string                 `xml:"Version,attr"`
	Issuer             SAMLIssuer             `xml:"Issuer"`
	Subject            SAMLSubject            `xml:"Subject"`
	Conditions         SAMLConditions         `xml:"Conditions"`
	AttributeStatement SAMLAttributeStatement `xml:"AttributeStatement"`
}

// SAMLSubject represents the SAML subject
type SAMLSubject struct {
	NameID              SAMLNameID              `xml:"NameID"`
	SubjectConfirmation SAMLSubjectConfirmation `xml:"SubjectConfirmation"`
}

// SAMLNameID represents the SAML name ID
type SAMLNameID struct {
	Format string `xml:"Format,attr"`
	Value  string `xml:",chardata"`
}

// SAMLSubjectConfirmation represents subject confirmation
type SAMLSubjectConfirmation struct {
	Method                  string                      `xml:"Method,attr"`
	SubjectConfirmationData SAMLSubjectConfirmationData `xml:"SubjectConfirmationData"`
}

// SAMLSubjectConfirmationData represents confirmation data
type SAMLSubjectConfirmationData struct {
	NotOnOrAfter string `xml:"NotOnOrAfter,attr"`
	Recipient    string `xml:"Recipient,attr"`
}

// SAMLConditions represents SAML conditions
type SAMLConditions struct {
	NotBefore            string                    `xml:"NotBefore,attr"`
	NotOnOrAfter         string                    `xml:"NotOnOrAfter,attr"`
	AudienceRestrictions []SAMLAudienceRestriction `xml:"AudienceRestriction"`
}

// SAMLAudienceRestriction represents audience restriction
type SAMLAudienceRestriction struct {
	Audience string `xml:"Audience"`
}

// SAMLAttributeStatement represents attribute statements
type SAMLAttributeStatement struct {
	Attributes []SAMLAttribute `xml:"Attribute"`
}

// SAMLAttribute represents a SAML attribute
type SAMLAttribute struct {
	Name   string   `xml:"Name,attr"`
	Values []string `xml:"AttributeValue"`
}

// OIDCTokenResponse represents an OIDC token response
type OIDCTokenResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	Scope        string `json:"scope,omitempty"`
}

// OIDCUserInfo represents OIDC user information
type OIDCUserInfo struct {
	Sub           string   `json:"sub"`
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	Picture       string   `json:"picture"`
	GivenName     string   `json:"given_name"`
	FamilyName    string   `json:"family_name"`
	Groups        []string `json:"groups,omitempty"`
}

// CreateSSOSessionRequest represents a request to create an SSO session
type CreateSSOSessionRequest struct {
	Provider     string `json:"provider"`     // azure, okta, google
	ProviderType string `json:"providerType"` // saml or oidc
	RedirectURL  string `json:"redirectUrl"`
	TeamID       string `json:"teamId,omitempty"`
}

// SSOAuthenticationResult represents the result of SSO authentication
type SSOAuthenticationResult struct {
	UserID     string            `json:"userId"`
	Email      string            `json:"email"`
	Name       string            `json:"name"`
	Provider   string            `json:"provider"`
	Attributes map[string]string `json:"attributes"`
	Created    bool              `json:"created"`
	Teams      []string          `json:"teams,omitempty"`
}

// NewSSOAuthService creates a new SSO authentication service
func NewSSOAuthService(
	userRepo UserRepository,
	teamRepo TeamRepository,
	samlConfig *SAMLConfig,
	logger *zap.Logger,
) *SSOAuthService {
	service := &SSOAuthService{
		userRepo:       userRepo,
		teamRepo:       teamRepo,
		samlConfig:     samlConfig,
		oidcProviders:  make(map[string]*OIDCProvider),
		sessionManager: NewSSOSessionManager(logger),
		logger:         logger,
	}

	// Register default OIDC providers
	service.registerDefaultProviders()

	return service
}

// registerDefaultProviders registers default OIDC providers
func (s *SSOAuthService) registerDefaultProviders() {
	// Azure AD
	s.oidcProviders["azure"] = &OIDCProvider{
		Name:         "Azure AD",
		DiscoveryURL: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
		ClientID:     "", // Set from environment/config
		ClientSecret: "", // Set from environment/config
		RedirectURI:  "", // Set from environment/config
		Scopes:       []string{"openid", "profile", "email"},
	}

	// Okta
	s.oidcProviders["okta"] = &OIDCProvider{
		Name:         "Okta",
		DiscoveryURL: "", // Set from environment/config
		ClientID:     "", // Set from environment/config
		ClientSecret: "", // Set from environment/config
		RedirectURI:  "", // Set from environment/config
		Scopes:       []string{"openid", "profile", "email", "groups"},
	}

	// Google Workspace
	s.oidcProviders["google"] = &OIDCProvider{
		Name:         "Google Workspace",
		DiscoveryURL: "https://accounts.google.com/.well-known/openid-configuration",
		ClientID:     "", // Set from environment/config
		ClientSecret: "", // Set from environment/config
		RedirectURI:  "", // Set from environment/config
		Scopes:       []string{"openid", "profile", "email"},
	}
}

// CreateSession creates an SSO authentication session
func (s *SSOAuthService) CreateSession(
	ctx context.Context,
	request *CreateSSOSessionRequest,
) (*SSOSession, error) {
	s.logger.Info("creating SSO session",
		zap.String("provider", request.Provider),
		zap.String("provider_type", request.ProviderType),
	)

	// Generate state and nonce
	state := generateSecureToken(32)
	nonce := generateSecureToken(32)

	session := &SSOSession{
		ID:             generateID(),
		State:          state,
		Nonce:          nonce,
		Provider:       request.Provider,
		ProviderType:   request.ProviderType,
		RedirectURL:    request.RedirectURL,
		CreatedAt:      time.Now(),
		ExpiresAt:      time.Now().Add(10 * time.Minute),
		UserAttributes: make(map[string]string),
	}

	// Store session
	s.sessionManager.Create(session)

	s.logger.Info("SSO session created",
		zap.String("session_id", session.ID),
		zap.String("state", state),
	)

	return session, nil
}

// GetAuthorizationURL returns the authorization URL for SSO
func (s *SSOAuthService) GetAuthorizationURL(
	ctx context.Context,
	session *SSOSession,
) (string, error) {
	if session.ProviderType == "oidc" {
		return s.getOIDCAuthorizationURL(ctx, session)
	}
	return s.getSAMLAuthorizationURL(ctx, session)
}

// getOIDCAuthorizationURL generates OIDC authorization URL
func (s *SSOAuthService) getOIDCAuthorizationURL(
	ctx context.Context,
	session *SSOSession,
) (string, error) {
	provider, exists := s.oidcProviders[session.Provider]
	if !exists {
		return "", fmt.Errorf("OIDC provider not found: %s", session.Provider)
	}

	// Fetch discovery document to get authorization endpoint
	authEndpoint, err := s.fetchOIDCDiscoveryEndpoint(ctx, provider.DiscoveryURL, "authorization_endpoint")
	if err != nil {
		return "", fmt.Errorf("failed to fetch discovery document: %w", err)
	}

	// Build authorization URL
	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", provider.ClientID)
	params.Set("redirect_uri", provider.RedirectURI)
	params.Set("scope", strings.Join(provider.Scopes, " "))
	params.Set("state", session.State)
	params.Set("nonce", session.Nonce)

	authURL := fmt.Sprintf("%s?%s", authEndpoint, params.Encode())

	return authURL, nil
}

// getSAMLAuthorizationURL generates SAML authorization URL
func (s *SSOAuthService) getSAMLAuthorizationURL(
	ctx context.Context,
	session *SSOSession,
) (string, error) {
	if s.samlConfig == nil {
		return "", fmt.Errorf("SAML not configured")
	}

	// Build SAML request
	samlRequest, err := s.buildSAMLRequest(session)
	if err != nil {
		return "", fmt.Errorf("failed to build SAML request: %w", err)
	}

	// Encode SAML request
	encodedRequest := base64.StdEncoding.EncodeToString([]byte(samlRequest))

	// Build authorization URL with SAML request
	params := url.Values{}
	params.Set("SAMLRequest", encodedRequest)
	params.Set("RelayState", session.State)

	authURL := fmt.Sprintf("%s?%s", s.samlConfig.IDPEndpoint, params.Encode())

	return authURL, nil
}

// HandleOIDCCallback handles OIDC authentication callback
func (s *SSOAuthService) HandleOIDCCallback(
	ctx context.Context,
	code string,
	state string,
) (*SSOAuthenticationResult, error) {
	s.logger.Info("handling OIDC callback", zap.String("state", state))

	// Get session
	session, err := s.sessionManager.GetByState(state)
	if err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	// Get provider
	provider, exists := s.oidcProviders[session.Provider]
	if !exists {
		return nil, fmt.Errorf("OIDC provider not found: %s", session.Provider)
	}

	// Exchange code for tokens
	tokens, err := s.exchangeCodeForTokens(ctx, provider, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for tokens: %w", err)
	}

	// Get user info
	userInfo, err := s.getOIDCUserInfo(ctx, provider, tokens.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	// Authenticate or create user
	result, err := s.authenticateOrCreateUser(ctx, userInfo.Sub, userInfo.Email, userInfo.Name, session.Provider, map[string]string{
		"picture":     userInfo.Picture,
		"given_name":  userInfo.GivenName,
		"family_name": userInfo.FamilyName,
		"groups":      strings.Join(userInfo.Groups, ","),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate user: %w", err)
	}

	// Mark session as completed
	now := time.Now()
	session.CompletedAt = &now
	session.UserAttributes = map[string]string{
		"user_id": result.UserID,
		"email":   result.Email,
		"name":    result.Name,
	}
	s.sessionManager.Update(session)

	s.logger.Info("OIDC authentication successful",
		zap.String("user_id", result.UserID),
		zap.String("email", result.Email),
	)

	return result, nil
}

// HandleSAMLCallback handles SAML authentication callback
func (s *SSOAuthService) HandleSAMLCallback(
	ctx context.Context,
	samlResponse string,
	relayState string,
) (*SSOAuthenticationResult, error) {
	s.logger.Info("handling SAML callback", zap.String("relay_state", relayState))

	// Get session
	session, err := s.sessionManager.GetByState(relayState)
	if err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	// Parse SAML response
	var response SAMLResponse
	if err := xml.Unmarshal([]byte(samlResponse), &response); err != nil {
		return nil, fmt.Errorf("failed to parse SAML response: %w", err)
	}

	// Validate SAML response
	if err := s.validateSAMLResponse(&response); err != nil {
		return nil, fmt.Errorf("SAML response validation failed: %w", err)
	}

	// Extract user attributes
	attributes := s.extractSAMLAttributes(&response)

	// Get email and name from attributes
	email := attributes["email"]
	name := attributes["name"]
	if name == "" {
		name = attributes["http://schemas.microsoft.com/identity/claims/displayname"]
	}
	if email == "" {
		email = attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
	}
	nameID := response.Assertion.Subject.NameID.Value

	// Authenticate or create user
	result, err := s.authenticateOrCreateUser(ctx, nameID, email, name, session.Provider, attributes)
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate user: %w", err)
	}

	// Mark session as completed
	now := time.Now()
	session.CompletedAt = &now
	session.UserAttributes = map[string]string{
		"user_id": result.UserID,
		"email":   result.Email,
		"name":    result.Name,
	}
	s.sessionManager.Update(session)

	s.logger.Info("SAML authentication successful",
		zap.String("user_id", result.UserID),
		zap.String("email", result.Email),
	)

	return result, nil
}

// exchangeCodeForTokens exchanges authorization code for tokens
func (s *SSOAuthService) exchangeCodeForTokens(
	ctx context.Context,
	provider *OIDCProvider,
	code string,
) (*OIDCTokenResponse, error) {
	// Fetch discovery document to get token endpoint
	tokenEndpoint, err := s.fetchOIDCDiscoveryEndpoint(ctx, provider.DiscoveryURL, "token_endpoint")
	if err != nil {
		return nil, err
	}

	// Build token request
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", provider.RedirectURI)
	data.Set("client_id", provider.ClientID)
	data.Set("client_secret", provider.ClientSecret)

	// Create HTTP request
	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		tokenEndpoint,
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token request failed with status %d", resp.StatusCode)
	}

	// Parse response
	var tokens OIDCTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// getOIDCUserInfo retrieves user info from OIDC provider
func (s *SSOAuthService) getOIDCUserInfo(
	ctx context.Context,
	provider *OIDCProvider,
	accessToken string,
) (*OIDCUserInfo, error) {
	// Fetch discovery document to get userinfo endpoint
	userInfoEndpoint, err := s.fetchOIDCDiscoveryEndpoint(ctx, provider.DiscoveryURL, "userinfo_endpoint")
	if err != nil {
		return nil, err
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(
		ctx,
		"GET",
		userInfoEndpoint,
		nil,
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo request failed with status %d", resp.StatusCode)
	}

	// Parse response
	var userInfo OIDCUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// fetchOIDCDiscoveryEndpoint fetches endpoint from OIDC discovery document
func (s *SSOAuthService) fetchOIDCDiscoveryEndpoint(
	ctx context.Context,
	discoveryURL string,
	endpoint string,
) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", discoveryURL, nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("discovery request failed with status %d", resp.StatusCode)
	}

	var discovery map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&discovery); err != nil {
		return "", err
	}

	endpointURL, ok := discovery[endpoint].(string)
	if !ok {
		return "", fmt.Errorf("endpoint %s not found in discovery document", endpoint)
	}

	return endpointURL, nil
}

// authenticateOrCreateUser authenticates existing user or creates new one
func (s *SSOAuthService) authenticateOrCreateUser(
	ctx context.Context,
	providerID string,
	email string,
	name string,
	provider string,
	attributes map[string]string,
) (*SSOAuthenticationResult, error) {
	// Try to find existing user by provider ID
	user, err := s.userRepo.FindByProviderID(ctx, provider, providerID)
	if err == nil {
		// User exists, update last login
		return &SSOAuthenticationResult{
			UserID:     user.ID,
			Email:      user.Email,
			Name:       user.Name,
			Provider:   provider,
			Attributes: attributes,
			Created:    false,
		}, nil
	}

	// Try to find by email
	user, err = s.userRepo.FindByEmail(ctx, email)
	if err == nil {
		// User exists, link SSO account
		return &SSOAuthenticationResult{
			UserID:     user.ID,
			Email:      user.Email,
			Name:       user.Name,
			Provider:   provider,
			Attributes: attributes,
			Created:    false,
		}, nil
	}

	// Create new user
	// This would call the user repository to create the user
	return &SSOAuthenticationResult{
		UserID:     generateID(),
		Email:      email,
		Name:       name,
		Provider:   provider,
		Attributes: attributes,
		Created:    true,
	}, nil
}

// validateSAMLResponse validates a SAML response
func (s *SSOAuthService) validateSAMLResponse(response *SAMLResponse) error {
	// Check status
	if response.Status.StatusCode.Value != "urn:oasis:names:tc:SAML:2.0:status:Success" {
		return fmt.Errorf("SAML status not successful: %s", response.Status.StatusCode.Value)
	}

	// Check conditions (timestamp validation would go here)
	// In production, you would validate:
	// - NotBefore and NotOnOrAfter timestamps
	// - Audience restrictions
	// - Signature verification
	// - Certificate validation

	return nil
}

// extractSAMLAttributes extracts attributes from SAML response
func (s *SSOAuthService) extractSAMLAttributes(response *SAMLResponse) map[string]string {
	attributes := make(map[string]string)

	for _, attr := range response.Assertion.AttributeStatement.Attributes {
		if len(attr.Values) > 0 {
			attributes[attr.Name] = attr.Values[0]
		}
	}

	return attributes
}

// buildSAMLRequest builds a SAML authentication request
func (s *SSOAuthService) buildSAMLRequest(session *SSOSession) (string, error) {
	// This is a simplified SAML request
	// In production, you would use a proper SAML library
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")

	request := fmt.Sprintf(`<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
	ID="%s" Version="2.0" IssueInstant="%s"
	ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
	AssertionConsumerServiceURL="%s"
	Destination="%s">
	<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">%s</saml:Issuer>
	<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"/>
	<samlp:RequestedAuthnContext Comparison="exact">
		<saml:AuthnContextClassRef xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
		urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
		</saml:AuthnContextClassRef>
	</samlp:RequestedAuthnContext>
</samlp:AuthnRequest>`,
		generateID(),
		now,
		s.samlConfig.SPAssertionConsumerService,
		s.samlConfig.IDPEndpoint,
		s.samlConfig.SPEntityID,
	)

	return request, nil
}

// NewSSOSessionManager creates a new SSO session manager
func NewSSOSessionManager(logger *zap.Logger) *SSOSessionManager {
	return &SSOSessionManager{
		sessions: make(map[string]*SSOSession),
		logger:   logger,
	}
}

// Create stores a new SSO session
func (m *SSOSessionManager) Create(session *SSOSession) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[session.ID] = session
}

// Get retrieves an SSO session by ID
func (m *SSOSessionManager) Get(id string) (*SSOSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[id]
	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired")
	}

	return session, nil
}

// GetByState retrieves an SSO session by state
func (m *SSOSessionManager) GetByState(state string) (*SSOSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, session := range m.sessions {
		if session.State == state {
			if time.Now().After(session.ExpiresAt) {
				return nil, fmt.Errorf("session expired")
			}
			return session, nil
		}
	}

	return nil, fmt.Errorf("session not found for state")
}

// Update updates an SSO session
func (m *SSOSessionManager) Update(session *SSOSession) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[session.ID] = session
}

// Delete removes an SSO session
func (m *SSOSessionManager) Delete(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, id)
}

// Helper functions

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateSecureToken(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

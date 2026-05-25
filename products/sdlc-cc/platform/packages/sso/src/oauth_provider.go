package sso

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/github"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gorilla/sessions"
)

// OAuthProvider provides OAuth2/OIDC integration
type OAuthProvider struct {
	config       *OAuthConfig
	providers    map[string]*oauth2.Config
	sessionStore SessionStore
	logger       Logger
}

// OAuthConfig holds OAuth configuration
type OAuthConfig struct {
	Providers    map[string]ProviderConfig `json:"providers"`
	CallbackURL  string                     `json:"callback_url"`
	Scopes       []string                   `json:"scopes"`
	SessionTimeout time.Duration              `json:"session_timeout"`
	AllowedDomains []string                   `json:"allowed_domains"`
	EnablePKCE    bool                       `json:"enable_pkce"`
	StateTimeout  time.Duration              `json:"state_timeout"`
}

// ProviderConfig holds configuration for a specific OAuth provider
type ProviderConfig struct {
	ClientID     string            `json:"client_id"`
	ClientSecret string            `json:"client_secret"`
	AuthURL      string            `json:"auth_url"`
	TokenURL     string            `json:"token_url"`
	UserInfoURL  string            `json:"user_info_url"`
	Scopes       []string          `json:"scopes"`
	DisplayName  string            `json:"display_name"`
	Icon         string            `json:"icon"`
	ProviderType string            `json:"provider_type"` // oauth2, oidc
}

// UserInfo represents user information from OAuth provider
type UserInfo struct {
	ID       string                 `json:"id"`
	Email    string                 `json:"email"`
	Name     string                 `json:"name"`
	Picture  string                 `json:"picture"`
	TenantID string                 `json:"tenant_id"`
	Roles    []string               `json:"roles"`
	Provider string                 `json:"provider"`
	Claims   map[string]interface{} `json:"claims"`
}

// OAuthState represents OAuth state for CSRF protection
type OAuthState struct {
	State       string    `json:"state"`
	Provider    string    `json:"provider"`
	RedirectURL string    `json:"redirect_url"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// NewOAuthProvider creates a new OAuth provider
func NewOAuthProvider(config *OAuthConfig, sessionStore SessionStore) (*OAuthProvider, error) {
	provider := &OAuthProvider{
		config:       config,
		providers:    make(map[string]*oauth2.Config),
		sessionStore: sessionStore,
		logger:       NewDefaultLogger(),
	}

	// Initialize OAuth providers
	if err := provider.initializeProviders(); err != nil {
		return nil, fmt.Errorf("failed to initialize OAuth providers: %w", err)
	}

	return provider, nil
}

// initializeProviders sets up OAuth provider configurations
func (p *OAuthProvider) initializeProviders() error {
	for name, config := range p.config.Providers {
		var oauthConfig *oauth2.Config

		switch strings.ToLower(config.ProviderType) {
		case "google":
			oauthConfig = &oauth2.Config{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				Scopes:       config.Scopes,
				Endpoint:     google.Endpoint,
				RedirectURL:  p.config.CallbackURL,
			}

		case "github":
			oauthConfig = &oauth2.Config{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				Scopes:       config.Scopes,
				Endpoint:     github.Endpoint,
				RedirectURL:  p.config.CallbackURL,
			}

		case "oidc":
			// For OIDC providers, we need to discover endpoints
			provider, err := oidc.NewProvider(context.Background(), config.AuthURL)
			if err != nil {
				return fmt.Errorf("failed to create OIDC provider for %s: %w", name, err)
			}

			oauthConfig = &oauth2.Config{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				Scopes:       config.Scopes,
				Endpoint: oauth2.Endpoint{
					AuthURL:   provider.Endpoint().AuthURL,
					TokenURL:  provider.Endpoint().TokenURL,
					AuthStyle: oauth2.AuthStyleInParams,
				},
				RedirectURL: p.config.CallbackURL,
			}

		default:
			// Generic OAuth2 provider
			oauthConfig = &oauth2.Config{
				ClientID:     config.ClientID,
				ClientSecret: config.ClientSecret,
				Scopes:       config.Scopes,
				Endpoint: oauth2.Endpoint{
					AuthURL:   config.AuthURL,
					TokenURL:  config.TokenURL,
					UserInfoURL: config.UserInfoURL,
				},
				RedirectURL: p.config.CallbackURL,
			}
		}

		p.providers[name] = oauthConfig
		p.logger.Info("Initialized OAuth provider", "name", name, "type", config.ProviderType)
	}

	return nil
}

// HandleOAuthLogin initiates OAuth login for a provider
func (p *OAuthProvider) HandleOAuthLogin(w http.ResponseWriter, r *http.Request) {
	providerName := r.URL.Query().Get("provider")
	if providerName == "" {
		p.logger.Error("No provider specified")
		http.Error(w, "Provider not specified", http.StatusBadRequest)
		return
	}

	config, exists := p.config.Providers[providerName]
	if !exists {
		p.logger.Error("Unknown provider", "provider", providerName)
		http.Error(w, "Unknown provider", http.StatusBadRequest)
		return
	}

	oauthConfig, exists := p.providers[providerName]
	if !exists {
		p.logger.Error("OAuth config not found", "provider", providerName)
		http.Error(w, "OAuth config not found", http.StatusInternalServerError)
		return
	}

	// Generate state
	state := p.generateState(providerName, r.URL.Query().Get("redirect_url"))

	// Store state
	stateData := &OAuthState{
		State:       state,
		Provider:    providerName,
		RedirectURL: r.URL.Query().Get("redirect_url"),
		CreatedAt:   time.Now().UTC(),
		ExpiresAt:   time.Now().UTC().Add(p.config.StateTimeout),
	}

	session := &Session{
		ID:         generateSessionID(),
		Attributes: map[string]interface{}{
			"oauth_state": stateData,
		},
		CreatedAt:   time.Now().UTC(),
		ExpiresAt:   time.Now().UTC().Add(p.config.SessionTimeout),
	}

	if err := p.sessionStore.Create(session); err != nil {
		p.logger.Error("Failed to create session", "error", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	// Build authorization URL
	var authURL string
	if p.config.EnablePKCE {
		// Use PKCE for mobile/native apps
		pkceVerifier := oauth2.GenerateVerifier()
		session.Attributes["pkce_verifier"] = pkceVerifier
		session.Attributes["pkce_challenge"] = oauth2.S256ChallengeOption(pkceVerifier)

		if err := p.sessionStore.Update(session.ID, session); err != nil {
			p.logger.Error("Failed to update session with PKCE", "error", err)
		}

		authURL = oauthConfig.AuthCodeURL(
			oauth2.SetAuthURLParam("code_challenge", session.Attributes["pkce_challenge"].(string)),
			oauth2.SetAuthURLParam("code_challenge_method", "S256"),
			oauth2.SetAuthURLParam("state", state),
		)
	} else {
		authURL = oauthConfig.AuthCodeURL(oauth2.SetAuthURLParam("state", state))
	}

	p.logger.Info("Initiating OAuth login",
		"provider", providerName,
		"state", state,
		"redirect_url", stateData.RedirectURL)

	http.Redirect(w, r, authURL, http.StatusFound)
}

// HandleOAuthCallback handles OAuth callback from provider
func (p *OAuthProvider) HandleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state == "" {
		p.logger.Error("No state parameter in callback")
		http.Error(w, "No state parameter", http.StatusBadRequest)
		return
	}

	// Find session by state
	session, err := p.findSessionByState(state)
	if err != nil {
		p.logger.Error("Session not found for state", "state", state)
		http.Error(w, "Invalid state", http.StatusBadRequest)
		return
	}

	providerConfig := p.config.Providers[session.Attributes["oauth_state"].(OAuthState).Provider]
	oauthConfig := p.providers[session.Attributes["oauth_state"].(OAuthState).Provider]

	// Verify PKCE if enabled
	var tokenOptions []oauth2.AuthCodeOption
	if p.config.EnablePKCE {
		pkceVerifier, ok := session.Attributes["pkce_verifier"].(string)
		if !ok {
			p.logger.Error("PKCE verifier not found in session")
			http.Error(w, "Invalid PKCE state", http.StatusBadRequest)
			return
		}

		tokenOptions = append(tokenOptions,
			oauth2.SetAuthURLParam("code_verifier", pkceVerifier),
			oauth2.SetAuthURLParam("redirect_uri", p.config.CallbackURL),
		)
	}

	// Exchange authorization code for token
	code := r.URL.Query().Get("code")
	if code == "" {
		p.logger.Error("No authorization code in callback")
		http.Error(w, "No authorization code", http.StatusBadRequest)
		return
	}

	token, err := oauthConfig.Exchange(r.Context(), code, tokenOptions...)
	if err != nil {
		p.logger.Error("Failed to exchange authorization code", "error", err)
		http.Error(w, "Failed to exchange authorization code", http.StatusBadRequest)
		return
	}

	// Get user info
	userInfo, err := p.getUserInfo(providerConfig, token)
	if err != nil {
		p.logger.Error("Failed to get user info", "error", err)
		http.Error(w, "Failed to get user information", http.StatusInternalServerError)
		return
	}

	// Validate domain
	if !p.validateDomain(userInfo.Email) {
		p.logger.Error("User domain not allowed", "email", userInfo.Email)
		http.Error(w, "User domain not allowed", http.StatusForbidden)
		return
	}

	// Extract tenant ID
	if userInfo.TenantID == "" {
		if userInfo.Email != "" {
			parts := strings.Split(userInfo.Email, "@")
			if len(parts) > 1 {
				userInfo.TenantID = parts[1]
			}
		}
		if userInfo.ID != "" {
			userInfo.TenantID = userInfo.ID
		}
	}

	// Create user session
	userSession := &Session{
		ID:           session.ID,
		UserID:       userInfo.ID,
		TenantID:     userInfo.TenantID,
		Email:        userInfo.Email,
		Name:         userInfo.Name,
		Roles:        userInfo.Roles,
		Attributes: map[string]interface{}{
			"provider":   providerName,
			"claims":     userInfo.Claims,
			"picture":    userInfo.Picture,
		},
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(p.config.SessionTimeout),
		LastAccessed: time.Now().UTC(),
	}

	if err := p.sessionStore.Update(session.ID, userSession); err != nil {
		p.logger.Error("Failed to update session", "error", err)
		http.Error(w, "Failed to create user session", http.StatusInternalServerError)
		return
	}

	// Store OAuth token for API calls
	userSession.Attributes["access_token"] = token.AccessToken
	userSession.Attributes["refresh_token"] = token.RefreshToken
	userSession.Attributes["token_expiry"] = token.Expiry
	if token.Extra != nil {
		for key, value := range token.Extra {
			userSession.Attributes[key] = value
		}
	}

	if err := p.sessionStore.Update(session.ID, userSession); err != nil {
		p.logger.Error("Failed to store tokens in session", "error", err)
	}

	// Set session cookie
	sessionCookie := &http.Cookie{
		Name:     "sdlc_session",
		Value:    userSession.ID,
		Path:     "/",
		MaxAge:   int(p.config.SessionTimeout.Seconds()),
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	}

	http.SetCookie(w, sessionCookie)

	// Redirect to application
	redirectURL := session.Attributes["oauth_state"].(OAuthState).RedirectURL
	if redirectURL == "" {
		redirectURL = "/"
	}

	p.logger.Info("OAuth authentication successful",
		"provider", providerName,
		"user_id", userInfo.ID,
		"email", userInfo.Email,
		"tenant_id", userInfo.TenantID)

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// HandleOAuthLogout handles OAuth logout
func (p *OAuthProvider) HandleOAuthLogout(w http.ResponseWriter, r *http.Request) {
	// Get session
	sessionID := p.getSessionIDFromRequest(r)
	if sessionID == "" {
		p.logger.Error("No session found for logout")
		http.Error(w, "No session found", http.StatusBadRequest)
		return
	}

	session, err := p.sessionStore.Get(sessionID)
	if err != nil {
		p.logger.Error("Failed to get session for logout", "error", err)
		http.Error(w("Session not found", http.StatusNotFound)
		return
	}

	// Revoke OAuth token if available
	if accessToken, ok := session.Attributes["access_token"].(string); ok {
		// TODO: Implement token revocation for different providers
		p.logger.Info("Revoking OAuth token", "provider", session.Attributes["provider"])
	}

	// Delete session
	if err := p.sessionStore.Delete(sessionID); err != nil {
		p.logger.Error("Failed to delete session", "error", err)
	}

	// Clear session cookie
	sessionCookie := &http.Cookie{
		Name:     "sdlc_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	}

	http.SetCookie(w, sessionCookie)

	// Redirect to logout page or home
	redirectURL := r.URL.Query().Get("redirect_url")
	if redirectURL == "" {
		redirectURL = "/"
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// getUserInfo retrieves user information from OAuth provider
func (p *OAuthProvider) getUserInfo(config ProviderConfig, token *oauth2.Token) (*UserInfo, error) {
	userInfo := &UserInfo{
		Provider: config.DisplayName,
	}

	// Set access token in request
	req, err := http.NewRequest("GET", config.UserInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status: %d", resp.StatusCode)
	}

	var userData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
		return nil, fmt.Errorf("failed to parse user info response: %w", err)
	}

	// Extract standard fields
	if id, ok := userData["id"].(string); ok {
		userInfo.ID = id
	}
	if email, ok := userData["email"].(string); ok {
		userInfo.Email = email
	}
	if name, ok := userData["name"].(string); ok {
		userInfo.Name = name
	}
	if picture, ok := userData["picture"].(string); ok {
		userInfo.Picture = picture
	}

	// Store all claims
	userInfo.Claims = userData

	return userInfo, nil
}

// GetProviders returns available OAuth providers
func (p *OAuthProvider) GetProviders() map[string]ProviderConfig {
	return p.config.Providers
}

// GetProviderConfig returns configuration for a specific provider
func (p *OAuthProvider) GetProviderConfig(name string) (ProviderConfig, bool) {
	config, exists := p.config.Providers[name]
	return config, exists
}

// validateDomain checks if the user's email domain is allowed
func (p *OAuthProvider) validateDomain(email string) bool {
	if len(p.config.AllowedDomains) == 0 {
		return true // No domain restrictions
	}

	parts := strings.Split(email, "@")
	if len(parts) < 2 {
		return false
	}

	domain := parts[1]
	for _, allowedDomain := range p.config.AllowedDomains {
		if domain == allowedDomain || strings.HasSuffix(domain, "."+allowedDomain) {
			return true
		}
	}

	return false
}

// Helper methods

func (p *OAuthProvider) generateState(providerName, redirectURL string) string {
	return fmt.Sprintf("%s_%d_%s", providerName, time.Now().Unix(), redirectURL)
}

func (p *OAuthProvider) findSessionByState(state string) (*Session, error) {
	// In a real implementation, this would query the session store
	// For now, we'll use a simple in-memory approach
	// TODO: Implement proper session store query

	// This is a simplified implementation
	// In production, you'd want to store OAuth states in Redis or another fast store
	for _, session := range p.sessionStore.List() {
		if oauthState, ok := session.Attributes["oauth_state"]; ok {
			if stateData, ok := oauthState.(OAuthState); ok && stateData.State == state {
				return session, nil
			}
		}
	}

	return nil, fmt.Errorf("session not found for state")
}

func (p *OAuthProvider) getSessionIDFromRequest(r *http.Request) string {
	cookie, err := r.Cookie("sdlc_session")
	if err != nil {
		return ""
	}
	return cookie.Value
}

// SessionStore interface for session management
type SessionStore interface {
	Create(session *Session) error
	Get(sessionID string) (*Session, error)
	Update(sessionID string, session *Session) error
	Delete(sessionID string) error
	List() []*Session
	Cleanup() error
}

// SessionStore interface for session management (continued)
func (p *OAuthProvider) CleanupExpiredSessions() error {
	// Clean up expired sessions and states
	sessions := p.sessionStore.List()
	now := time.Now()

	for _, session := range sessions {
		if session.ExpiresAt.Before(now) {
			if err := p.sessionStore.Delete(session.ID); err != nil {
				p.logger.Error("Failed to delete expired session", "session_id", session.ID)
			}
		}

		// Also clean up expired OAuth states
		if oauthState, ok := session.Attributes["oauth_state"]; ok {
			if stateData, ok := oauthState.(OAuthState); ok && stateData.ExpiresAt.Before(now) {
				if err := p.sessionStore.Update(session.ID, session); err != nil {
					p.logger.Error("Failed to clean up expired OAuth state", "session_id", session.ID)
				}
			}
		}
	}

	return nil
}

// Periodic cleanup goroutine
func (p *OAuthProvider) StartCleanupRoutine(interval time.Duration) {
	ticker := time.NewTicker(interval)

	go func() {
		for range ticker.C {
			if err := p.CleanupExpiredSessions(); err != nil {
				p.logger.Error("Failed to cleanup expired sessions", "error", err)
			}
		}
	}()
}

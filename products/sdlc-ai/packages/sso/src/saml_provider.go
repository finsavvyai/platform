package sso

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/crewjam/saml"
	"github.com/crewjam/saml/samlsp"
	"github.com/crewjam/saml/tools"
)

// SAMLProvider provides enterprise SSO integration
type SAMLProvider struct {
	config          *SAMLConfig
	serviceProvider *samlsp.ServiceProvider
	sessionStore    SessionStore
	logger          Logger
}

// SAMLConfig holds SAML configuration
type SAMLConfig struct {
	EntityID                   string            `json:"entity_id"`
	SLOURL                     string            `json:"slo_url"`
	SSOURL                     string            `json:"sso_url"`
	CertificatePath            string            `json:"certificate_path"`
	PrivateKeyPath             string            `json:"private_key_path"`
	IDPMetadataURL             string            `json:"idp_metadata_url"`
	IDPEntityID                string            `json:"idp_entity_id"`
	NameIDFormat               string            `json:"name_id_format"`
	AttributeMappings          map[string]string `json:"attribute_mappings"`
	SessionTimeout             time.Duration     `json:"session_timeout"`
	AllowedDomains             []string          `json:"allowed_domains"`
	RequireSignedAssertions    bool              `json:"require_signed_assertions"`
	RequireEncryptedAssertions bool              `json:"require_encrypted_assertions"`
	SignatureMethod            string            `json:"signature_method"`
	DigestAlgorithm            string            `json:"digest_algorithm"`
}

// SessionStore interface for session management
type SessionStore interface {
	Create(session *Session) error
	Get(sessionID string) (*Session, error)
	Update(sessionID string, session *Session) error
	Delete(sessionID string) error
	Cleanup() error
}

// Session represents a user session
type Session struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	TenantID     string                 `json:"tenant_id"`
	Email        string                 `json:"email"`
	Name         string                 `json:"name"`
	Roles        []string               `json:"roles"`
	Attributes   map[string]interface{} `json:"attributes"`
	CreatedAt    time.Time              `json:"created_at"`
	ExpiresAt    time.Time              `json:"expires_at"`
	LastAccessed time.Time              `json:"last_accessed"`
}

// Logger interface for structured logging
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
}

// NewSAMLProvider creates a new SAML provider
func NewSAMLProvider(config *SAMLConfig, sessionStore SessionStore) (*SAMLProvider, error) {
	provider := &SAMLProvider{
		config:       config,
		sessionStore: sessionStore,
		logger:       NewDefaultLogger(),
	}

	// Initialize SAML service provider
	if err := provider.initializeServiceProvider(); err != nil {
		return nil, fmt.Errorf("failed to initialize service provider: %w", err)
	}

	return provider, nil
}

// initializeServiceProvider sets up the SAML service provider
func (p *SAMLProvider) initializeServiceProvider() error {
	// Load certificate and private key
	cert, err := tools.LoadCertificate(p.config.CertificatePath)
	if err != nil {
		return fmt.Errorf("failed to load certificate: %w", err)
	}

	privateKey, err := tools.LoadPrivateKey(p.config.PrivateKeyPath)
	if err != nil {
		return fmt.Errorf("failed to load private key: %w", err)
	}

	// Parse signature and digest methods
	signatureMethod := saml.HTTPPostBinding
	digestMethod := saml.SHA256Digest

	switch p.config.SignatureMethod {
	case "SHA1":
		signatureMethod = saml.HTTPPostBinding
		digestMethod = saml.SHA1Digest
	case "SHA256":
		signatureMethod = saml.HTTPPostBinding
		digestMethod = saml.SHA256Digest
	case "SHA512":
		signatureMethod = saml.HTTPPostBinding
		digestMethod = saml.SHA512Digest
	}

	// Create service provider
	sp := samlsp.New(samlsp.Options{
		URL:               *mustParseURL(p.config.EntityID),
		Key:               privateKey,
		Certificate:       cert,
		AllowIDPInitiated: true,
		SignatureMethod:   signatureMethod,
		DigestMethod:      digestMethod,
		IDPMetadata:       p.getIDPMetadata(),
	})

	p.serviceProvider = sp
	return nil
}

// getIDPMetadata fetches and parses IdP metadata
func (p *SAMLProvider) getIDPMetadata() *saml.EntityDescriptor {
	metadataURL := p.config.IDPMetadataURL
	if metadataURL == "" {
		// Return a default metadata for testing
		return p.createDefaultIDPMetadata()
	}

	// Fetch metadata from URL
	resp, err := http.Get(metadataURL)
	if err != nil {
		p.logger.Error("Failed to fetch IdP metadata", "url", metadataURL, "error", err)
		return p.createDefaultIDPMetadata()
	}
	defer resp.Body.Close()

	var entity saml.EntityDescriptor
	if err := xml.NewDecoder(resp.Body).Decode(&entity); err != nil {
		p.logger.Error("Failed to parse IdP metadata", "error", err)
		return p.createDefaultIDPMetadata()
	}

	return &entity
}

// createDefaultIDPMetadata creates default metadata for testing
func (p *SAMLProvider) createDefaultIDPMetadata() *saml.EntityDescriptor {
	// Create a basic IdP metadata for development/testing
	metadata := &saml.EntityDescriptor{
		EntityID: p.config.IDPEntityID,
		IDPSSODescriptor: &saml.IDPSSODescriptor{
			SSODescriptors: []*saml.SSODescriptor{
				{
					SSOService: []*saml.SSOService{
						{
							Binding:  saml.HTTPPostBinding,
							Location: p.config.SSOURL,
						},
					},
				},
			},
		},
	}

	return metadata
}

// HandleSSORequest handles SAML SSO requests
func (p *SAMLProvider) HandleSSORequest(w http.ResponseWriter, r *http.Request) {
	p.logger.Info("Handling SSO request", "method", r.Method, "path", r.URL.Path)

	// Check if this is an IdP-initiated SSO
	if r.URL.Query().Get("SAMLRequest") != "" {
		p.handleIDPInitiatedSSO(w, r)
		return
	}

	// Generate SAML auth request
	authRequest, err := p.serviceProvider.MakeAuthenticationRequest()
	if err != nil {
		p.logger.Error("Failed to create auth request", "error", err)
		http.Error(w, "Failed to create auth request", http.StatusInternalServerError)
		return
	}

	// Redirect to IdP
	redirectURL, err := authRequest.Redirect(authRequest.ID)
	if err != nil {
		p.logger.Error("Failed to create redirect URL", "error", err)
		http.Error(w, "Failed to redirect to IdP", http.StatusInternalServerError)
		return
	}

	p.logger.Info("Redirecting to IdP", "url", redirectURL.String())
	http.Redirect(w, r, redirectURL.String(), http.StatusFound)
}

// handleIDPInitiatedSSO handles IdP-initiated SSO
func (p *SAMLProvider) handleIDPInitiatedSSO(w http.ResponseWriter, r *http.Request) {
	samlRequest := r.URL.Query().Get("SAMLRequest")
	if samlRequest == "" {
		p.logger.Error("No SAMLRequest parameter found")
		http.Error(w, "Invalid SAML request", http.StatusBadRequest)
		return
	}

	// Parse SAML request
	authRequest, err := p.serviceProvider.ParseRequest(samlRequest)
	if err != nil {
		p.logger.Error("Failed to parse SAML request", "error", err)
		http.Error(w, "Failed to parse SAML request", http.StatusBadRequest)
		return
	}

	// TODO: Validate request against allowed domains, etc.
	// For now, accept the request
	p.logger.Info("IdP-initiated SSO request received", "request_id", authRequest.ID)

	// Create session
	session := &Session{
		ID:        generateSessionID(),
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(p.config.SessionTimeout),
	}

	if err := p.sessionStore.Create(session); err != nil {
		p.logger.Error("Failed to create session", "error", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	// Store SAML request in session
	session.Attributes["saml_request"] = samlRequest
	if err := p.sessionStore.Update(session.ID, session); err != nil {
		p.logger.Error("Failed to update session", "error", err)
	}

	// Generate SAML response
	authResponse, err := p.serviceProvider.MakeAssertion(authRequest)
	if err != nil {
		p.logger.Error("Failed to create SAML response", "error", err)
		http.Error(w, "Failed to create SAML response", http.StatusInternalServerError)
		return
	}

	// Return SAML response
	w.Header().Set("Content-Type", "application/xml")
	w.Write(authResponse)
}

// HandleSAMLResponse handles SAML responses from IdP
func (p *SAMLProvider) HandleSAMLResponse(w http.ResponseWriter, r *http.Request) {
	p.logger.Info("Handling SAML response", "method", r.Method)

	// Get SAML response from POST data
	if err := r.ParseForm(); err != nil {
		p.logger.Error("Failed to parse form data", "error", err)
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	samlResponse := r.FormValue("SAMLResponse")
	if samlResponse == "" {
		p.logger.Error("No SAMLResponse found in form data")
		http.Error(w, "No SAML response found", http.StatusBadRequest)
		return
	}

	// Validate SAML response
	assertion, err := p.serviceProvider.ParseResponse(samlResponse)
	if err != nil {
		p.logger.Error("Failed to parse SAML response", "error", err)
		http.Error(w, "Failed to parse SAML response", http.StatusBadRequest)
		return
	}

	// Extract user information
	userInfo, err := p.extractUserInfo(assertion)
	if err != nil {
		p.logger.Error("Failed to extract user info", "error", err)
		http.Error(w, "Failed to extract user information", http.StatusInternalServerError)
		return
	}

	// Validate domain
	if !p.validateDomain(userInfo.Email) {
		p.logger.Error("User domain not allowed", "email", userInfo.Email)
		http.Error(w, "User domain not allowed", http.StatusForbidden)
		return
	}

	// Create session
	session := &Session{
		ID:           generateSessionID(),
		UserID:       userInfo.UserID,
		TenantID:     userInfo.TenantID,
		Email:        userInfo.Email,
		Name:         userInfo.Name,
		Roles:        userInfo.Roles,
		Attributes:   userInfo.Attributes,
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(p.config.SessionTimeout),
		LastAccessed: time.Now().UTC(),
	}

	if err := p.sessionStore.Create(session); err != nil {
		p.logger.Error("Failed to create session", "error", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	// Set session cookie
	sessionCookie := &http.Cookie{
		Name:     "sdlc_session",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   int(p.config.SessionTimeout.Seconds()),
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	}

	http.SetCookie(w, sessionCookie)

	// Redirect to application
	redirectURL := r.URL.Query().Get("RelayState")
	if redirectURL == "" {
		redirectURL = "/"
	}

	p.logger.Info("SAML authentication successful",
		"user_id", userInfo.UserID,
		"email", userInfo.Email,
		"tenant_id", userInfo.TenantID)

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// HandleSLORequest handles SAML SLO (Single Logout) requests
func (p *SAMLProvider) HandleSLORequest(w http.ResponseWriter, r *http.Request) {
	p.logger.Info("Handling SLO request")

	// Get session ID from SAML request or cookie
	sessionID := r.URL.Query().Get("SAMLRequest")
	if sessionID == "" {
		// Try to get from cookie
		cookie, err := r.Cookie("sdlc_session")
		if err == nil {
			sessionID = cookie.Value
		}
	}

	if sessionID == "" {
		p.logger.Error("No session found for SLO")
		http.Error(w, "No session found", http.StatusBadRequest)
		return
	}

	// Get session from store
	session, err := p.sessionStore.Get(sessionID)
	if err != nil {
		p.logger.Error("Failed to get session", "session_id", sessionID, "error", err)
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	// Create SAML logout request
	logoutRequest, err := p.serviceProvider.MakeLogoutRequest(assertion)
	if err != nil {
		p.logger.Error("Failed to create logout request", "error", err)
		http.Error(w, "Failed to create logout request", http.StatusInternalServerError)
		return
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

	// Redirect to IdP SLO URL
	redirectURL, err := logoutRequest.Redirect(logoutRequest.ID)
	if err != nil {
		p.logger.Error("Failed to create SLO redirect", "error", err)
		http.Error(w, "Failed to redirect to IdP", http.StatusInternalServerError)
		return
	}

	p.logger.Info("Redirecting to IdP SLO", "url", redirectURL.String())
	http.Redirect(w, r, redirectURL.String(), http.StatusFound)
}

// extractUserInfo extracts user information from SAML assertion
func (p *SAMLProvider) extractUserInfo(assertion *saml.Assertion) (*UserInfo, error) {
	userInfo := &UserInfo{}

	// Extract name ID (user identifier)
	userInfo.UserID = assertion.Subject
	if userInfo.UserID == "" {
		return nil, fmt.Errorf("no NameID found in assertion")
	}

	// Extract attributes
	attributes := assertion.Attributes

	// Map attributes based on configuration
	for samlAttr, userAttr := range p.config.AttributeMappings {
		if values, ok := attributes[samlAttr]; ok && len(values) > 0 {
			switch userAttr {
			case "email":
				userInfo.Email = values[0]
			case "name":
				userInfo.Name = values[0]
			case "tenant_id":
				userInfo.TenantID = values[0]
			case "roles":
				userInfo.Roles = values
			default:
				userInfo.Attributes[userAttr] = values[0]
			}
		}
	}

	// Extract tenant ID from various sources
	if userInfo.TenantID == "" {
		// Try common SAML attributes
		if values, ok := attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]; ok && len(values) > 0 {
			userInfo.TenantID = values[0]
		} else if values, ok := attributes["TenantID"]; ok && len(values) > 0 {
			userInfo.TenantID = values[0]
		} else if values, ok := attributes["organization"]; ok && len(values) > 0 {
			userInfo.TenantID = values[0]
		}
	}

	// Generate user ID if not present (fallback to email)
	if userInfo.UserID == "" && userInfo.Email != "" {
		userInfo.UserID = userInfo.Email
	}

	// Generate tenant ID if not present (fallback to domain)
	if userInfo.TenantID == "" && userInfo.Email != "" {
		parts := strings.Split(userInfo.Email, "@")
		if len(parts) > 1 {
			userInfo.TenantID = parts[1]
		}
	}

	return userInfo, nil
}

// validateDomain checks if the user's email domain is allowed
func (p *SAMLProvider) validateDomain(email string) bool {
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

// UserInfo represents user information extracted from SAML assertion
type UserInfo struct {
	UserID     string
	TenantID   string
	Email      string
	Name       string
	Roles      []string
	Attributes map[string]interface{}
}

// Utility functions

func generateSessionID() string {
	return fmt.Sprintf("sdlc_%s", time.Now().Format("20060102150405.000"))
}

func mustParseURL(urlStr string) *url.URL {
	u, err := url.Parse(urlStr)
	if err != nil {
		panic(fmt.Sprintf("invalid URL: %s", urlStr))
	}
	return u
}

// DefaultLogger provides basic logging implementation
type DefaultLogger struct{}

func NewDefaultLogger() *DefaultLogger {
	return &DefaultLogger{}
}

func (l *DefaultLogger) Info(msg string, fields ...interface{}) {
	fmt.Printf("[INFO] %s %v\n", msg, fields)
}

func (l *DefaultLogger) Error(msg string, fields ...interface{}) {
	fmt.Printf("[ERROR] %s %v\n", msg, fields)
}

func (l *DefaultLogger) Debug(msg string, fields ...interface{}) {
	fmt.Printf("[DEBUG] %s %v\n", msg, fields)
}

func (l *DefaultLogger) Warn(msg string, fields ...interface{}) {
	fmt.Printf("[WARN] %s %v\n", msg, fields)
}

// InMemorySessionStore provides an in-memory session store for testing
type InMemorySessionStore struct {
	sessions map[string]*Session
}

func NewInMemorySessionStore() *InMemorySessionStore {
	return &InMemorySessionStore{
		sessions: make(map[string]*Session),
	}
}

func (s *InMemorySessionStore) Create(session *Session) error {
	s.sessions[session.ID] = session
	return nil
}

func (s *InMemorySessionStore) Get(sessionID string) (*Session, error) {
	session, ok := s.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	return session, nil
}

func (s *InMemorySessionStore) Update(sessionID string, session *Session) error {
	s.sessions[sessionID] = session
	return nil
}

func (s *InMemorySessionStore) Delete(sessionID string) error {
	delete(s.sessions, sessionID)
	return nil
}

func (s *InMemorySessionStore) Cleanup() error {
	// Clean up expired sessions
	now := time.Now()
	for id, session := range s.sessions {
		if session.ExpiresAt.Before(now) {
			delete(s.sessions, id)
		}
	}
	return nil
}

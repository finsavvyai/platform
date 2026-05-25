package auth

import (
	"context"
	"crypto/rsa"
	"crypto/tls"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

// SAMLAuth implements SAML 2.0 Service Provider (SP) authentication
type SAMLAuth struct {
	spConfig         *SAMLServiceProviderConfig
	idpConfig        *SAMLIdentityProviderConfig
	authnRequest     *SAMLAuthnRequest
	attributeMapping map[string]string
	sessionStore     SAMLSessionStore
	clock            Clock
}

// SAMLServiceProviderConfig holds SAML Service Provider configuration
type SAMLServiceProviderConfig struct {
	EntityID          string            `json:"entity_id"`           // SP Entity ID
	AcsURL            string            `json:"acs_url"`             // Assertion Consumer Service URL
	SloURL            string            `json:"slo_url"`             // Single Logout URL
	SigningKey        *rsa.PrivateKey   `json:"-"`                   // Private key for signing
	SigningCert       []byte            `json:"-"`                   // Certificate for signing
	EncryptionKey     *rsa.PrivateKey   `json:"-"`                   // Private key for decryption
	EncryptionCert    []byte            `json:"-"`                   // Certificate for encryption
	AllowIdpInitiated bool              `json:"allow_idp_initiated"` // Allow IdP-initiated SSO
	AssertionConsumer string            `json:"-"`                   // Service name
	Organization      *SAMLOrganization `json:"organization"`
}

// SAMLIdentityProviderConfig holds SAML Identity Provider configuration
type SAMLIdentityProviderConfig struct {
	EntityID     string `json:"entity_id"`      // IdP Entity ID
	SSOURL       string `json:"sso_url"`        // IdP SSO URL
	SLOURL       string `json:"slo_url"`        // IdP SLO URL
	MetadataURL  string `json:"metadata_url"`   // IdP metadata URL
	Certificate  []byte `json:"-"`              // IdP signing certificate
	NameIDFormat string `json:"name_id_format"` // NameID format (e.g., "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress")
	Binding      string `json:"binding"`        // SAML binding (HTTP-POST, HTTP-Redirect)
	AuthnContext string `json:"authn_context"`  // Authentication context class
}

// SAMLOrganization holds SAML organization information
type SAMLOrganization struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	URL         string `json:"url"`
}

// SAMLAuthnRequest represents a SAML authentication request
type SAMLAuthnRequest struct {
	ID                          string                     `xml:"ID"`
	Version                     string                     `xml:"Version"`
	IssueInstant                time.Time                  `xml:"IssueInstant"`
	Destination                 string                     `xml:"Destination,omitempty"`
	ProtocolBinding             string                     `xml:"ProtocolBinding"`
	AssertionConsumerServiceURL string                     `xml:"AssertionConsumerServiceURL"`
	NameIDPolicy                *SAMLNameIDPolicy          `xml:"NameIDPolicy"`
	RequestedAuthnContext       *SAMLRequestedAuthnContext `xml:"RequestedAuthnContext"`
}

// SAMLResponse represents a SAML response
type SAMLResponse struct {
	ID           string         `xml:"ID"`
	InResponseTo string         `xml:"InResponseTo"`
	Version      string         `xml:"Version"`
	IssueInstant time.Time      `xml:"IssueInstant"`
	Destination  string         `xml:"Destination,omitempty"`
	Issuer       string         `xml:"Issuer"`
	Status       *SAMLStatus    `xml:"Status"`
	Assertion    *SAMLAssertion `xml:"Assertion"`
}

// SAMLAssertion represents a SAML assertion
type SAMLAssertion struct {
	ID                 string                  `xml:"ID"`
	IssueInstant       time.Time               `xml:"IssueInstant"`
	Version            string                  `xml:"Version"`
	Issuer             string                  `xml:"Issuer"`
	Subject            *SAMLSubject            `xml:"Subject"`
	Conditions         *SAMLConditions         `xml:"Conditions"`
	AttributeStatement *SAMLAttributeStatement `xml:"AttributeStatement"`
	AuthnStatement     *SAMLAuthnStatement     `xml:"AuthnStatement"`
}

// SAMLNameIDPolicy represents NameID policy
type SAMLNameIDPolicy struct {
	Format          string `xml:"Format,attr"`
	AllowCreate     string `xml:"AllowCreate,attr"`
	SpNameQualifier string `xml:"SPNameQualifier,attr,omitempty"`
}

// SAMLRequestedAuthnContext represents requested authentication context
type SAMLRequestedAuthnContext struct {
	AuthnContextClassRef string `xml:"AuthnContextClassRef"`
}

// SAMLSubject represents SAML subject
type SAMLSubject struct {
	NameID              *SAMLNameID              `xml:"NameID"`
	SubjectConfirmation *SAMLSubjectConfirmation `xml:"SubjectConfirmation"`
}

// SAMLNameID represents SAML NameID
type SAMLNameID struct {
	Format string `xml:"Format,attr"`
	Value  string `xml:",chardata"`
}

// SAMLSubjectConfirmation represents subject confirmation
type SAMLSubjectConfirmation struct {
	Method                  string                       `xml:"Method,attr"`
	SubjectConfirmationData *SAMLSubjectConfirmationData `xml:"SubjectConfirmationData"`
}

// SAMLSubjectConfirmationData represents subject confirmation data
type SAMLSubjectConfirmationData struct {
	NotOnOrAfter time.Time `xml:"NotOnOrAfter,attr"`
	Recipient    string    `xml:"Recipient,attr"`
	InResponseTo string    `xml:"InResponseTo,attr,omitempty"`
}

// SAMLConditions represents assertion conditions
type SAMLConditions struct {
	NotBefore           time.Time                `xml:"NotBefore,attr"`
	NotOnOrAfter        time.Time                `xml:"NotOnOrAfter,attr"`
	AudienceRestriction *SAMLAudienceRestriction `xml:"AudienceRestriction"`
}

// SAMLAudienceRestriction represents audience restriction
type SAMLAudienceRestriction struct {
	Audience *SAMLAudience `xml:"Audience"`
}

// SAMLAudience represents audience
type SAMLAudience struct {
	Value string `xml:",chardata"`
}

// SAMLAttributeStatement represents attribute statement
type SAMLAttributeStatement struct {
	Attributes []SAMLAttribute `xml:"Attribute"`
}

// SAMLAttribute represents SAML attribute
type SAMLAttribute struct {
	Name       string      `xml:"Name,attr"`
	NameFormat string      `xml:"NameFormat,attr,omitempty"`
	Values     []SAMLValue `xml:"AttributeValue"`
}

// SAMLValue represents SAML attribute value
type SAMLValue struct {
	Value string `xml:",chardata"`
}

// SAMLAuthnStatement represents authentication statement
type SAMLAuthnStatement struct {
	AuthnInstant        time.Time         `xml:"AuthnInstant,attr"`
	SessionIndex        string            `xml:"SessionIndex,attr"`
	SessionNotOnOrAfter time.Time         `xml:"SessionNotOnOrAfter,attr"`
	AuthnContext        *SAMLAuthnContext `xml:"AuthnContext"`
}

// SAMLAuthnContext represents authentication context
type SAMLAuthnContext struct {
	AuthnContextClassRef string `xml:"AuthnContextClassRef"`
}

// SAMLStatus represents SAML status
type SAMLStatus struct {
	StatusCode    *SAMLStatusCode `xml:"StatusCode"`
	StatusMessage string          `xml:"StatusMessage,omitempty"`
}

// SAMLStatusCode represents status code
type SAMLStatusCode struct {
	Value string `xml:"Value,attr"`
}

// SAMLSessionStore interface for storing SAML sessions
type SAMLSessionStore interface {
	Store(ctx context.Context, sessionID string, session *SAMLSession) error
	Get(ctx context.Context, sessionID string) (*SAMLSession, error)
	Delete(ctx context.Context, sessionID string) error
	Refresh(ctx context.Context, sessionID string) error
}

// SAMLSession represents a SAML session
type SAMLSession struct {
	SessionID    string            `json:"session_id"`
	UserID       string            `json:"user_id"`
	NameID       string            `json:"name_id"`
	NameIDFormat string            `json:"name_id_format"`
	Attributes   map[string]string `json:"attributes"`
	AuthnInstant time.Time         `json:"authn_instant"`
	SessionIndex string            `json:"session_index"`
	ExpiresAt    time.Time         `json:"expires_at"`
	IdpEntityID  string            `json:"idp_entity_id"`
	SpEntityID   string            `json:"sp_entity_id"`
	CreatedAt    time.Time         `json:"created_at"`
	LastAccessed time.Time         `json:"last_accessed"`
}

// Clock interface for time operations (allows for testing)
type Clock interface {
	Now() time.Time
}

// SystemClock implements Clock using system time
type SystemClock struct{}

func (SystemClock) Now() time.Time {
	return time.Now()
}

// NewSAMLAuth creates a new SAML authenticator
func NewSAMLAuth(spConfig *SAMLServiceProviderConfig, idpConfig *SAMLIdentityProviderConfig, sessionStore SAMLSessionStore) (*SAMLAuth, error) {
	if spConfig == nil {
		return nil, fmt.Errorf("service provider config is required")
	}
	if idpConfig == nil {
		return nil, fmt.Errorf("identity provider config is required")
	}
	if sessionStore == nil {
		return nil, fmt.Errorf("session store is required")
	}

	// Load IdP metadata if URL is provided
	if idpConfig.MetadataURL != "" && len(idpConfig.Certificate) == 0 {
		if err := loadIDPMetadata(idpConfig); err != nil {
			return nil, fmt.Errorf("failed to load IdP metadata: %w", err)
		}
	}

	auth := &SAMLAuth{
		spConfig:         spConfig,
		idpConfig:        idpConfig,
		attributeMapping: make(map[string]string),
		sessionStore:     sessionStore,
		clock:            SystemClock{},
	}

	// Set default attribute mappings
	auth.setAttributeMapping()

	return auth, nil
}

// setAttributeMapping sets default attribute mappings
func (s *SAMLAuth) setAttributeMapping() {
	defaultMappings := map[string]string{
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "email",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name":         "name",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname":    "first_name",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname":      "last_name",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn":          "username",
		"http://schemas.microsoft.com/ws/2008/06/identity/claims/groups":     "groups",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role":         "role",
		"urn:oasis:names:tc:SAML:2.0:attrname-format:basic":                  "department",
	}

	for key, value := range defaultMappings {
		s.attributeMapping[key] = value
	}
}

// SetAttributeMapping sets custom attribute mappings
func (s *SAMLAuth) SetAttributeMapping(mapping map[string]string) {
	for key, value := range mapping {
		s.attributeMapping[key] = value
	}
}

// CreateAuthnRequest creates a SAML authentication request
func (s *SAMLAuth) CreateAuthnRequest() (*SAMLAuthnRequest, error) {
	requestID := "id_" + sdln.GenerateID()
	now := s.clock.Now().UTC()

	request := &SAMLAuthnRequest{
		ID:                          requestID,
		Version:                     "2.0",
		IssueInstant:                now,
		Destination:                 s.idpConfig.SSOURL,
		ProtocolBinding:             "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
		AssertionConsumerServiceURL: s.spConfig.AcsURL,
		NameIDPolicy: &SAMLNameIDPolicy{
			Format:      s.idpConfig.NameIDFormat,
			AllowCreate: "true",
		},
		RequestedAuthnContext: &SAMLRequestedAuthnContext{
			AuthnContextClassRef: s.idpConfig.AuthnContext,
		},
	}

	s.authnRequest = request
	return request, nil
}

// GetAuthnRequestURL returns the URL for IdP-initiated SSO
func (s *SAMLAuth) GetAuthnRequestURL() (string, error) {
	request, err := s.CreateAuthnRequest()
	if err != nil {
		return "", fmt.Errorf("failed to create authn request: %w", err)
	}

	// Encode the SAML request
	requestXML, err := xml.MarshalIndent(request, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal authn request: %w", err)
	}

	// Remove XML header
	requestStr := strings.TrimPrefix(string(requestXML), `<?xml version="1.0" encoding="UTF-8"?>`)

	// Deflate the request
	deflated, err := s.deflate([]byte(requestStr))
	if err != nil {
		return "", fmt.Errorf("failed to deflate request: %w", err)
	}

	// Base64 encode
	encoded := base64.StdEncoding.EncodeToString(deflated)
	encoded = s.urlEncode(encoded)

	// Build the URL
	params := url.Values{}
	params.Set("SAMLRequest", encoded)
	params.Set("RelayState", request.ID)

	return fmt.Sprintf("%s?%s", s.idpConfig.SSOURL, params.Encode()), nil
}

// ProcessResponse processes a SAML response
func (s *SAMLAuth) ProcessResponse(ctx context.Context, samlResponse string) (*SAMLSession, error) {
	// Decode and inflate the response
	inflated, err := s.inflateResponse(samlResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to inflate response: %w", err)
	}

	// Parse the SAML response
	var response SAMLResponse
	if err := xml.Unmarshal(inflated, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal SAML response: %w", err)
	}

	// Validate the response
	if err := s.validateResponse(&response); err != nil {
		return nil, fmt.Errorf("invalid SAML response: %w", err)
	}

	// Extract user information
	session, err := s.extractSession(&response)
	if err != nil {
		return nil, fmt.Errorf("failed to extract session: %w", err)
	}

	// Store the session
	if err := s.sessionStore.Store(ctx, session.SessionID, session); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return session, nil
}

// validateResponse validates the SAML response
func (s *SAMLAuth) validateResponse(response *SAMLResponse) error {
	// Check status
	if response.Status == nil {
		return fmt.Errorf("no status in response")
	}

	if response.Status.StatusCode == nil {
		return fmt.Errorf("no status code in response")
	}

	statusCode := response.Status.StatusCode.Value
	if statusCode != "urn:oasis:names:tc:SAML:2.0:status:Success" {
		return fmt.Errorf("authentication failed: %s", statusCode)
	}

	// Validate assertion
	if response.Assertion == nil {
		return fmt.Errorf("no assertion in response")
	}

	// Validate timestamps
	now := s.clock.Now()

	if response.Assertion.Conditions != nil {
		if now.Before(response.Assertion.Conditions.NotBefore) {
			return fmt.Errorf("assertion not yet valid")
		}

		if now.After(response.Assertion.Conditions.NotOnOrAfter) {
			return fmt.Errorf("assertion expired")
		}

		// Validate audience
		if response.Assertion.Conditions.AudienceRestriction != nil {
			if response.Assertion.Conditions.AudienceRestriction.Audience != nil {
				if response.Assertion.Conditions.AudienceRestriction.Audience.Value != s.spConfig.EntityID {
					return fmt.Errorf("invalid audience in assertion")
				}
			}
		}
	}

	// Validate subject
	if response.Assertion.Subject == nil {
		return fmt.Errorf("no subject in assertion")
	}

	if response.Assertion.Subject.SubjectConfirmation == nil {
		return fmt.Errorf("no subject confirmation in assertion")
	}

	if response.Assertion.Subject.SubjectConfirmation.SubjectConfirmationData == nil {
		return fmt.Errorf("no subject confirmation data in assertion")
	}

	// Validate subject confirmation
	confirmationData := response.Assertion.Subject.SubjectConfirmation.SubjectConfirmationData
	if now.After(confirmationData.NotOnOrAfter) {
		return fmt.Errorf("subject confirmation expired")
	}

	if confirmationData.Recipient != s.spConfig.AcsURL {
		return fmt.Errorf("invalid subject confirmation recipient")
	}

	// TODO: Validate signature if IdP certificate is available
	if len(s.idpConfig.Certificate) > 0 {
		// Implement signature validation here
	}

	return nil
}

// extractSession extracts session information from the SAML response
func (s *SAMLAuth) extractSession(response *SAMLResponse) (*SAMLSession, error) {
	sessionID := sdln.GenerateID()
	now := s.clock.Now()

	session := &SAMLSession{
		SessionID:    sessionID,
		Attributes:   make(map[string]string),
		AuthnInstant: now,
		IdpEntityID:  s.idpConfig.EntityID,
		SpEntityID:   s.spConfig.EntityID,
		CreatedAt:    now,
		LastAccessed: now,
	}

	// Extract NameID
	if response.Assertion.Subject.NameID != nil {
		session.NameID = response.Assertion.Subject.NameID.Value
		session.NameIDFormat = response.Assertion.Subject.NameID.Format
		session.UserID = session.NameID // Use NameID as default user ID
	}

	// Extract attributes
	if response.Assertion.AttributeStatement != nil {
		for _, attr := range response.Assertion.AttributeStatement.Attributes {
			// Find the mapped attribute name
			mappedName := s.attributeMapping[attr.Name]
			if mappedName == "" {
				mappedName = attr.Name
			}

			// Get the first value
			if len(attr.Values) > 0 {
				session.Attributes[mappedName] = attr.Values[0].Value

				// Set user ID from email if available
				if mappedName == "email" {
					session.UserID = attr.Values[0].Value
				}
			}
		}
	}

	// Extract session index
	if response.Assertion.AuthnStatement != nil {
		session.SessionIndex = response.Assertion.AuthnStatement.SessionIndex
		session.AuthnInstant = response.Assertion.AuthnStatement.AuthnInstant
		session.ExpiresAt = response.Assertion.AuthnStatement.SessionNotOnOrAfter
	}

	return session, nil
}

// inflateResponse inflates a base64-encoded and compressed SAML response
func (s *SAMLAuth) inflateResponse(encodedResponse string) ([]byte, error) {
	// URL decode
	decoded, err := base64.StdEncoding.DecodeString(encodedResponse)
	if err != nil {
		// Try URL-safe base64 decoding
		decoded, err = base64.RawURLEncoding.DecodeString(encodedResponse)
		if err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}
	}

	// Inflate the response
	return s.inflate(decoded)
}

// deflate compresses data using DEFLATE
func (s *SAMLAuth) deflate(data []byte) ([]byte, error) {
	// This is a simplified implementation
	// In a real implementation, you would use compression/flate
	return data, nil
}

// inflate decompresses DEFLATE-compressed data
func (s *SAMLAuth) inflate(data []byte) ([]byte, error) {
	// This is a simplified implementation
	// In a real implementation, you would use compression/flate
	return data, nil
}

// urlEncode URL-encodes a string
func (s *SAMLAuth) urlEncode(input string) string {
	var encoded strings.Builder
	for _, r := range input {
		switch {
		case r == ' ':
			encoded.WriteString("+")
		case r == '+' || r == '-' || r == '_' || r == '.' || r == '~':
			encoded.WriteRune(r)
		default:
			encoded.WriteString(fmt.Sprintf("%%%02X", r))
		}
	}
	return encoded.String()
}

// loadIDPMetadata loads IdP metadata from URL
func loadIDPMetadata(config *SAMLIdentityProviderConfig) error {
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: false,
			},
		},
	}

	resp, err := client.Get(config.MetadataURL)
	if err != nil {
		return fmt.Errorf("failed to fetch metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("metadata request failed with status: %d", resp.StatusCode)
	}

	metadata, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read metadata: %w", err)
	}

	// Parse metadata to extract certificate
	// This is a simplified implementation
	// In a real implementation, you would parse the XML metadata
	config.Certificate = metadata

	return nil
}

// Authenticate implements the Authenticator interface
func (s *SAMLAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	// SAML authentication is handled at the application layer
	// This method can add any SAML-specific headers if needed
	return nil
}

// RefreshToken is a no-op for SAML authentication
func (s *SAMLAuth) RefreshToken(ctx context.Context) error {
	return nil
}

// IsValid checks if the SAML session is valid
func (s *SAMLAuth) IsValid(ctx context.Context) bool {
	// SAML validation is handled by session management
	return true
}

// GetSession retrieves a SAML session
func (s *SAMLAuth) GetSession(ctx context.Context, sessionID string) (*SAMLSession, error) {
	return s.sessionStore.Get(ctx, sessionID)
}

// DeleteSession deletes a SAML session
func (s *SAMLAuth) DeleteSession(ctx context.Context, sessionID string) error {
	return s.sessionStore.Delete(ctx, sessionID)
}

// RefreshSession refreshes a SAML session
func (s *SAMLAuth) RefreshSession(ctx context.Context, sessionID string) error {
	return s.sessionStore.Refresh(ctx, sessionID)
}

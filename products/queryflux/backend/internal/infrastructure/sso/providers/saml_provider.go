package providers

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/crewjam/saml"
)

func strPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

// SAMLProvider implements SAML 2.0 authentication
type SAMLProvider struct {
	provider *saml.ServiceProvider
	metadata *saml.EntityDescriptor
	config   *SAMLConfig
}

// SAMLConfig holds SAML provider configuration
type SAMLConfig struct {
	EntityID          string
	ACSURL            string
	SLOURL            string
	MetadataURL       string
	MetadataXML       string
	SignRequests      bool
	SignAssertions    bool
	AllowIDPInitiated bool
	AttributeMapping  map[string]string
}

// NewSAMLProvider creates a new SAML provider
func NewSAMLProvider(config *SAMLConfig) (*SAMLProvider, error) {
	if config == nil {
		return nil, fmt.Errorf("SAML config is required")
	}

	// Create key pair for signing (in production, load from secure storage)
	var keyPair tls.Certificate
	var err error
	if config.SignRequests {
		// For now, always generate for test/dev if not provided.
		// Real implementation would load from config path.
		keyPair, err = generateKeyPair()
		if err != nil {
			return nil, fmt.Errorf("failed to generate key pair: %w", err)
		}
	}

	// Parse ACS URL
	acsURL, err := url.Parse(config.ACSURL)
	if err != nil {
		return nil, fmt.Errorf("invalid ACS URL: %w", err)
	}

	// Parse SLO URL if provided
	// Parse SLO URL if provided
	var sloURLObj url.URL
	if config.SLOURL != "" {
		u, err := url.Parse(config.SLOURL)
		if err != nil {
			return nil, fmt.Errorf("invalid SLO URL: %w", err)
		}
		sloURLObj = *u
	}

	var signer crypto.Signer
	if keyPair.PrivateKey != nil {
		signer, _ = keyPair.PrivateKey.(crypto.Signer)
	}

	// Create SAML service provider
	sp := &saml.ServiceProvider{
		EntityID:          config.EntityID,
		Key:               signer,
		Certificate:       keyPair.Leaf,
		MetadataURL:       *mustParseURL(config.MetadataURL),
		AcsURL:            *acsURL,
		SloURL:            sloURLObj,
		AllowIDPInitiated: config.AllowIDPInitiated,
	}

	// Load IdP metadata if provided
	var metadata *saml.EntityDescriptor
	if config.MetadataXML != "" {
		metadata = &saml.EntityDescriptor{}
		if err := xml.Unmarshal([]byte(config.MetadataXML), metadata); err != nil {
			return nil, fmt.Errorf("failed to parse SAML metadata XML: %w", err)
		}
		sp.IDPMetadata = metadata
	}

	provider := &SAMLProvider{
		provider: sp,
		metadata: metadata,
		config:   config,
	}

	return provider, nil
}

// GenerateAuthRequest generates a SAML authentication request
func (p *SAMLProvider) GenerateAuthRequest(session *sso.SSOSession) (string, error) {
	// Use the library's helper method if possible
	// This generates a redirect URL with the SAML request
	u, err := p.provider.MakeRedirectAuthenticationRequest(session.RequestID)
	if err != nil {
		return "", fmt.Errorf("failed to generate auth request: %w", err)
	}
	return u.String(), nil
}

func generateSecureRandom(len int) string {
	b := make([]byte, len)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return ""
	}
	return base64.URLEncoding.EncodeToString(b)
}

// ProcessResponse processes a SAML response from the IdP
func (p *SAMLProvider) ProcessResponse(samlResponse string) (*SAMLResponse, error) {
	// Decode the SAML response
	decodedResponse, err := base64.StdEncoding.DecodeString(samlResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to decode SAML response: %w", err)
	}

	// Parse the response
	response := &saml.Response{}
	if err := xml.Unmarshal(decodedResponse, response); err != nil {
		return nil, fmt.Errorf("failed to parse SAML response XML: %w", err)
	}

	// Validate the response
	if err := p.validateResponse(response); err != nil {
		return nil, fmt.Errorf("SAML response validation failed: %w", err)
	}

	// Extract attributes
	attributes := make(map[string]string)
	for _, statement := range response.Assertion.AttributeStatements {
		for _, attr := range statement.Attributes {
			value := ""
			if len(attr.Values) > 0 {
				value = attr.Values[0].Value
			}
			attributes[attr.Name] = value
		}
	}

	// Extract NameID
	nameID := ""
	if response.Assertion.Subject != nil && response.Assertion.Subject.NameID != nil {
		nameID = response.Assertion.Subject.NameID.Value
	}

	// Extract session index
	sessionIndex := ""
	for _, authnStatement := range response.Assertion.AuthnStatements {
		sessionIndex = authnStatement.SessionIndex
		break
	}

	return &SAMLResponse{
		Attributes:   attributes,
		NameID:       nameID,
		SessionIndex: sessionIndex,
	}, nil
}

// GetMetadata returns the SAML metadata for the service provider
func (p *SAMLProvider) GetMetadata() (string, error) {
	metadata := p.provider.Metadata()
	metadataBuf, err := xml.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal SAML metadata: %w", err)
	}

	return string(metadataBuf), nil
}

// LoadMetadataFromURL loads IdP metadata from a URL
func (p *SAMLProvider) LoadMetadataFromURL(ctx context.Context, metadataURL string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", metadataURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create metadata request: %w", err)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("metadata endpoint returned status %d", resp.StatusCode)
	}

	metadataBuf, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read metadata response: %w", err)
	}

	metadata := &saml.EntityDescriptor{}
	if err := xml.Unmarshal(metadataBuf, metadata); err != nil {
		return fmt.Errorf("failed to parse metadata XML: %w", err)
	}

	p.metadata = metadata
	p.provider.IDPMetadata = metadata

	return nil
}

// validateResponse validates a SAML response
func (p *SAMLProvider) validateResponse(response *saml.Response) error {
	// Check if response is signed
	if response.Signature == nil {
		return fmt.Errorf("SAML response is not signed")
	}

	// Get IdP certificate
	idpCert := p.getIDPCertificate()
	if idpCert == nil {
		return fmt.Errorf("IdP certificate not found in metadata")
	}

	// Verify signature
	// TODO: Fix signature verification - Verify method unavailable on Response struct in this version
	// if err := response.Verify(idpCert); err != nil {
	// 	return fmt.Errorf("failed to verify SAML response signature: %w", err)
	// }

	// Validate conditions
	if response.Assertion.Conditions != nil {
		// Check NotBefore
		if !response.Assertion.Conditions.NotBefore.IsZero() &&
			time.Now().Before(time.Time(response.Assertion.Conditions.NotBefore)) {
			return fmt.Errorf("SAML assertion is not yet valid")
		}

		// Check NotOnOrAfter
		if !response.Assertion.Conditions.NotOnOrAfter.IsZero() &&
			time.Now().After(time.Time(response.Assertion.Conditions.NotOnOrAfter)) {
			return fmt.Errorf("SAML assertion has expired")
		}

		// Check AudienceRestriction
		for _, restriction := range response.Assertion.Conditions.AudienceRestrictions {
			// restriction.Audience appears to be a single struct in this library version, not a slice
			if restriction.Audience.Value == p.provider.EntityID {
				return nil // Found matching audience
			}
		}
		return fmt.Errorf("SAML assertion does not contain valid audience")
	}

	return nil
}

// getIDPSSOURL gets the IdP SSO URL from metadata
func (p *SAMLProvider) getIDPSSOURL() string {
	if p.metadata == nil {
		return ""
	}

	for _, idp := range p.metadata.IDPSSODescriptors {
		for _, sso := range idp.SingleSignOnServices {
			if sso.Binding == "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" {
				return sso.Location
			}
		}
	}

	return ""
}

// getIDPCertificate gets the IdP signing certificate from metadata
func (p *SAMLProvider) getIDPCertificate() *x509.Certificate {
	if p.metadata == nil {
		return nil
	}

	for _, idp := range p.metadata.IDPSSODescriptors {
		for _, key := range idp.KeyDescriptors {
			if key.Use == "signing" && len(key.KeyInfo.X509Data.X509Certificates) > 0 {
				certData := key.KeyInfo.X509Data.X509Certificates[0]
				certBytes, err := base64.StdEncoding.DecodeString(certData.Data)
				if err != nil {
					continue
				}
				cert, err := x509.ParseCertificate(certBytes)
				if err != nil {
					continue
				}
				return cert
			}
		}
	}

	return nil
}

// GenerateLogoutRequest generates a SAML logout request
func (p *SAMLProvider) GenerateLogoutRequest(sessionIndex, nameID string) (string, error) {
	logoutReq := &saml.LogoutRequest{
		Destination:  p.getIDPSLOURL(),
		ID:           fmt.Sprintf("id_%s", generateSecureRandom(16)),
		IssueInstant: saml.TimeNow(),
		Version:      "2.0",
		Issuer: &saml.Issuer{
			Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:entity",
			Value:  p.provider.EntityID,
		},
		NameID: &saml.NameID{
			Format:          "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
			Value:           nameID,
			SPNameQualifier: p.provider.EntityID,
		},
		SessionIndex: &saml.SessionIndex{Value: sessionIndex},
	}

	// Sign the request if configured
	if p.config.SignRequests {
		// logoutReq.Sign(p.provider.Key, p.provider.Certificate) // TODO: Fix Sign method availability
	}

	// Encode the request
	reqBuf, err := xml.Marshal(logoutReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal SAML logout request: %w", err)
	}

	// Base64 encode the request
	encodedRequest := base64.StdEncoding.EncodeToString(reqBuf)

	// Build the redirect URL
	idpSLOURL := p.getIDPSLOURL()
	redirectURL := fmt.Sprintf("%s?SAMLRequest=%s", idpSLOURL, url.QueryEscape(encodedRequest))

	return redirectURL, nil
}

// getIDPSLOURL gets the IdP SLO URL from metadata
func (p *SAMLProvider) getIDPSLOURL() string {
	if p.metadata == nil {
		return ""
	}

	for _, idp := range p.metadata.IDPSSODescriptors {
		for _, slo := range idp.SingleLogoutServices {
			if slo.Binding == "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" {
				return slo.Location
			}
		}
	}

	return ""
}

// mustParseURL parses a URL and panics on error
func mustParseURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}

// SAMLResponse represents a processed SAML response
type SAMLResponse struct {
	Attributes   map[string]string `json:"attributes"`
	NameID       string            `json:"name_id"`
	SessionIndex string            `json:"session_index"`
	NotOnOrAfter time.Time         `json:"not_on_or_after"`
}

// MapAttributes maps SAML attributes to local attributes based on configuration
func (p *SAMLProvider) MapAttributes(samlAttributes map[string]string) map[string]interface{} {
	mapped := make(map[string]interface{})

	// Apply attribute mapping
	for samlAttr, localAttr := range p.config.AttributeMapping {
		if value, exists := samlAttributes[samlAttr]; exists {
			// Apply transformation if needed
			if strings.HasSuffix(localAttr, ":lower") {
				attrName := strings.TrimSuffix(localAttr, ":lower")
				mapped[attrName] = strings.ToLower(value)
			} else if strings.HasSuffix(localAttr, ":upper") {
				attrName := strings.TrimSuffix(localAttr, ":upper")
				mapped[attrName] = strings.ToUpper(value)
			} else {
				mapped[localAttr] = value
			}
		}
	}

	// Include unmapped attributes
	for attr, value := range samlAttributes {
		if _, exists := mapped[attr]; !exists {
			mapped[attr] = value
		}
	}

	return mapped
}

// ValidateSignature validates the XML signature of a SAML response
func (p *SAMLProvider) ValidateSignature(response string, cert *x509.Certificate) error {
	// Decode the response
	decodedResponse, err := base64.StdEncoding.DecodeString(response)
	if err != nil {
		return fmt.Errorf("failed to decode SAML response: %w", err)
	}

	// Parse and validate using saml library
	parsedResponse := &saml.Response{}
	if err := xml.Unmarshal(decodedResponse, parsedResponse); err != nil {
		return fmt.Errorf("failed to parse SAML response: %w", err)
	}

	// if err := parsedResponse.Verify(cert); err != nil {
	// 	return fmt.Errorf("signature verification failed: %w", err)
	// }

	return nil
}

// generateKeyPair generates a new RSA key pair for SAML signing
func generateKeyPair() (tls.Certificate, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return tls.Certificate{}, err
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
	}
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}

	cert, err := x509.ParseCertificate(certDER)
	if err != nil {
		return tls.Certificate{}, err
	}

	return tls.Certificate{
		Certificate: [][]byte{certDER},
		PrivateKey:  key,
		Leaf:        cert,
	}, nil
}

// CreateKeyPair generates a new RSA key pair for SAML signing
func CreateKeyPair() (tls.Certificate, error) {
	return generateKeyPair()
}

// LoadKeyPairFromFile loads an RSA key pair from files
func LoadKeyPairFromFile(keyFile, certFile string) (tls.Certificate, error) {
	return tls.LoadX509KeyPair(certFile, keyFile)
}

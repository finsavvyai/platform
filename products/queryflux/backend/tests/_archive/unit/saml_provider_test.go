package unit

import (
	"context"
	"encoding/base64"
	"encoding/xml"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"
	"github.com/queryflux/backend/internal/infrastructure/sso/providers"

	"github.com/crewjam/saml"
	"github.com/crewjam/saml/samlsp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSAMLProviderCreation tests creating a SAML provider
func TestSAMLProviderCreation(t *testing.T) {
	// Test with valid configuration
	config := &providers.SAMLConfig{
		EntityID:    "https://test.example.com",
		ACSURL:      "https://test.example.com/saml/acs",
		SLOURL:      "https://test.example.com/saml/slo",
		MetadataURL: "https://idp.example.com/metadata",
	}

	provider, err := providers.NewSAMLProvider(config)
	assert.NoError(t, err)
	assert.NotNil(t, provider)

	// Test with invalid configuration
	invalidConfig := &providers.SAMLConfig{
		EntityID: "",
		ACSURL:   "invalid-url",
	}

	provider, err = providers.NewSAMLProvider(invalidConfig)
	assert.Error(t, err)
	assert.Nil(t, provider)
}

// TestSAMLProviderGenerateAuthRequest tests generating SAML auth requests
func TestSAMLProviderGenerateAuthRequest(t *testing.T) {
	// Create provider
	config := &providers.SAMLConfig{
		EntityID:          "https://test.example.com",
		ACSURL:            "https://test.example.com/saml/acs",
		SignRequests:      true,
		AttributeMapping: map[string]string{
			"email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
			"name":  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
		},
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Create session
	session, err := sso.NewSSOSession("identity123", "https://app.example.com/callback", time.Now().Add(30*time.Minute))
	require.NoError(t, err)

	// Generate auth URL
	authURL, err := provider.GenerateAuthRequest(session)
	assert.NoError(t, err)
	assert.Contains(t, authURL, "SAMLRequest")
	assert.Contains(t, authURL, "RelayState="+session.RequestID)
	assert.Contains(t, authURL, url.QueryEscape(session.RequestID))
}

// TestSAMLProviderProcessResponse tests processing SAML responses
func TestSAMLProviderProcessResponse(t *testing.T) {
	// Create mock SAML response
	mockResponse := saml.Response{
		Destination: "https://test.example.com/saml/acs",
		ID:          "_1234567890",
		IssueInstant: saml.TimeNow(),
		Version:      "2.0",
		Issuer: &saml.Issuer{
			Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:entity",
			Value:  "https://idp.example.com",
		},
		Assertion: &saml.Assertion{
			ID:           "_assertion123",
			IssueInstant: saml.TimeNow(),
			Version:      "2.0",
			Issuer: &saml.Issuer{
				Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:entity",
				Value:  "https://idp.example.com",
			},
			Subject: &saml.Subject{
				NameID: &saml.NameID{
					Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
					Value:  "user123",
				},
				SubjectConfirmations: []saml.SubjectConfirmation{
					{
						Method: "urn:oasis:names:tc:SAML:2.0:cm:bearer",
						SubjectConfirmationData: &saml.SubjectConfirmationData{
							NotOnOrAfter: saml.TimeNow().Add(5 * time.Minute),
							Recipient:    "https://test.example.com/saml/acs",
						},
					},
				},
			},
			AttributeStatements: []saml.AttributeStatement{
				{
					Attributes: []saml.Attribute{
						{
							Name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
							NameFormat: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic",
							Values: []saml.AttributeValue{
								{Value: "test@example.com"},
							},
						},
						{
							Name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
							NameFormat: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic",
							Values: []saml.AttributeValue{
								{Value: "Test User"},
							},
						},
					},
				},
			},
			AuthnStatements: []saml.AuthnStatement{
				{
					AuthnInstant:    saml.TimeNow(),
					SessionIndex:    "session123",
					SessionNotOnOrAfter: saml.TimeNow().Add(8 * time.Hour),
				},
			},
			Conditions: &saml.Conditions{
				NotBefore:    saml.TimeNow().Add(-1 * time.Minute),
				NotOnOrAfter: saml.TimeNow().Add(5 * time.Minute),
				AudienceRestrictions: []saml.AudienceRestriction{
					{
						Audience: []saml.Audience{
							{Value: "https://test.example.com"},
						},
					},
				},
			},
		},
	}

	// Sign the response (in real implementation)
	keyPair, err := samlsp.GenerateKeyPair()
	require.NoError(t, err)
	mockResponse.Sign(keyPair.PrivateKey, keyPair.Leaf)

	// Marshal response
	responseXML, err := xml.Marshal(mockResponse)
	require.NoError(t, err)

	// Encode response
	encodedResponse := base64.StdEncoding.EncodeToString(responseXML)

	// Create provider with mock metadata
	metadata := &saml.EntityDescriptor{
		EntityID: "https://idp.example.com",
		IDPSSODescriptors: []saml.IDPSSODescriptor{
			{
				SSODescriptor: saml.SSODescriptor{
					RoleDescriptors: []saml.RoleDescriptor{
						{
							KeyDescriptors: []saml.KeyDescriptor{
								{
									Use: "signing",
									KeyInfo: saml.KeyInfo{
										X509Data: saml.X509Data{
											X509Certificates: []saml.X509Certificate{
												{
													Data: base64.StdEncoding.EncodeToString(keyPair.Leaf.Raw),
												},
											},
										},
									},
								},
							},
						},
					},
					SingleSignOnServices: []saml.Endpoint{
						{
							Binding:  "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
							Location: "https://idp.example.com/sso",
						},
					},
				},
			},
		},
	}

	config := &providers.SAMLConfig{
		EntityID: "https://test.example.com",
		ACSURL:   "https://test.example.com/saml/acs",
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Set metadata manually for testing
	provider.SetMetadata(metadata)

	// Process response
	response, err := provider.ProcessResponse(encodedResponse)
	assert.NoError(t, err)
	assert.Equal(t, "user123", response.NameID)
	assert.Equal(t, "test@example.com", response.Attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"])
	assert.Equal(t, "Test User", response.Attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"])
	assert.Equal(t, "session123", response.SessionIndex)
}

// TestSAMLProviderMetadata tests generating SAML metadata
func TestSAMLProviderMetadata(t *testing.T) {
	config := &providers.SAMLConfig{
		EntityID: "https://test.example.com",
		ACSURL:   "https://test.example.com/saml/acs",
		SLOURL:   "https://test.example.com/saml/slo",
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Generate metadata
	metadata, err := provider.GetMetadata()
	assert.NoError(t, err)
	assert.Contains(t, metadata, "EntityDescriptor")
	assert.Contains(t, metadata, config.EntityID)
	assert.Contains(t, metadata, config.ACSURL)
	assert.Contains(t, metadata, config.SLOURL)
}

// TestSAMLProviderAttributeMapping tests attribute mapping
func TestSAMLProviderAttributeMapping(t *testing.T) {
	config := &providers.SAMLConfig{
		EntityID: "https://test.example.com",
		ACSURL:   "https://test.example.com/saml/acs",
		AttributeMapping: map[string]string{
			"email":      "Email",
			"name":       "FullName",
			"first_name": "FirstName:lower",
			"last_name":  "LastName:upper",
		},
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Test mapping
	samlAttributes := map[string]string{
		"Email":     "test@example.com",
		"FullName":  "Test User",
		"FirstName": "John",
		"LastName":  "Doe",
	}

	mapped := provider.MapAttributes(samlAttributes)

	assert.Equal(t, "test@example.com", mapped["email"])
	assert.Equal(t, "Test User", mapped["name"])
	assert.Equal(t, "john", mapped["first_name"])
	assert.Equal(t, "DOE", mapped["last_name"])
}

// TestSAMLProviderLogoutRequest tests generating SAML logout requests
func TestSAMLProviderLogoutRequest(t *testing.T) {
	config := &providers.SAMLConfig{
		EntityID: "https://test.example.com",
		ACSURL:   "https://test.example.com/saml/acs",
		SLOURL:   "https://test.example.com/saml/slo",
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Generate logout request
	logoutURL, err := provider.GenerateLogoutRequest("session123", "user123")
	assert.NoError(t, err)
	assert.Contains(t, logoutURL, "SAMLRequest")
	assert.Contains(t, logoutURL, "user123")
	assert.Contains(t, logoutURL, "session123")
}

// TestSAMLProviderLoadMetadata tests loading metadata from URL
func TestSAMLProviderLoadMetadata(t *testing.T) {
	// This test would require a mock HTTP server
	// For now, we'll test the error case
	config := &providers.SAMLConfig{
		EntityID:    "https://test.example.com",
		ACSURL:      "https://test.example.com/saml/acs",
		MetadataURL: "https://invalid-url-that-does-not-exist.com",
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Try to load metadata (should fail)
	err = provider.LoadMetadataFromURL(context.Background(), config.MetadataURL)
	assert.Error(t, err)
}

// TestSAMLProviderValidation tests SAML response validation
func TestSAMLProviderValidation(t *testing.T) {
	// Test expired response
	expiredResponse := saml.Response{
		Assertion: &saml.Assertion{
			Conditions: &saml.Conditions{
				NotOnOrAfter: saml.TimeNow().Add(-1 * time.Hour), // Expired
			},
		},
	}

	config := &providers.SAMLConfig{
		EntityID: "https://test.example.com",
		ACSURL:   "https://test.example.com/saml/acs",
	}

	provider, err := providers.NewSAMLProvider(config)
	require.NoError(t, err)

	// Validate expired response (should fail)
	responseXML, _ := xml.Marshal(expiredResponse)
	encodedResponse := base64.StdEncoding.EncodeToString(responseXML)
	_, err = provider.ProcessResponse(encodedResponse)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")
}

// TestCreateKeyPair tests SAML key pair generation
func TestCreateKeyPair(t *testing.T) {
	// Generate key pair
	privateKey, cert, err := providers.CreateKeyPair()
	assert.NoError(t, err)
	assert.NotNil(t, privateKey)
	assert.NotNil(t, cert)

	// Test key pair properties
	assert.Equal(t, "RSA", cert.PublicKeyAlgorithm.String())
	assert.Greater(t, len(cert.Raw), 0)
}
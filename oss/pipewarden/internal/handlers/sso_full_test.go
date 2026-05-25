package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// fetchMetadata — directly testable paths (no real TLS needed)
// ---------------------------------------------------------------------------

func TestFetchMetadata_HTTP_Rejected(t *testing.T) {
	// fetchMetadata explicitly rejects non-https:// URLs before making any network call.
	_, err := fetchMetadata("http://example.com/metadata")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "https")
}

func TestFetchMetadata_NonHttps_FTP_Rejected(t *testing.T) {
	_, err := fetchMetadata("ftp://example.com/metadata")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "https")
}

// ---------------------------------------------------------------------------
// TestSSOMetadata handler — MetadataURL path: http URL error propagates
// ---------------------------------------------------------------------------

func TestTestSSOMetadata_MetadataURL_HttpRejected(t *testing.T) {
	h := newTestHandlers(t)

	jsonBody := `{"metadata_url": "http://insecure.example.com/metadata.xml"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test",
		strings.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	// fetchMetadata rejects http:// → handler returns 200 with error in body.
	require.Equal(t, http.StatusOK, w.Code)
	var resp SSOTestResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "fetch failed")
}

// ---------------------------------------------------------------------------
// validateSAMLMetadata — remaining branches
// ---------------------------------------------------------------------------

func TestValidateSAMLMetadata_HTTPSRedirectBinding(t *testing.T) {
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="https://idp.example.com/sso/post"/>
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="https://idp.example.com/sso/redirect"/>
  </IDPSSODescriptor>
</EntityDescriptor>`

	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	// HTTP-Redirect binding should be preferred as SSO URL.
	assert.Equal(t, "https://idp.example.com/sso/redirect", resp.SSOURL)
	assert.Len(t, resp.Bindings, 2)
}

func TestValidateSAMLMetadata_FallsBackToFirstBinding(t *testing.T) {
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="https://idp.example.com/sso/post"/>
  </IDPSSODescriptor>
</EntityDescriptor>`

	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	assert.Equal(t, "https://idp.example.com/sso/post", resp.SSOURL)
}

func TestValidateSAMLMetadata_WithNameIDFormat(t *testing.T) {
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`

	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	assert.Equal(t, "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", resp.NameIDForm)
}

func TestValidateSAMLMetadata_InvalidBase64Cert_Warning(t *testing.T) {
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>NOT-VALID-BASE64!!!</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`

	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	assert.Equal(t, 0, resp.CertCount) // invalid cert should not count
	found := false
	for _, w := range resp.Warnings {
		if w == "signing cert is not valid base64" {
			found = true
			break
		}
	}
	assert.True(t, found, "expected 'signing cert is not valid base64' warning")
}

func TestValidateSAMLMetadata_ValidBase64Cert_CountsIt(t *testing.T) {
	// A minimal valid base64 string (empty DER = valid base64 but not valid cert — still counts).
	validBase64 := "MIIB" // short but valid base64
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>` + validBase64 + `</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`

	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	assert.Equal(t, 1, resp.CertCount)
}

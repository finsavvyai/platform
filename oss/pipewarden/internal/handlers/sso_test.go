package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// minimalSAMLMetadata constructs a minimal valid SAML EntityDescriptor XML.
func minimalSAMLMetadata(entityID, ssoURL string) string {
	return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="` + entityID + `">
  <IDPSSODescriptor
      WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="` + ssoURL + `"/>
  </IDPSSODescriptor>
</EntityDescriptor>`
}

// ---------------------------------------------------------------------------
// TestSSOMetadata HTTP handler
// ---------------------------------------------------------------------------

func TestTestSSOMetadata_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sso/test", nil)
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestTestSSOMetadata_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestTestSSOMetadata_NoMetadata(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(SSOTestRequest{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestTestSSOMetadata_ValidMetadata(t *testing.T) {
	h := newTestHandlers(t)

	xml := minimalSAMLMetadata("https://idp.example.com", "https://idp.example.com/sso")
	body, _ := json.Marshal(SSOTestRequest{Metadata: xml})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp SSOTestResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.OK)
	assert.Equal(t, "https://idp.example.com", resp.EntityID)
	assert.Equal(t, "https://idp.example.com/sso", resp.SSOURL)
}

func TestTestSSOMetadata_XMLContentType(t *testing.T) {
	h := newTestHandlers(t)

	xml := minimalSAMLMetadata("https://idp.example.com", "https://idp.example.com/sso")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test", strings.NewReader(xml))
	req.Header.Set("Content-Type", "application/xml")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp SSOTestResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.OK)
}

func TestTestSSOMetadata_HTTPSOnlyURL(t *testing.T) {
	// metadata_url must be https — http should fail.
	h := newTestHandlers(t)

	body, _ := json.Marshal(SSOTestRequest{MetadataURL: "http://insecure.example.com/metadata"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sso/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.TestSSOMetadata(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp SSOTestResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "fetch failed")
}

// ---------------------------------------------------------------------------
// validateSAMLMetadata (internal function, tested directly)
// ---------------------------------------------------------------------------

func TestValidateSAMLMetadata_InvalidXML(t *testing.T) {
	resp := validateSAMLMetadata("this is not xml", "")
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "invalid XML")
}

func TestValidateSAMLMetadata_MissingEntityID(t *testing.T) {
	xml := `<?xml version="1.0"?><EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"></EntityDescriptor>`
	resp := validateSAMLMetadata(xml, "")
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "entityID missing")
}

func TestValidateSAMLMetadata_MissingIDPSSODescriptor(t *testing.T) {
	xml := `<?xml version="1.0"?><EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com"></EntityDescriptor>`
	resp := validateSAMLMetadata(xml, "")
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "IDPSSODescriptor missing")
}

func TestValidateSAMLMetadata_EntityIDMismatch_Warning(t *testing.T) {
	xml := minimalSAMLMetadata("https://actual.idp.com", "https://actual.idp.com/sso")
	resp := validateSAMLMetadata(xml, "https://expected.idp.com")
	assert.True(t, resp.OK)
	require.NotEmpty(t, resp.Warnings)
	assert.Contains(t, resp.Warnings[0], "entityID mismatch")
}

func TestValidateSAMLMetadata_NoCerts_Warning(t *testing.T) {
	xml := minimalSAMLMetadata("https://idp.example.com", "https://idp.example.com/sso")
	resp := validateSAMLMetadata(xml, "")
	assert.True(t, resp.OK)
	assert.Equal(t, 0, resp.CertCount)
	assert.NotEmpty(t, resp.Warnings)
	assert.Contains(t, resp.Warnings[0], "signing certificates")
}

func TestValidateSAMLMetadata_NoSSOService(t *testing.T) {
	xml := `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com">
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
  </IDPSSODescriptor>
</EntityDescriptor>`
	resp := validateSAMLMetadata(xml, "")
	assert.False(t, resp.OK)
	assert.Contains(t, resp.Error, "no SingleSignOnService")
}

// ---------------------------------------------------------------------------
// stripWhitespace
// ---------------------------------------------------------------------------

func TestStripWhitespace(t *testing.T) {
	assert.Equal(t, "abc", stripWhitespace("a b\nc"))
	assert.Equal(t, "abc", stripWhitespace("a\tb\rc"))
	assert.Equal(t, "abc", stripWhitespace("abc"))
	assert.Equal(t, "", stripWhitespace("   \n\t"))
}
